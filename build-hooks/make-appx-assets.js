// Genera los iconos que pide la Microsoft Store (build/appx/) a partir de assets/icon.png.
// Sin ellos, electron-builder mete sus logos de ejemplo. Uso: node build-hooks/make-appx-assets.js
const Jimp = require('jimp');
const path = require('path');
const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, 'build', 'appx');
// [nombre, ancho, alto, cuánto ocupa el logo (0-1)]: los cuadrados con un poco de margen,
// como piden las guías de la Store; el ancho, centrado.
const PIEZAS = [
  ['StoreLogo.png', 50, 50, 1],
  ['Square44x44Logo.png', 44, 44, 1],
  ['Square44x44Logo.targetsize-256_altform-unplated.png', 256, 256, 1],
  ['Square150x150Logo.png', 150, 150, 0.66],
  ['SmallTile.png', 71, 71, 0.66],
  ['LargeTile.png', 310, 310, 0.66],
  ['Wide310x150Logo.png', 310, 150, 0.66],
];
(async () => {
  const logo = await Jimp.read(path.join(raiz, 'assets', 'icon.png'));
  for (const [nombre, w, h, cuanto] of PIEZAS) {
    const lado = Math.round(Math.min(w, h) * cuanto);
    const lienzo = new Jimp(w, h, 0x00000000);
    lienzo.composite(logo.clone().resize(lado, lado, Jimp.RESIZE_BICUBIC), Math.round((w - lado) / 2), Math.round((h - lado) / 2));
    await lienzo.writeAsync(path.join(destino, nombre));
    console.log('  ' + nombre);
  }
})().catch((e) => { console.error(e); process.exit(1); });
