// ¿Estás en una llamada? (Fase 3, 2.12) Sin Teams ni permisos: Windows apunta en el registro
// qué apps están usando el micrófono ahora mismo (Configuración → Privacidad → Micrófono).
// Una app con el micrófono abierto tiene LastUsedTimeStart y LastUsedTimeStop = 0. Teams,
// Meet en el navegador, Zoom... cualquiera cuenta. Se lee con reg.exe, como el resto de
// consultas al registro de la app (nada de PowerShell).
//
// Para no confundirse con programas que tienen el micrófono abierto todo el rato (cancelación
// de ruido y similares), no cuenta una app que lo tenga abierto desde hace más de 4 horas.
const { execFile } = require('child_process');

const CLAVE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone';
const MAX_LLAMADA_MS = 4 * 3600 * 1000;
const FILETIME_A_UNIX = 116444736000000000n;   // de 1601 a 1970, en unidades de 100 ns

function nombreBonito(clave) {
  let n = clave.split('\\').pop() || '';
  n = n.replace(/_[a-z0-9]{13}$/i, '');              // familia de paquete de la Store
  n = n.replace(/^.*#/, '').replace(/\.exe$/i, '');   // NonPackaged: ruta con # en vez de \
  if (/teams/i.test(n)) return 'Teams';
  if (/zoom/i.test(n)) return 'Zoom';
  if (/chrome/i.test(n)) return 'Chrome';
  if (/msedge/i.test(n)) return 'Edge';
  if (/firefox/i.test(n)) return 'Firefox';
  if (/OutlookForWindows|olk/i.test(n)) return 'Outlook';
  return n.split('.').pop() || n;
}

// Apps con el micrófono abierto ahora: ['Teams', ...].
function leer(salida, ahora = Date.now()) {
  const apps = [];
  let clave = null, inicio = null, fin = null;
  const cerrar = () => {
    if (clave && inicio && fin === 0n && inicio !== 0n) {
      const ms = Number((inicio - FILETIME_A_UNIX) / 10000n);
      if (ahora - ms < MAX_LLAMADA_MS) apps.push(nombreBonito(clave));
    }
  };
  String(salida || '').split(/\r?\n/).forEach((linea) => {
    if (/^HKEY_/i.test(linea)) { cerrar(); clave = linea.trim(); inicio = null; fin = null; return; }
    const m = linea.match(/^\s+(LastUsedTimeStart|LastUsedTimeStop)\s+REG_QWORD\s+0x([0-9a-f]+)/i);
    if (!m) return;
    const v = BigInt('0x' + m[2]);
    if (m[1] === 'LastUsedTimeStart') inicio = v; else fin = v;
  });
  cerrar();
  return [...new Set(apps)];
}

function consultar() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    execFile('reg.exe', ['query', CLAVE, '/s'], { windowsHide: true, timeout: 10000, maxBuffer: 4 * 1024 * 1024 }, (err, salida) => {
      resolve(err ? [] : leer(salida));
    });
  });
}

// Mira cada 20 s mientras esté encendido y avisa al cambiar: alCambiar(apps).
function vigilar(alCambiar) {
  let ultima = '';
  let timer = null;
  const mira = async () => {
    const apps = await consultar();
    const firma = apps.join(',');
    if (firma !== ultima) { ultima = firma; alCambiar(apps); }
  };
  return {
    encender() { if (timer) return; mira(); timer = setInterval(mira, 20000); },
    apagar() { if (timer) { clearInterval(timer); timer = null; } if (ultima) { ultima = ''; alCambiar([]); } },
  };
}

module.exports = { vigilar, consultar, _leer: leer };
