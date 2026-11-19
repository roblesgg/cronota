// Sincronizar con OneDrive o Google Drive (2.14).
//
// Sin cuentas ni contraseñas en Cronota: se usa la carpeta que el programa de OneDrive o de
// Google Drive ya sincroniza en este PC. Cronota guarda ahí, en «Cronota\cronota-sync.json», una
// copia de tus tareas y horas cada vez que cambian; el programa de la nube la sube y la baja en
// tus otros PC. Cada poco, Cronota mira si el archivo lo ha cambiado otro PC y, si es así, se
// trae esos datos.
//
// Conflictos (los dos PC cambiaron cosas sin verse): manda el último que guarda, pero lo del
// otro no se pierde: se deja como «cronota-sync-conflicto-<equipo>-<fecha>.json» en la misma
// carpeta (se puede restaurar desde Ajustes como cualquier copia) y se avisa.
//
// Viajan las tareas, secciones y horas, la tarea en marcha, las sugerencias de Outlook descartadas
// y (2.14.1) los ajustes que no dependen de cada PC: tema, avisos, hora de salida, descanso de ojos,
// vínculo de Outlook... (la lista está en main.js, AJUSTES_QUE_SE_SINCRONIZAN). No viajan los de
// cada pantalla (barra, tamaños, monitor) ni la propia elección de la nube.
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARCHIVO = 'cronota-sync.json';

// ── Dónde está la carpeta de cada servicio en este PC ──────────────────────────
function carpetaOneDrive() {
  const c = [process.env.OneDriveCommercial, process.env.OneDrive, process.env.OneDriveConsumer].filter(Boolean);
  for (const d of c) { try { if (fs.statSync(d).isDirectory()) return d; } catch {} }
  try {
    const casa = os.homedir();
    const d = fs.readdirSync(casa).find((n) => /^OneDrive/i.test(n) && fs.statSync(path.join(casa, n)).isDirectory());
    if (d) return path.join(casa, d);
  } catch {}
  return null;
}
function carpetaGoogleDrive() {
  // Google Drive para escritorio monta una unidad (normalmente G:) con «Mi unidad» / «My Drive».
  for (let c = 68; c <= 90; c++) {   // D: … Z:
    const raiz = String.fromCharCode(c) + ':\\';
    for (const n of ['Mi unidad', 'My Drive']) {
      const d = path.join(raiz, n);
      try { if (fs.statSync(d).isDirectory()) return d; } catch {}
    }
  }
  // Versión antigua («Copia de seguridad y sincronización»): carpeta en el perfil.
  for (const n of ['Google Drive', 'GoogleDrive']) {
    const d = path.join(os.homedir(), n);
    try { if (fs.statSync(d).isDirectory()) return d; } catch {}
  }
  return null;
}
const SERVICIOS = {
  onedrive: { nombre: 'OneDrive', carpeta: carpetaOneDrive, descarga: 'https://www.microsoft.com/microsoft-365/onedrive/download' },
  gdrive: { nombre: 'Google Drive', carpeta: carpetaGoogleDrive, descarga: 'https://www.google.com/drive/download/' },
};
function disponibles() {
  return Object.fromEntries(Object.entries(SERVICIOS).map(([k, s]) => [k, { nombre: s.nombre, carpeta: s.carpeta(), descarga: s.descarga }]));
}

// Ruta relativa segura dentro del servicio: sin salirse de él (..), sin unidad ni barra delante.
function carpetaRelativa(r) {
  const s = String(r == null ? '' : r).trim().replace(/[\\/]+/g, path.sep).replace(/^[\\/]+|[\\/]+$/g, '');
  if (!s) return 'Cronota';
  if (s === '.') return '.';
  if (path.isAbsolute(s) || /^[a-zA-Z]:/.test(s) || s.split(path.sep).some(p => p === '..')) return 'Cronota';
  return s;
}

function escribirAtomico(fichero, texto) {
  fs.mkdirSync(path.dirname(fichero), { recursive: true });
  const tmp = fichero + '.tmp';
  fs.writeFileSync(tmp, texto);
  try { fs.renameSync(tmp, fichero); }
  catch { fs.writeFileSync(fichero, texto); try { fs.unlinkSync(tmp); } catch {} }
}
function fecha(ms) {
  const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// ── El sincronizador ────────────────────────────────────────────────────────────
// opciones: getEstado() → { tasks, groups, activeTaskId, activeSubId }
//           aplicar(datos)     → poner los datos de otro PC (y guardarlos sin volver a subirlos)
//           ajustes()          → objeto de ajustes (nube, nubeVersion, nubePendiente…), guardar()
//           ajustesParaSubir() → los ajustes que viajan (2.14.1)
//           aplicarAjustes(a)  → poner los ajustes de otro PC (2.14.1)
//           avisar(titulo, texto)
//           alCambiarEstado()  → para refrescar Ajustes
function crear(o) {
  const equipo = os.hostname();
  let temporizadorSubida = null, vigilante = null;
  let estado = { activo: false, servicio: null, carpeta: null, ultima: null, error: null };

  const aj = () => o.ajustes();
  // 2.14.5: la carpeta dentro de OneDrive / Google Drive la elige el usuario (por defecto «Cronota»).
  // Se guarda relativa a la raíz del servicio, así vale igual en otro PC aunque su OneDrive esté en
  // otra ruta. «.» es la raíz misma.
  const subcarpeta = () => carpetaRelativa(aj().nubeCarpeta);
  const fichero = () => estado.carpeta && path.join(estado.carpeta, subcarpeta(), ARCHIVO);

  function cambiarEstado(p) { estado = { ...estado, ...p }; try { o.alCambiarEstado && o.alCambiarEstado(); } catch {} }

  function subir() {
    temporizadorSubida = null;
    const f = fichero(); if (!f) return;
    try {
      const e = o.getEstado();
      const guardado = Date.now();
      const ajustes = o.ajustesParaSubir ? o.ajustesParaSubir() : undefined;
      escribirAtomico(f, JSON.stringify({ cronotaSync: 2, equipo, guardado, tasks: e.tasks, groups: e.groups, activeTaskId: e.activeTaskId || null, activeSubId: e.activeSubId || null, outlookDescartadas: e.outlookDescartadas || [], settings: ajustes }));
      aj().nubeVersion = guardado; aj().nubePendiente = false; o.guardar();
      cambiarEstado({ ultima: guardado, error: null });
    } catch (err) { cambiarEstado({ error: 'No se pudo guardar en la carpeta: ' + String((err && err.message) || err) }); }
  }

  function bajar() {
    const f = fichero(); if (!f) return;
    let remoto = null;
    try { remoto = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (err) {
      if (err && err.code === 'ENOENT') { subir(); return; }   // primera vez: se sube lo de aquí
      return;   // a medio escribir o sin bajar aún: ya se mirará la próxima vez
    }
    if (!remoto || !Array.isArray(remoto.tasks) || !Array.isArray(remoto.groups)) return;
    const conocida = Number(aj().nubeVersion) || 0;
    if (Number(remoto.guardado) <= conocida) return;            // nada nuevo
    if (remoto.equipo === equipo && !aj().nubePendiente) {       // lo último lo subió este PC
      aj().nubeVersion = remoto.guardado; o.guardar(); return;
    }
    if (aj().nubePendiente) {
      // Los dos PC cambiaron cosas: se queda lo de aquí (es lo último) y lo del otro se aparta.
      try {
        escribirAtomico(path.join(path.dirname(f), `cronota-sync-conflicto-${remoto.equipo || 'otro'}-${fecha(remoto.guardado)}.json`),
          JSON.stringify({ cronotaBackup: true, exportedAt: new Date(remoto.guardado).toISOString(), tasks: remoto.tasks, groups: remoto.groups, outlookDescartadas: remoto.outlookDescartadas, settings: remoto.settings }, null, 2));
      } catch {}
      o.avisar('Cronota: cambios en dos equipos', `Has cambiado horas aquí y en «${remoto.equipo || 'otro equipo'}» a la vez. Se queda lo de este equipo; lo del otro está en la carpeta Cronota de tu nube por si lo necesitas (Ajustes → Restaurar copia).`);
      subir();
      return;
    }
    const datos = { tasks: remoto.tasks, groups: remoto.groups, activeTaskId: remoto.activeTaskId || null, activeSubId: remoto.activeSubId || null };
    if (Array.isArray(remoto.outlookDescartadas)) datos.outlookDescartadas = remoto.outlookDescartadas;   // una 2.14.0 no las manda
    o.aplicar(datos);
    if (remoto.settings && typeof remoto.settings === 'object' && o.aplicarAjustes) o.aplicarAjustes(remoto.settings);
    aj().nubeVersion = remoto.guardado; o.guardar();
    cambiarEstado({ ultima: remoto.guardado, error: null });
  }

  // Lo llama main.js cada vez que se guardan las tareas aquí.
  function cambioLocal() {
    if (!estado.activo) return;
    if (!aj().nubePendiente) { aj().nubePendiente = true; o.guardar(); }
    if (temporizadorSubida) clearTimeout(temporizadorSubida);
    temporizadorSubida = setTimeout(subir, 4000);
  }

  function arrancar() {
    parar();
    const servicio = aj().nube;
    if (!servicio || !SERVICIOS[servicio]) { cambiarEstado({ activo: false, servicio: null, carpeta: null, error: null }); return; }
    const carpeta = SERVICIOS[servicio].carpeta();
    if (!carpeta) { cambiarEstado({ activo: false, servicio, carpeta: null, error: `No encuentro la carpeta de ${SERVICIOS[servicio].nombre} en este PC.` }); return; }
    cambiarEstado({ activo: true, servicio, carpeta, error: null });
    if (aj().nubePendiente) subir(); else bajar();
    vigilante = setInterval(() => { if (!temporizadorSubida) bajar(); }, 60000);   // cada minuto
  }
  function parar() {
    if (vigilante) { clearInterval(vigilante); vigilante = null; }
    if (temporizadorSubida) { clearTimeout(temporizadorSubida); temporizadorSubida = null; subir(); }
  }
  // Al cerrar la app: si quedaba algo por subir, ya.
  function alSalir() { if (temporizadorSubida) { clearTimeout(temporizadorSubida); subir(); } }

  return {
    arrancar, parar, alSalir, cambioLocal, ahora: () => { if (estado.activo) bajar(); },
    estado: () => ({ ...estado, archivo: fichero(), subcarpeta: subcarpeta(), disponibles: disponibles(), equipo }),
  };
}

module.exports = { crear, disponibles, carpetaRelativa, SERVICIOS };
