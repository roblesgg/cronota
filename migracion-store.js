// Paso de la versión del instalador a la de la Microsoft Store (2.9.2) y copias de seguridad
// automáticas en Documentos\Cronota.
//
// Cómo pasa alguien del instalador a la Store pulsando un solo botón:
//   1. La versión del instalador enseña el aviso (src/migrar.html). El botón guarda una copia
//      completa en Documentos\Cronota\cronota-traspaso.json y abre la ficha de la Store.
//   2. En cuanto ve instalada la de la Store (Get-AppxPackage), guarda, se cierra y deja un
//      PowerShell suelto, sin ventana, que la desinstala en silencio y abre la de la Store.
//      También lo hace sola al arrancar, o si alguien intenta abrir la de la Store con esta
//      abierta. El desinstalador no borra la carpeta de datos (%APPDATA%\imputa-me).
//   3. La de la Store ve esa misma carpeta: Windows enseña a las apps de la Store los ficheros
//      que ya había en AppData. Si aun así arranca vacía, se trae el traspaso de Documentos.
//      La primera vez da la bienvenida diciendo cuántas tareas tiene.
//
// Es la del instalador la que se aparta y abre la otra, y no al revés: así nunca están las
// dos abiertas tocando los mismos datos, y el desinstalador lo lanza un programa normal. Lo
// que lanza una app de la Store hereda su registro virtualizado y no podría borrar bien las
// entradas de la versión vieja (accesos directos, «Aplicaciones instaladas»).
//
// Copias automáticas: los datos de la versión de la Store viven dentro de su paquete y Windows
// los borra si se desinstala. Por eso cada día se deja una copia en Documentos\Cronota\Copias
// automáticas (las 14 últimas), que se restaura desde Ajustes como cualquier otra copia.
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

// Identidad del paquete de la Store (build.appx en package.json). El applicationId no se
// cambia: forma parte de cómo Windows abre la app (shell:AppsFolder\<familia>!<applicationId>).
const PAQUETE = 'lvaroRoblesGonzlezDripDev.Cronota';
const APLICACION = 'imputame';
const FICHA_STORE = 'ms-windows-store://pdp/?productid=9NXSJVW6BXQF';
const COPIAS_A_GUARDAR = 14;

let documentos = null;   // lo pone main.js con app.getPath('documents')
function configurar(opciones) { if (opciones && opciones.documentos) documentos = opciones.documentos; }

function carpetaCronota() {
  if (!documentos) throw new Error('sin carpeta de Documentos');
  return path.join(documentos, 'Cronota');
}
function rutaTraspaso() { return path.join(carpetaCronota(), 'cronota-traspaso.json'); }
function carpetaCopias() { return path.join(carpetaCronota(), 'Copias automáticas'); }

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

// Mismo formato que «Exportar copia de seguridad»: se restaura desde Ajustes igual.
function copiaDe(estado, extra) {
  return { cronotaBackup: true, exportedAt: new Date().toISOString(), tasks: estado.tasks || [], groups: estado.groups || [], ...extra };
}

// Una copia al día. Si no hay nada que guardar no se escribe: si un día la app arrancara
// vacía por lo que fuera, no debe ir desplazando a las copias buenas.
function copiaDelDia(estado) {
  try {
    if (!(estado.tasks || []).length && !(estado.groups || []).length) return false;
    const dir = carpetaCopias();
    const fichero = path.join(dir, `cronota-copia-${fechaLocal(new Date())}.json`);
    if (fs.existsSync(fichero)) return false;
    escribirAtomico(fichero, JSON.stringify(copiaDe(estado), null, 2));
    const nuestras = fs.readdirSync(dir).filter((n) => /^cronota-copia-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    nuestras.slice(0, Math.max(0, nuestras.length - COPIAS_A_GUARDAR))
      .forEach((n) => { try { fs.unlinkSync(path.join(dir, n)); } catch {} });
    return true;
  } catch { return false; }
}

// Ajustes que no viajan a la versión de la Store: dependen de qué versión es o de este equipo.
const AJUSTES_QUE_NO_VIAJAN = ['openAtLogin', 'betaUpdates', 'lastSeenVersion', 'lastSeenWhatsNew', 'traspasoVisto'];
function ajustesTraspasables(ajustes) {
  const r = { ...(ajustes || {}) };
  AJUSTES_QUE_NO_VIAJAN.forEach((k) => { delete r[k]; });
  return r;
}

function guardarTraspaso(estado, ajustes) {
  try {
    escribirAtomico(rutaTraspaso(), JSON.stringify(copiaDe(estado, { cronotaTraspaso: true, settings: ajustesTraspasables(ajustes) }), null, 2));
    return true;
  } catch { return false; }
}

function leerTraspaso() {
  try {
    const t = JSON.parse(fs.readFileSync(rutaTraspaso(), 'utf8'));
    if (!t || !t.cronotaTraspaso || !Array.isArray(t.tasks) || !Array.isArray(t.groups)) return null;
    return t;
  } catch { return null; }
}

function powershell(script) {
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
}

// ¿Está instalada la de la Store? Get-AppxPackage es lo único fiable: la carpeta del paquete
// puede quedarse después de desinstalar. Tarda alrededor de un segundo, así que nunca se lanzan
// dos a la vez. Devuelve { familia, version } o null.
let mirando = null;
function paqueteStore() {
  if (process.platform !== 'win32') return Promise.resolve(null);
  if (mirando) return mirando;
  const script = `$p = Get-AppxPackage -Name '${PAQUETE}' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { $p.PackageFamilyName + '|' + $p.Version }`;
  mirando = new Promise((resolve) => {
    execFile('powershell.exe', powershell(script), { windowsHide: true, timeout: 20000 }, (err, salida) => {
      const linea = String(salida || '').trim().split(/\r?\n/).pop() || '';
      const [familia, version] = linea.split('|').map((s) => (s || '').trim());
      resolve(!err && familia && version ? { familia, version } : null);
    });
  }).finally(() => { mirando = null; });
  return mirando;
}

// El PowerShell que hace el cambio cuando la app ya se ha ido. Va aparte para poder revisarlo
// (y comprobar que PowerShell lo entiende) sin ejecutarlo.
function scriptCambio({ pid, exe, desinstalador, familia }) {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  return [
    `$ErrorActionPreference = 'SilentlyContinue'`,
    `$exe = ${q(exe)}`,
    `$desinstalador = ${q(desinstalador)}`,
    // 1. Esperar a que la app se cierre y rematar lo que quede de ella. Solo los procesos de
    //    esta carpeta: la de la Store tiene el mismo nombre de .exe.
    `Wait-Process -Id ${Number(pid)} -Timeout 30`,
    `Start-Sleep -Seconds 2`,
    `Get-Process | Where-Object { $_.Path -eq $exe } | Stop-Process -Force`,
    // 2. Desinstalar en silencio. El desinstalador de NSIS se copia a TEMP y sigue desde allí:
    //    se espera a esa copia y a que desaparezca el .exe (como mucho minuto y medio).
    `if (Test-Path -LiteralPath $desinstalador) {`,
    `  Start-Process -FilePath $desinstalador -ArgumentList '/S','/currentuser'`,
    `  Start-Sleep -Seconds 2`,
    `  Get-Process -Name 'Un_A','Au_' | Wait-Process -Timeout 90`,
    `  for ($i = 0; ($i -lt 30) -and (Test-Path -LiteralPath $exe); $i++) { Start-Sleep -Seconds 1 }`,
    `  Start-Sleep -Seconds 2`,
    `}`,
    // 3. Abrir la de la Store.
    `Start-Process ${q(`shell:AppsFolder\\${familia}!${APLICACION}`)}`,
  ].join('\n');
}

// Lanza el cambio y vuelve enseguida: quien llama tiene que cerrar la app justo después.
// Devuelve false si no ha podido lanzarlo.
function cambiarALaStore({ familia }) {
  try {
    const exe = process.execPath;
    const desinstalador = path.join(path.dirname(exe), `Uninstall ${path.basename(exe, '.exe')}.exe`);
    const script = scriptCambio({ pid: process.pid, exe, desinstalador, familia });
    const hijo = spawn('powershell.exe', ['-WindowStyle', 'Hidden', ...powershell(script)], { detached: true, stdio: 'ignore', windowsHide: true });
    hijo.unref();
    return true;
  } catch { return false; }
}

// ¿La ha abierto Windows al iniciar sesión? La tarea de inicio de la Store no pasa argumentos
// (en la versión del instalador va "--hidden"), así que se mira cuánto lleva abierto el
// escritorio (explorer.exe): si arrancó hace menos de 3 minutos, es el inicio de sesión.
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

module.exports = {
  FICHA_STORE, configurar, rutaTraspaso, carpetaCopias,
  copiaDelDia, guardarTraspaso, leerTraspaso, ajustesTraspasables,
  paqueteStore, scriptCambio, cambiarALaStore, arranqueDeSesion,
};
