// Copias automáticas y arranque con Windows de la versión de la Microsoft Store.
// (2.13: sale de migracion-store.js, que se quitó con el paso del instalador a la Store.)
//
// Copias automáticas: los datos de la versión de la Store viven dentro de su paquete y Windows
// los borra si se desinstala. Por eso cada día se deja una copia en Documentos\Cronota\Copias
// automáticas (las 14 últimas), que se restaura desde Ajustes como cualquier otra copia.
const path = require('path');
const fs = require('fs');

const COPIAS_A_GUARDAR = 14;

let documentos = null;   // lo pone main.js con app.getPath('documents')
function configurar(opciones) { if (opciones && opciones.documentos) documentos = opciones.documentos; }

function carpetaCopias() {
  if (!documentos) throw new Error('sin carpeta de Documentos');
  return path.join(documentos, 'Cronota', 'Copias automáticas');
}

function escribirAtomico(fichero, texto) {
  fs.mkdirSync(path.dirname(fichero), { recursive: true });
  const tmp = fichero + '.tmp';
  fs.writeFileSync(tmp, texto);
  try { fs.renameSync(tmp, fichero); }
  catch { fs.writeFileSync(fichero, texto); try { fs.unlinkSync(tmp); } catch {} }
}

function fechaLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Una copia al día, con el mismo formato que «Exportar copia» (se restaura desde Ajustes igual).
// Si no hay nada que guardar no se escribe: si un día la app arrancara vacía por lo que fuera,
// no debe ir desplazando a las copias buenas.
function copiaDelDia(estado, ajustes) {
  try {
    if (!(estado.tasks || []).length && !(estado.groups || []).length) return false;
    const dir = carpetaCopias();
    const fichero = path.join(dir, `cronota-copia-${fechaLocal(new Date())}.json`);
    if (fs.existsSync(fichero)) return false;
    // 2.14.1: también los ajustes y las sugerencias descartadas, como «Exportar copia».
    const copia = { cronotaBackup: true, version: 2, exportedAt: new Date().toISOString(), tasks: estado.tasks || [], groups: estado.groups || [], outlookDescartadas: estado.outlookDescartadas || [], settings: ajustes || undefined };
    escribirAtomico(fichero, JSON.stringify(copia, null, 2));
    const nuestras = fs.readdirSync(dir).filter((n) => /^cronota-copia-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    nuestras.slice(0, Math.max(0, nuestras.length - COPIAS_A_GUARDAR))
      .forEach((n) => { try { fs.unlinkSync(path.join(dir, n)); } catch {} });
    return true;
  } catch { return false; }
}

// Ajustes que no se restauran desde una copia: dependen de la versión o de este equipo.
// 2.14.1: tampoco la nube elegida (cada PC elige la suya en Ajustes).
const AJUSTES_QUE_NO_VIAJAN = ['openAtLogin', 'betaUpdates', 'lastSeenVersion', 'lastSeenWhatsNew', 'traspasoVisto', 'ultimoLatido', 'nube', 'nubeCarpeta', 'nubeVersion', 'nubePendiente', 'versionNuevaAvisada', 'cerradoParaActualizar'];
function ajustesTraspasables(ajustes) {
  const r = { ...(ajustes || {}) };
  AJUSTES_QUE_NO_VIAJAN.forEach((k) => { delete r[k]; });
  return r;
}

// ¿La ha abierto Windows al iniciar sesión? La tarea de inicio de la Store no pasa argumentos,
// así que se mira cuánto lleva abierto el escritorio (explorer.exe): si arrancó hace menos de
// 3 minutos, es el inicio de sesión (y la app no abre el panel).
function arranqueDeSesion() {
  if (process.platform !== 'win32') return false;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    const GetShellWindow = user32.func('intptr_t __stdcall GetShellWindow()');
    const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(intptr_t ventana, _Out_ uint32_t *pid)');
    const OpenProcess = kernel32.func('intptr_t __stdcall OpenProcess(uint32_t acceso, bool heredar, uint32_t pid)');
    const GetProcessTimes = kernel32.func('bool __stdcall GetProcessTimes(intptr_t proceso, _Out_ uint64_t *creado, _Out_ uint64_t *salida, _Out_ uint64_t *nucleo, _Out_ uint64_t *usuario)');
    const CloseHandle = kernel32.func('bool __stdcall CloseHandle(intptr_t h)');
    const ventana = GetShellWindow();
    if (!ventana) return false;
    const pid = [0];
    GetWindowThreadProcessId(ventana, pid);
    if (!pid[0]) return false;
    const proceso = OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid[0]);
    if (!proceso) return false;
    const creado = [0], salida = [0], nucleo = [0], usuario = [0];
    const ok = GetProcessTimes(proceso, creado, salida, nucleo, usuario);
    CloseHandle(proceso);
    if (!ok) return false;
    // FILETIME: centenas de nanosegundos desde 1601. A milisegundos desde 1970.
    const hace = Date.now() - (Number(creado[0]) / 10000 - 11644473600000);
    return hace >= 0 && hace < 3 * 60 * 1000;
  } catch { return false; }
}

module.exports = { configurar, carpetaCopias, copiaDelDia, ajustesTraspasables, arranqueDeSesion };
