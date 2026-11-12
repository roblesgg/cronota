// Reduce el logo (assets/icon.png, 1080×1080 con transparencia) a un tamaño pequeño sin que
// salga dentado ni con un cerco oscuro. Lo usan make-icon-ico.js y make-appx-assets.js.
//
// - Dentado: bajar de golpe de 1080 a 16 px se salta casi todos los píxeles. Se va bajando a
//   la mitad mientras se pueda y el último paso es bicúbico.
// - Cerco oscuro: los píxeles transparentes son negro con alfa 0, y al mezclar se cuela ese
//   negro en el borde. Se reduce con el color multiplicado por su alfa y luego se deshace.
const Jimp = require('jimp');

function multiplicarAlfa(img, deshacer) {
  const d = img.bitmap.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (deshacer) {
      if (a === 0) { d[i] = d[i + 1] = d[i + 2] = 0; continue; }
      for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, Math.round(d[i + k] * 255 / a));
    } else {
      for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] * a / 255);
    }
  }
  return img;
}

function reducirLogo(logo, lado) {
  let a = multiplicarAlfa(logo.clone(), false);
  while (a.bitmap.width / 2 >= lado * 1.5) {
    a = a.resize(Math.round(a.bitmap.width / 2), Math.round(a.bitmap.height / 2), Jimp.RESIZE_BILINEAR);
  }
  a = a.resize(lado, lado, Jimp.RESIZE_BICUBIC);
  return multiplicarAlfa(a, true);
}

module.exports = { reducirLogo };
