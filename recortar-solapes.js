// Al añadir una reunión de Outlook, «la reunión manda» (decidido el 18-11-2026): lo que otras
// entradas tengan dentro del rato de la reunión se recorta, para que ese tiempo no cuente
// doble. Si una entrada cubre la reunión entera, se parte en dos alrededor de ella.
//
// La entrada en marcha (end: null) cuenta hasta `ahora`. Si queda cortada antes de ahora, deja
// de estar en marcha y se devuelve `paroLaActiva` para que quien llama lo refleje en el estado.
// `hasta` = null significa «la reunión sigue»: todo lo que haya desde `desde` se recorta.
//
// Modifica `tareas` en el sitio. Devuelve { tocadas, paroLaActiva }.
function recortarSolapes(tareas, desde, hasta, ahora) {
  const M1 = desde, M2 = hasta == null ? Infinity : hasta;
  let tocadas = 0, paroLaActiva = false;
  (tareas || []).forEach((t) => {
    if (!t || t.deleted || !Array.isArray(t.entries)) return;
    const nuevas = [];
    t.entries.forEach((e) => {
      const enMarcha = e.end == null;
      const A = e.start, B = enMarcha ? ahora : e.end;
      if (!(A < M2 && B > M1)) { nuevas.push(e); return; }   // no se solapa
      tocadas++;
      const antes = A < M1, despues = B > M2;
      if (antes) nuevas.push({ ...e, end: M1 });               // trozo de antes de la reunión
      if (despues) nuevas.push({ ...e, start: M2, end: enMarcha ? null : e.end });   // trozo de después
      // La que estaba en marcha deja de estarlo si no le queda trozo «después».
      if (enMarcha && !despues) paroLaActiva = true;
    });
    // La entrada en marcha tiene que seguir siendo la última de su tarea.
    const i = nuevas.findIndex((e) => e.end == null);
    if (i >= 0 && i !== nuevas.length - 1) nuevas.push(nuevas.splice(i, 1)[0]);
    t.entries = nuevas;
  });
  return { tocadas, paroLaActiva };
}

module.exports = { recortarSolapes };
