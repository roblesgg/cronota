// Paletas de las secciones (2.8). Cada sección puede llevar una; las tareas que se crean en
// ella reciben un color al azar de esa paleta, así las de un mismo cliente se reconocen de un
// vistazo en el calendario sin ser todas idénticas.
//
// Los tonos tienen cuerpo suficiente para leerse como bloque tintado tanto en Noche cálida
// como en Luz (el calendario los pinta mezclados con el fondo, no a pleno color).
const GROUP_PALETTES = {
  azules:    { name: 'Azules',    colors: ['#7db0ff', '#5b9bff', '#4f8df5', '#60a5fa', '#8ec5ff', '#3b82f6'] },
  turquesas: { name: 'Turquesas', colors: ['#5fd8be', '#2fbfa3', '#1fae91', '#22d3ee', '#7fd8c6', '#06b6d4'] },
  verdes:    { name: 'Verdes',    colors: ['#5fd8a8', '#34d399', '#10b981', '#86efac', '#4ade80', '#22c55e'] },
  ambar:     { name: 'Ámbar',     colors: ['#f7c766', '#f2b33d', '#fbbf24', '#fcd34d', '#e5a126', '#f59e0b'] },
  naranjas:  { name: 'Naranjas',  colors: ['#ff9f5a', '#ffb383', '#fb923c', '#fdba74', '#ff8a3d', '#f97316'] },
  rojos:     { name: 'Rojos',     colors: ['#ff8f8f', '#f87171', '#fb7185', '#fca5a5', '#ef4444', '#e5484d'] },
  rosas:     { name: 'Rosas',     colors: ['#ff9cc0', '#ff7faa', '#f472b6', '#f9a8d4', '#f2658f', '#ec4899'] },
  violetas:  { name: 'Violetas',  colors: ['#b9a2ff', '#9b7bff', '#a78bfa', '#c4b5fd', '#8b67f5', '#8b5cf6'] },
  grises:    { name: 'Grises',    colors: ['#a1a1aa', '#94a3b8', '#9ca3af', '#b4b4bc', '#a8a29e', '#78716c'] },
  // 2.15: más variedad, mezclando familias para que en una misma sección se distingan más.
  oceano:    { name: 'Océano',    colors: ['#38bdf8', '#0ea5e9', '#22d3ee', '#2dd4bf', '#60a5fa', '#0891b2'] },
  bosque:    { name: 'Bosque',    colors: ['#4ade80', '#16a34a', '#84cc16', '#65a30d', '#a3e635', '#15803d'] },
  atardecer: { name: 'Atardecer', colors: ['#fb923c', '#f472b6', '#fbbf24', '#f87171', '#e879f9', '#f97316'] },
  tierra:    { name: 'Tierra',    colors: ['#d6a36a', '#b07c4f', '#c2925e', '#a16207', '#d4a373', '#8d6e63'] },
  vino:      { name: 'Vino',      colors: ['#e11d48', '#be123c', '#db2777', '#9f1239', '#f43f5e', '#c026d3'] },
  pastel:    { name: 'Pastel',    colors: ['#a5b4fc', '#99f6e4', '#fde68a', '#fbcfe8', '#bbf7d0', '#c7d2fe'] },
  vivos:     { name: 'Vivos',     colors: ['#22d3ee', '#a3e635', '#facc15', '#fb7185', '#c084fc', '#f97316'] },
  noche:     { name: 'Noche',     colors: ['#6366f1', '#4f46e5', '#7c3aed', '#2563eb', '#4338ca', '#6d28d9'] },
  arcoiris:  { name: 'Arcoíris',  colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'] },
  sobrios:   { name: 'Sobrios',   colors: ['#64748b', '#0f766e', '#1e40af', '#7c2d12', '#4d7c0f', '#6b21a8'] },
};

// Un color al azar de la paleta, prefiriendo los que todavía no lleva ninguna tarea de la
// sección (`enUso`): con seis tonos por paleta, las primeras seis salen todas distintas.
// Devuelve null si la paleta no existe (la sección no tiene paleta).
// `todas` (2.15): las de serie más las personalizadas del usuario.
function colorFromGroupPalette(key, enUso = [], azar = Math.random, todas = GROUP_PALETTES) {
  const p = todas[key];
  if (!p || !Array.isArray(p.colors) || !p.colors.length) return null;
  const usados = new Set((enUso || []).map(c => String(c || '').toLowerCase()));
  const libres = p.colors.filter(c => !usados.has(c));
  const lista = libres.length ? libres : p.colors;
  return lista[Math.floor(azar() * lista.length) % lista.length];
}

module.exports = { GROUP_PALETTES, colorFromGroupPalette };
