// Genera los logotipos de la ficha de la Microsoft Store a partir del logo (assets/icon.png),
// con las letras y los colores de la app. Salen en docs/store/:
//   - logo-icono-300.png       icono 1:1 de 300×300, con transparencia (sustituye al del paquete en la ficha)
//   - logo-caja-1080.png       caja 1:1 de 1080×1080
//   - logo-poster-720x1080.png póster 2:3 de 720×1080
// Uso (sin ELECTRON_RUN_AS_NODE): npx electron tools/imagenes-store.js
// No abre ninguna ventana: se pinta fuera de pantalla.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'docs', 'store');
const url = (p) => pathToFileURL(path.join(RAIZ, p)).href;

const BASE = `
  @font-face { font-family:'Zalando Sans'; src:url('${url('assets/fonts/zalando-sans-latin-variable.woff2')}') format('woff2'); font-weight:100 900; }
  @font-face { font-family:'Zalando Sans Expanded'; src:url('${url('assets/fonts/zalando-sans-expanded-latin-variable.woff2')}') format('woff2'); font-weight:100 900; }
  html, body { margin:0; width:100%; height:100%; overflow:hidden; }
  body {
    font-family:'Zalando Sans', sans-serif; color:#f6f2ee; display:flex; flex-direction:column; align-items:center; justify-content:center;
    background:
      radial-gradient(60% 45% at 50% 40%, rgba(255,95,170,.34), transparent 70%),
      radial-gradient(55% 40% at 70% 70%, rgba(140,120,255,.26), transparent 72%),
      radial-gradient(70% 50% at 20% 85%, rgba(255,159,90,.16), transparent 70%),
      #141013;
  }
  .logo { filter:drop-shadow(0 30px 45px rgba(0,0,0,.45)); }
`;

const PIEZAS = [
  {
    nombre: 'logo-caja-1080.png', w: 1080, h: 1080,
    html: `<img class="logo" src="${url('assets/icon.png')}" style="width:800px;height:800px">`,
  },
  {
    nombre: 'logo-poster-720x1080.png', w: 720, h: 1080,
    html: `
      <img class="logo" src="${url('assets/icon.png')}" style="width:560px;height:560px;margin-top:-40px">
      <div style="font-family:'Zalando Sans Expanded';font-weight:800;font-size:66px;letter-spacing:-.01em;margin-top:26px">Cronota</div>
      <div style="font-size:27px;line-height:1.35;color:rgba(246,240,234,.72);text-align:center;margin-top:14px;max-width:560px">Tus horas por tarea,<br>sin pensar en ellas.</div>`,
  },
];

// Una sola ventana fuera de pantalla para todas las piezas: con una nueva por pieza, la
// segunda no llegaba a cargar (ERR_FAILED).
let win = null;
async function pintar(pieza) {
  if (!win) win = new BrowserWindow({ width: pieza.w, height: pieza.h, show: false, webPreferences: { offscreen: true } });
  win.setContentSize(pieza.w, pieza.h);
  const tmp = path.join(os.tmpdir(), `cronota-store-${process.pid}-${pieza.nombre}.html`);
  fs.writeFileSync(tmp, `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE}</style></head><body>${pieza.html}</body></html>`);
  await win.loadFile(tmp);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.decode())))');
  await new Promise((r) => setTimeout(r, 300));
  const img = await win.webContents.capturePage();
  const { width, height } = img.getSize();
  const final = (width === pieza.w && height === pieza.h) ? img : img.resize({ width: pieza.w, height: pieza.h, quality: 'best' });
  fs.writeFileSync(path.join(SALIDA, pieza.nombre), final.toPNG());
  console.log('  ' + pieza.nombre, `${pieza.w}×${pieza.h}`);
  try { fs.unlinkSync(tmp); } catch {}
}

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(async () => {
  try {
    for (const p of PIEZAS) await pintar(p);
    // El icono 1:1 va con transparencia, igual que el de la app.
    const Jimp = require('jimp');
    const { reducirLogo } = require(path.join(RAIZ, 'build-hooks', 'reducir-logo'));
    const logo = await Jimp.read(path.join(RAIZ, 'assets', 'icon.png'));
    await reducirLogo(logo, 300).writeAsync(path.join(SALIDA, 'logo-icono-300.png'));
    console.log('  logo-icono-300.png 300×300');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
  app.quit();
});
