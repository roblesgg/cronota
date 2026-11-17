// Movimiento común de toda la app (Fase 2 del roadmap, 2.11).
//
// Pequeñas animaciones con la Web Animations API, todas cortas y que terminan solas: nada
// infinito (gastaba CPU con el panel plegado). Con «reducir movimiento» de Windows no se
// anima nada. Duraciones y curvas iguales a las de mac.css (--ease, --spring, --t).
(function () {
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';
  const SPRING = 'cubic-bezier(.34, 1.56, .64, 1)';
  let reducido = false;
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducido = mq.matches;
    mq.addEventListener('change', (e) => { reducido = e.matches; });
  } catch {}

  const puede = (el) => !reducido && el && typeof el.animate === 'function' && el.isConnected;
  const anima = (el, frames, opts) => {
    if (!puede(el)) return null;
    try { return el.animate(frames, { duration: 260, easing: EASE, ...opts }); } catch { return null; }
  };

  // FLIP para listas que se rehacen enteras (innerHTML = '' y vuelta a pintar): antes de
  // rehacer, fotos(); después, flip(). Las filas que ya estaban se deslizan de su sitio viejo
  // al nuevo; las nuevas entran con su animación de siempre (macRise).
  function fotos(contenedor, atributo) {
    const mapa = new Map();
    if (!contenedor || reducido) return mapa;
    contenedor.querySelectorAll(`[${atributo}]`).forEach((el) => {
      mapa.set(el.getAttribute(atributo), el.getBoundingClientRect());
    });
    return mapa;
  }
  function flip(contenedor, atributo, antes) {
    if (!contenedor || reducido || !antes || !antes.size) return;
    contenedor.querySelectorAll(`[${atributo}]`).forEach((el) => {
      const r0 = antes.get(el.getAttribute(atributo));
      if (!r0) return;
      const r1 = el.getBoundingClientRect();
      const dx = r0.left - r1.left, dy = r0.top - r1.top;
      // La que ya estaba no vuelve a «entrar»: solo se mueve si cambió de sitio.
      el.style.animation = 'none';
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      anima(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 340 });
    });
  }

  // Cambio de contenido hacia un lado (semana siguiente, otra categoría...): dir 1 = viene de
  // la derecha, -1 = de la izquierda.
  function deslizar(el, dir) {
    anima(el, [
      { opacity: 0, transform: `translateX(${(dir || 1) * 22}px)` },
      { opacity: 1, transform: 'none' },
    ], { duration: 280 });
  }

  // Un toque de muelle para algo que acaba de cambiar (la tarjeta de la tarea en marcha).
  function latido(el) {
    anima(el, [{ transform: 'scale(.97)' }, { transform: 'scale(1.01)', offset: .6 }, { transform: 'none' }],
      { duration: 360, easing: SPRING });
  }

  // Aparece desde un poco más abajo (algo que se acaba de enseñar).
  function aparece(el) {
    anima(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240 });
  }

  // Abre o pliega un bloque animando su alto. Al plegar, llama a hecho() cuando termina
  // (para quitarlo de verdad o repintar).
  function plegar(el, abrir, hecho) {
    if (!puede(el)) { if (hecho) hecho(); return; }
    const alto = el.scrollHeight;
    const a = anima(el, abrir
      ? [{ height: '0px', opacity: 0 }, { height: alto + 'px', opacity: 1 }]
      : [{ height: alto + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
    { duration: abrir ? 260 : 200, easing: abrir ? EASE : 'cubic-bezier(.4, 0, 1, 1)' });
    if (!a) { if (hecho) hecho(); return; }
    el.style.overflow = 'hidden';
    a.onfinish = a.oncancel = () => { el.style.overflow = ''; if (hecho) hecho(); };
  }

  window.Mov = { fotos, flip, deslizar, latido, aparece, plegar, get reducido() { return reducido; } };
})();
