// Genera las capturas de la ficha de la Microsoft Store (docs/store/captura-*.png, 1920×1080):
// la app con una semana de trabajo inventada, un titular y el fondo de los logotipos.
// No abre ninguna ventana ni toca tus datos: todo se pinta fuera de pantalla con datos de ejemplo.
//
//   npx electron tools/capturas-store.js        (sin ELECTRON_RUN_AS_NODE)
//
// Mejor de miércoles a viernes: el calendario enseña la semana en curso y los días que ya han
// pasado salen llenos. Las horas de "hoy" se calculan a partir de la hora a la que se lanza.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'docs', 'store');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cronota-capturas-'));
const APPDATA = path.join(TMP, 'appdata');
const CRUDAS = path.join(TMP, 'crudas');
const url = (p) => pathToFileURL(path.isAbsolute(p) ? p : path.join(RAIZ, p)).href;

// ── Una semana de trabajo inventada ─────────────────────────────────────────
function datosDeEjemplo() {
  const ahora = Date.now();
  const lunes = new Date(); lunes.setHours(0, 0, 0, 0);
  const hoy = (lunes.getDay() + 6) % 7;            // 0 = lunes
  lunes.setDate(lunes.getDate() - hoy);
  const a = (dia, hh, mm = 0) => { const d = new Date(lunes); d.setDate(d.getDate() + dia); d.setHours(hh, mm, 0, 0); return d.getTime(); };

  const groups = [
    { id: 'g-norte', name: 'Cliente Norte', palette: 'azules' },
    { id: 'g-web', name: 'Proyecto Web', palette: 'violetas' },
    { id: 'g-interno', name: 'Interno', palette: 'ambar' },
  ];
  const T = {};
  const tarea = (k, name, color, groupId, taskType, memo) => {
    T[k] = { id: 't-' + k, name, color, groupId, taskType, memo, entries: [], subtasks: [], archived: false, deleted: false };
  };
  tarea('web', 'Diseño de la nueva web', '#60a5fa', 'g-web', 'ongoing', 'Presupuesto P-2026-114');
  tarea('soporte', 'Soporte a clientes', '#fbbf24', 'g-norte', 'ongoing', 'Contrato SOP-12');
  tarea('informe', 'Informe mensual', '#34d399', 'g-norte', 'oneShot', '');
  tarea('reunion', 'Reunión de seguimiento', '#a78bfa', 'g-norte', 'ongoing', '');
  tarea('formacion', 'Formación del equipo', '#f472b6', 'g-interno', 'oneShot', '');
  tarea('nube', 'Migración a la nube', '#22d3ee', 'g-web', 'ongoing', 'OT-2291');
  tarea('presupuestos', 'Revisión de presupuestos', '#fb923c', 'g-interno', 'ongoing', '');
  const rato = (k, ini, fin, note) => { if (ini < ahora) T[k].entries.push({ start: ini, end: Math.min(fin, ahora), nameAtTime: T[k].name, ...(note ? { note } : {}) }); };

  // Los días que ya han pasado esta semana, llenos.
  const semana = [
    [['web', 9, 0, 10, 30], ['soporte', 10, 30, 12, 0], ['reunion', 12, 0, 13, 0], ['web', 15, 0, 17, 30]],
    [['nube', 9, 0, 11, 30], ['informe', 11, 30, 13, 0], ['formacion', 15, 0, 16, 0], ['web', 16, 0, 18, 0]],
    [['reunion', 9, 0, 10, 0], ['web', 10, 0, 13, 0], ['soporte', 15, 0, 17, 0], ['presupuestos', 17, 0, 18, 0]],
    [['soporte', 9, 0, 11, 0], ['nube', 11, 0, 13, 30], ['web', 15, 0, 18, 0]],
  ];
  semana.slice(0, Math.min(hoy, semana.length)).forEach((ratos, dia) =>
    ratos.forEach(([k, h1, m1, h2, m2]) => rato(k, a(dia, h1, m1), a(dia, h2, m2))));

  // Hoy: lo de la mañana y la tarea en marcha desde hace 2 h 22 min.
  const enMarchaDesde = ahora - (2 * 3600 + 22 * 60 + 26) * 1000;
  [['soporte', 9, 0, 10, 15], ['reunion', 10, 15, 11, 0], ['informe', 11, 0, 12, 30]].forEach(([k, h1, m1, h2, m2]) => {
    const ini = a(hoy, h1, m1), fin = a(hoy, h2, m2);
    if (fin <= enMarchaDesde) rato(k, ini, fin);
  });
  T.web.entries.push({ start: enMarchaDesde, end: null, nameAtTime: T.web.name, note: 'Maquetando la portada' });

  return { tasks: Object.values(T), groups, activeTaskId: T.web.id, activeSubId: null };
}

function prepararDatos() {
  const dir = path.join(APPDATA, 'imputa-me');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(CRUDAS, { recursive: true });
  fs.writeFileSync(path.join(dir, 'imputa-tasks.json'), JSON.stringify(datosDeEjemplo()));
  fs.writeFileSync(path.join(dir, 'imputa-settings.json'), JSON.stringify({
    imputeUrls: ['https://portal.empresa.com/horas'], reminderMinutes: 10, dockMode: false, lastView: 'panel', uiVersion: 5,
  }));
}

// ── Capturas de la app (tools/snap.js, en otro proceso) ─────────────────────
const A_LAS_OCHO_Y_MEDIA = "document.getElementById('gridScroll').scrollTop = 8.5 * 96";
function capturar(nombre, pagina, tema, w, h, js = '1', ajustes = null) {
  const salida = path.join(CRUDAS, nombre + '.png');
  const env = { ...process.env, APPDATA, SNAP_WAIT: '1800', SNAP_AJUSTES: ajustes ? JSON.stringify(ajustes) : '' };
  delete env.ELECTRON_RUN_AS_NODE;
  execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'snap.js'), pagina, salida, tema, String(w), String(h), js],
    { env, stdio: 'ignore', timeout: 90000 });
  console.log('  captura', nombre);
  return url(salida);
}

// ── Composición ─────────────────────────────────────────────────────────────
const ESTILO = `
  @font-face { font-family:'Zalando Sans'; src:url('${url('assets/fonts/zalando-sans-latin-variable.woff2')}') format('woff2'); font-weight:100 900; }
  @font-face { font-family:'Zalando Sans Expanded'; src:url('${url('assets/fonts/zalando-sans-expanded-latin-variable.woff2')}') format('woff2'); font-weight:100 900; }
  html, body { margin:0; width:1920px; height:1080px; overflow:hidden; }
  body {
    position:relative; font-family:'Zalando Sans', sans-serif; color:#f6f2ee;
    background:
      radial-gradient(45% 55% at 78% 45%, rgba(255,95,170,.28), transparent 70%),
      radial-gradient(40% 50% at 95% 95%, rgba(140,120,255,.24), transparent 72%),
      radial-gradient(45% 55% at 5% 100%, rgba(255,159,90,.16), transparent 70%),
      #141013;
  }
  .texto { position:absolute; left:110px; top:0; bottom:0; width:640px; display:flex; flex-direction:column; justify-content:center; }
  .etiqueta { align-self:flex-start; font-family:'Zalando Sans Expanded'; font-weight:700; font-size:17px; letter-spacing:.14em; text-transform:uppercase;
    color:#ffb383; padding:9px 18px; border-radius:999px; background:rgba(255,159,90,.14); border:1px solid rgba(255,179,131,.35); margin-bottom:28px; }
  h1 { font-family:'Zalando Sans Expanded'; font-weight:800; font-size:68px; line-height:1.07; letter-spacing:-.015em; margin:0; }
  .sub { font-size:27px; line-height:1.48; color:rgba(246,240,234,.72); margin:26px 0 0; }
  .puntos { list-style:none; padding:0; margin:34px 0 0; display:flex; flex-direction:column; gap:14px; }
  .puntos li { font-size:23px; display:flex; align-items:center; gap:14px; color:rgba(246,240,234,.9); }
  .puntos li::before { content:''; width:10px; height:10px; border-radius:3px; background:#ff9f5a; box-shadow:0 0 0 5px rgba(255,159,90,.18); flex-shrink:0; }
  .ventana { position:absolute; border-radius:18px; overflow:hidden; box-shadow:0 50px 90px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.09); }
  .ventana img { display:block; width:100%; height:100%; }
  .chips { display:flex; flex-wrap:wrap; gap:12px; margin-top:36px; max-width:540px; }
  .chips span { font-size:20px; font-weight:600; padding:10px 18px; border-radius:999px; color:#f6f2ee;
    background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); }
  .marca { position:absolute; left:110px; bottom:64px; display:flex; align-items:center; gap:14px; font-family:'Zalando Sans Expanded'; font-weight:800; font-size:26px; }
  .marca img { width:54px; height:54px; filter:drop-shadow(0 6px 10px rgba(0,0,0,.4)); }
`;
const marca = () => `<div class="marca"><img src="${url('assets/icon.png')}">Cronota</div>`;
const ventana = (src, x, y, w, h, extra = '') => `<div class="ventana" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${extra}"><img src="${src}"></div>`;

function composiciones(c) {
  return [
    {
      nombre: 'captura-1-portada.png',
      html: `
        <div class="texto">
          <img src="${url('assets/icon.png')}" style="width:250px;height:250px;margin:-20px 0 18px -14px;filter:drop-shadow(0 26px 40px rgba(0,0,0,.5))">
          <h1 style="font-size:96px">Cronota</h1>
          <p class="sub" style="font-size:31px">Tus horas por tarea,<br>sin pensar en ellas.</p>
          <ul class="puntos">
            <li>Un clic para empezar, otro para parar</li>
            <li>Tu semana entera de un vistazo</li>
            <li>Imputa tus horas en un minuto</li>
          </ul>
        </div>
        ${ventana(c.calendario, 740, 250, 708, 618, 'opacity:.9;transform:rotate(-3deg)')}
        ${ventana(c.panelNoche, 1300, 100, 460, 880)}`,
    },
    {
      nombre: 'captura-2-calendario.png',
      html: `
        <div class="texto" style="width:520px">
          <div class="etiqueta">Calendario</div>
          <h1>Tu semana,<br>de un vistazo</h1>
          <p class="sub">Corrige bloques, añade los que se te pasaron y mira en qué se fue cada hora.</p>
        </div>
        ${ventana(c.calendario, 720, 60, 1100, 960)}
        ${marca()}`,
    },
    {
      nombre: 'captura-3-tareas.png',
      html: `
        <div class="texto">
          <div class="etiqueta">Tareas</div>
          <h1>Cada cosa<br>en su sitio</h1>
          <p class="sub">Secciones por cliente o proyecto, tareas recurrentes o puntuales y una nota fija para el código del proyecto.</p>
        </div>
        ${ventana(c.tareas, 860, 100, 460, 880)}
        ${ventana(c.panelNoche, 1360, 100, 460, 880)}
        ${marca()}`,
    },
    {
      nombre: 'captura-4-imputar.png',
      html: `
        <div class="texto" style="width:520px">
          <div class="etiqueta">Imputar</div>
          <h1>Imputa en<br>un minuto</h1>
          <p class="sub">Las horas en decimales con un clic, copiar y pegar en tu portal o exportarlas a Excel. Y un botón que te lleva a donde imputas.</p>
        </div>
        ${ventana(c.calendarioDecimales, 720, 60, 1100, 960)}
        ${marca()}`,
    },
    {
      nombre: 'captura-5-personalizable.png',
      html: `
        <div class="texto" style="width:560px">
          <div class="etiqueta">Personalizable</div>
          <h1>Hazla tuya</h1>
          <p class="sub">17 temas, el color de acento que quieras, cristal líquido o plano, claro u oscuro.</p>
          <div class="chips">
            <span>Cristal líquido</span><span>Plano</span><span>Claro</span><span>Oscuro</span><span>17 temas</span><span>19 colores</span>
          </div>
        </div>
        ${abanico(c)}
        ${marca()}`,
    },
  ];
}

// Siete paneles en abanico, cada uno con su tema, su color y su estilo; en medio, Ajustes.
function abanico(c) {
  const piezas = [c.temaLuz, c.temaAtardecer, c.temaLavanda, c.ajustes, c.temaMedianoche, c.temaMenta, c.temaVino];
  return piezas.map((src, i) => {
    const d = i - 3, centro = d === 0;
    const k = centro ? 0.66 : 0.56;
    const w = Math.round(460 * k), h = Math.round(880 * k);
    const x = 1240 + d * 150 - w / 2, y = (centro ? 205 : 250) + Math.abs(d) * 18;
    return ventana(src, x, y, w, h, `transform:rotate(${d * 5}deg);z-index:${10 - Math.abs(d)};border-radius:14px`);
  }).join('');
}

let ventanaOculta = null;
async function componer(pieza) {
  if (!ventanaOculta) ventanaOculta = new BrowserWindow({ width: 1920, height: 1080, show: false, webPreferences: { offscreen: true } });
  const tmp = path.join(TMP, pieza.nombre + '.html');
  fs.writeFileSync(tmp, `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${ESTILO}</style></head><body>${pieza.html}</body></html>`);
  await ventanaOculta.loadFile(tmp);
  await ventanaOculta.webContents.executeJavaScript('document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.decode())))');
  await new Promise((r) => setTimeout(r, 300));
  let img = await ventanaOculta.webContents.capturePage();
  const { width, height } = img.getSize();
  if (width !== 1920 || height !== 1080) img = img.resize({ width: 1920, height: 1080, quality: 'best' });
  fs.writeFileSync(path.join(SALIDA, pieza.nombre), img.toPNG());
  console.log('  ' + pieza.nombre);
}

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(async () => {
  try {
    prepararDatos();
    const c = {
      panelNoche: capturar('panel-noche', 'main.html', 'noche', 460, 880),
      // Alto de sobra para que quepa el día entero (de 8:30 a 18:30; cada hora mide 96 px) y
      // empezando en las 8:30: el calendario se abre en la hora actual y cortaba la mañana.
      // El formato de horas se recuerda entre capturas (localStorage): se fija en cada una.
      calendario: capturar('calendario', 'calendar.html', 'noche', 1180, 1030, 'if (horasDecimales) alternarFormatoHoras(); ' + A_LAS_OCHO_Y_MEDIA),
      calendarioDecimales: capturar('calendario-decimales', 'calendar.html', 'noche', 1180, 1030, 'if (!horasDecimales) alternarFormatoHoras(); ' + A_LAS_OCHO_Y_MEDIA),
      tareas: capturar('tareas', 'groups.html', 'noche', 460, 880),
      ajustes: capturar('ajustes', 'settings.html', 'noche', 460, 880),
    };
    // Para el abanico de "Personalizable": temas, acentos y estilos distintos (cristal o plano).
    const cristal = (accent) => ({ accent, liquidGlass: true, bgOpacity: 10 });
    const plano = (accent) => ({ accent, liquidGlass: false, bgOpacity: 100 });
    Object.assign(c, {
      temaLuz: capturar('tema-luz', 'main.html', 'luz', 460, 880, '1', cristal('azul')),
      temaAtardecer: capturar('tema-atardecer', 'main.html', 'atardecer', 460, 880, '1', cristal(null)),
      temaLavanda: capturar('tema-lavanda', 'main.html', 'lavanda', 460, 880, '1', plano('fucsia')),
      temaMedianoche: capturar('tema-medianoche', 'main.html', 'medianoche', 460, 880, '1', plano('turquesa')),
      temaMenta: capturar('tema-menta', 'main.html', 'menta', 460, 880, '1', cristal('verde')),
      temaVino: capturar('tema-vino', 'main.html', 'vino', 460, 880, '1', plano('oro')),
    });
    for (const pieza of composiciones(c)) await componer(pieza);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  app.quit();
});
