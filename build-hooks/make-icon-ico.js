// Genera assets/icon.ico a partir de assets/icon.png: los tamaños de 16 a 256 px, cada uno
// guardado en PNG dentro del .ico (como el de antes; Windows, rcedit y el instalador lo leen).
//
// Al cambiar el logo:
//   1. Poner el original en docs/marca/ y su PNG (1080×1080, con transparencia) en assets/icon.png.
//   2. node build-hooks/make-icon-ico.js        -> assets/icon.ico (ventanas, .exe, instalador)
//   3. node build-hooks/make-appx-assets.js     -> build/appx/ (Microsoft Store)
//   4. node build-hooks/make-installer-images.js -> build/*.bmp (páginas del instalador)
//   5. web/cronota-icon.png (512 px) para la web.
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const { reducirLogo } = require('./reducir-logo');

const raiz = path.join(__dirname, '..');
const TAMANOS = [16, 24, 32, 48, 64, 128, 256];

(async () => {
  const logo = await Jimp.read(path.join(raiz, 'assets', 'icon.png'));
  const pngs = [];
  for (const lado of TAMANOS) pngs.push(await reducirLogo(logo, lado).getBufferAsync(Jimp.MIME_PNG));

  // Formato .ico: cabecera de 6 bytes, una entrada de 16 bytes por tamaño y después las imágenes.
  const cabecera = Buffer.alloc(6 + 16 * TAMANOS.length);
  cabecera.writeUInt16LE(0, 0);                 // reservado
  cabecera.writeUInt16LE(1, 2);                 // 1 = icono
  cabecera.writeUInt16LE(TAMANOS.length, 4);
  let desplazamiento = cabecera.length;
  TAMANOS.forEach((lado, i) => {
    const o = 6 + 16 * i;
    cabecera[o] = lado >= 256 ? 0 : lado;       // 0 significa 256
    cabecera[o + 1] = lado >= 256 ? 0 : lado;
    cabecera.writeUInt16LE(1, o + 4);           // planos
    cabecera.writeUInt16LE(32, o + 6);          // bits por píxel
    cabecera.writeUInt32LE(pngs[i].length, o + 8);
    cabecera.writeUInt32LE(desplazamiento, o + 12);
    desplazamiento += pngs[i].length;
  });
  fs.writeFileSync(path.join(raiz, 'assets', 'icon.ico'), Buffer.concat([cabecera, ...pngs]));
  console.log('OK -> assets/icon.ico (' + TAMANOS.join(', ') + ' px)');
})().catch((e) => { console.error(e); process.exit(1); });
