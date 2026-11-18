// Calendario de Outlook por enlace ICS (Fase 3, 2.12).
//
// Sin registrar ninguna app ni iniciar sesión: Outlook deja «Publicar un calendario» y da un
// enlace .ics de solo lectura. Cronota lo descarga cada poco y saca las reuniones de la
// semana para enseñarlas en su calendario. El enlace y la última copia se guardan solo en
// este equipo (carpeta de datos de la app).
//
// Lo que entiende del formato iCalendar (RFC 5545), lo que usa Outlook:
//   - VEVENT con DTSTART/DTEND (o DURATION), SUMMARY, LOCATION, UID, STATUS.
//   - Horas en UTC («Z») o con TZID. Las de TZID se toman como hora de este PC: Outlook pone
//     nombres de zona de Windows («Romance Standard Time») y casi siempre es la misma zona.
//   - Reuniones periódicas (RRULE): DAILY, WEEKLY, MONTHLY y YEARLY con INTERVAL, COUNT,
//     UNTIL, BYDAY (con número: 2TU, -1FR), BYMONTHDAY y BYSETPOS; EXDATE y las ocurrencias
//     cambiadas sueltas (RECURRENCE-ID).
//   - Se saltan las de todo el día y las canceladas.
const fs = require('fs');
const path = require('path');

const DIAS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const MAX_VUELTAS = 5000;

// ── Lectura del texto ─────────────────────────────────────────────────────────
function desplegar(texto) {
  // Las líneas largas siguen en la siguiente empezando por un espacio o tabulador.
  return String(texto || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
function desescapar(v) {
  return String(v || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}
function propiedad(linea) {
  const dos = linea.indexOf(':');
  if (dos < 0) return null;
  const cabeza = linea.slice(0, dos);
  const valor = linea.slice(dos + 1);
  const trozos = cabeza.split(';');
  const params = {};
  trozos.slice(1).forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) params[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, '');
  });
  return { nombre: trozos[0].toUpperCase(), params, valor };
}

// «20261118T093000Z» → instante UTC; «20261118T093000» → hora de este PC; «20261118» → día.
function fecha(valor, params) {
  const v = String(valor || '').trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { ms: new Date(+y, +mo - 1, +d).getTime(), diaEntero: true };
  if (z) return { ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)), diaEntero: false };
  return { ms: new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0)).getTime(), diaEntero: !!(params && params.VALUE === 'DATE') };
}
function duracion(v) {
  const m = String(v || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const ms = (((+(m[2] || 0) * 7 + +(m[3] || 0)) * 24 + +(m[4] || 0)) * 60 + +(m[5] || 0)) * 60000 + +(m[6] || 0) * 1000;
  return m[1] === '-' ? -ms : ms;
}

function leerEventos(texto) {
  const eventos = [];
  let ev = null;
  for (const linea of desplegar(texto)) {
    if (linea === 'BEGIN:VEVENT') { ev = { exdates: [] }; continue; }
    if (linea === 'END:VEVENT') { if (ev) eventos.push(ev); ev = null; continue; }
    if (!ev) continue;
    const p = propiedad(linea);
    if (!p) continue;
    switch (p.nombre) {
      case 'UID': ev.uid = p.valor.trim(); break;
      case 'SUMMARY': ev.titulo = desescapar(p.valor); break;
      case 'LOCATION': ev.lugar = desescapar(p.valor); break;
      case 'STATUS': ev.estado = p.valor.trim().toUpperCase(); break;
      case 'DTSTART': ev.inicio = fecha(p.valor, p.params); break;
      case 'DTEND': ev.fin = fecha(p.valor, p.params); break;
      case 'DURATION': ev.duracion = duracion(p.valor); break;
      case 'RRULE': ev.rrule = p.valor.trim(); break;
      case 'RECURRENCE-ID': ev.recurrenceId = fecha(p.valor, p.params); break;
      case 'EXDATE': p.valor.split(',').forEach((x) => { const f = fecha(x, p.params); if (f) ev.exdates.push(f.ms); }); break;
      default: break;
    }
  }
  return eventos;
}

// ── Reuniones periódicas ──────────────────────────────────────────────────────
function leerRegla(texto) {
  const r = {};
  String(texto || '').split(';').forEach((par) => {
    const [k, v] = par.split('=');
    if (k && v !== undefined) r[k.toUpperCase()] = v;
  });
  return {
    freq: r.FREQ,
    intervalo: Math.max(1, parseInt(r.INTERVAL, 10) || 1),
    cuenta: r.COUNT ? parseInt(r.COUNT, 10) : null,
    hasta: r.UNTIL ? (fecha(r.UNTIL) || {}).ms : null,
    porDia: r.BYDAY ? r.BYDAY.split(',').map((d) => {
      const m = d.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
      return m ? { n: m[1] ? parseInt(m[1], 10) : null, dia: DIAS[m[2]] } : null;
    }).filter(Boolean) : [],
    porDiaMes: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map((x) => parseInt(x, 10)).filter((x) => x) : [],
    porPos: r.BYSETPOS ? parseInt(r.BYSETPOS, 10) : null,
  };
}

// Día del mes del n-ésimo `dia` de la semana (n negativo cuenta desde el final). null si no hay.
function enesimoDia(anio, mes, dia, n) {
  const dias = [];
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  for (let d = 1; d <= ultimo; d++) if (new Date(anio, mes, d).getDay() === dia) dias.push(d);
  const i = n > 0 ? n - 1 : dias.length + n;
  return dias[i] || null;
}

// Fechas (a la hora de inicio original, hora de este PC) de una reunión periódica, en orden,
// hasta `limite`. Respeta COUNT contando también las de antes del rango.
function ocurrencias(inicioMs, regla, limite) {
  const base = new Date(inicioMs);
  const h = base.getHours(), mi = base.getMinutes(), s = base.getSeconds();
  const fin = Math.min(limite, regla.hasta || Infinity);
  const res = [];
  const mete = (d) => {
    const ms = d.getTime();
    if (ms < inicioMs || ms > fin) return ms <= fin;
    res.push(ms);
    return !(regla.cuenta && res.length >= regla.cuenta);
  };
  const enDia = (y, m, d) => new Date(y, m, d, h, mi, s);

  for (let k = 0; k < MAX_VUELTAS; k++) {
    let candidatos = [];
    if (regla.freq === 'DAILY') {
      const d = enDia(base.getFullYear(), base.getMonth(), base.getDate() + k * regla.intervalo);
      if (!regla.porDia.length || regla.porDia.some((x) => x.dia === d.getDay())) candidatos.push(d);
      else if (d.getTime() > fin) break;
    } else if (regla.freq === 'WEEKLY') {
      // Semana empezando en lunes (lo que usa Outlook).
      const lunes = new Date(base.getFullYear(), base.getMonth(), base.getDate() - ((base.getDay() + 6) % 7) + k * 7 * regla.intervalo);
      const dias = regla.porDia.length ? regla.porDia.map((x) => x.dia) : [base.getDay()];
      candidatos = dias.map((dia) => enDia(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + ((dia + 6) % 7)))
        .sort((a, b) => a - b);
      if (lunes.getTime() > fin) break;
    } else if (regla.freq === 'MONTHLY' || regla.freq === 'YEARLY') {
      const anual = regla.freq === 'YEARLY';
      const y = base.getFullYear() + (anual ? k * regla.intervalo : 0);
      const m = anual ? base.getMonth() : base.getMonth() + k * regla.intervalo;
      const primero = new Date(y, m, 1);
      if (primero.getTime() > fin) break;
      const Y = primero.getFullYear(), M = primero.getMonth();
      const ultimo = new Date(Y, M + 1, 0).getDate();
      let dias = [];
      if (regla.porDiaMes.length) dias = regla.porDiaMes.map((d) => (d > 0 ? d : ultimo + d + 1));
      else if (regla.porDia.length) {
        regla.porDia.forEach((x) => {
          if (x.n) { const d = enesimoDia(Y, M, x.dia, x.n); if (d) dias.push(d); }
          else for (let d = 1; d <= ultimo; d++) if (new Date(Y, M, d).getDay() === x.dia) dias.push(d);
        });
        dias.sort((a, b) => a - b);
        if (regla.porPos) { const i = regla.porPos > 0 ? regla.porPos - 1 : dias.length + regla.porPos; dias = dias[i] ? [dias[i]] : []; }
      } else dias = [base.getDate()];
      candidatos = dias.filter((d) => d >= 1 && d <= ultimo).map((d) => enDia(Y, M, d));
    } else {
      break;   // frecuencia que no se entiende: solo la primera
    }
    let sigue = true;
    for (const c of candidatos) { if (!mete(c)) { sigue = false; break; } }
    if (!sigue) break;
  }
  return res;
}

// Reuniones entre desde y hasta (ms): [{ id, titulo, lugar, inicio, fin }].
function reunionesEntre(texto, desde, hasta) {
  const eventos = leerEventos(texto).filter((e) => e.inicio && !e.inicio.diaEntero);
  const cambiadas = new Map();   // uid → Map(instante original → evento que lo sustituye)
  eventos.filter((e) => e.recurrenceId).forEach((e) => {
    if (!cambiadas.has(e.uid)) cambiadas.set(e.uid, new Map());
    cambiadas.get(e.uid).set(e.recurrenceId.ms, e);
  });
  const res = [];
  const mete = (e, inicio) => {
    if (e.estado === 'CANCELLED') return;
    const largo = e.fin ? e.fin.ms - e.inicio.ms : (e.duracion != null ? e.duracion : 30 * 60000);
    const fin = inicio + Math.max(0, largo);
    if (fin <= desde || inicio >= hasta || fin <= inicio) return;
    res.push({ id: `${e.uid || e.titulo}@${inicio}`, titulo: e.titulo || '(sin título)', lugar: e.lugar || '', inicio, fin });
  };
  eventos.forEach((e) => {
    if (e.recurrenceId) { mete(e, e.inicio.ms); return; }
    if (!e.rrule) { mete(e, e.inicio.ms); return; }
    const sueltas = cambiadas.get(e.uid);
    const largo = e.fin ? e.fin.ms - e.inicio.ms : 0;
    ocurrencias(e.inicio.ms, leerRegla(e.rrule), hasta).forEach((ms) => {
      if (ms + largo <= desde) return;
      if (e.exdates.includes(ms)) return;
      if (sueltas && sueltas.has(ms)) return;   // esa va con su versión cambiada
      mete(e, ms);
    });
  });
  return res.sort((a, b) => a.inicio - b.inicio);
}

// ── Descarga ──────────────────────────────────────────────────────────────────
function urlValida(url) {
  const u = String(url || '').trim().replace(/^webcal:\/\//i, 'https://');
  return /^https:\/\/\S+$/i.test(u) ? u : null;
}

function crear({ carpeta, alCambiar, fetchFn }) {
  const copia = path.join(carpeta, 'outlook-calendario.ics');
  let texto = '';
  try { texto = fs.readFileSync(copia, 'utf8'); } catch {}
  let url = null, temporizador = null, estado = { ok: !!texto, error: null, cuando: null };

  async function descargar() {
    if (!url) return estado;
    try {
      const r = await fetchFn(url, { headers: { Accept: 'text/calendar' } });
      if (!r.ok) throw new Error(`El servidor contestó ${r.status}`);
      const nuevo = await r.text();
      if (!/BEGIN:VCALENDAR/.test(nuevo)) throw new Error('El enlace no devuelve un calendario (¿es el vínculo ICS?)');
      const cambia = nuevo !== texto;
      texto = nuevo;
      try { fs.writeFileSync(copia, nuevo); } catch {}
      estado = { ok: true, error: null, cuando: Date.now() };
      if (cambia && alCambiar) alCambiar();
    } catch (e) {
      estado = { ok: !!texto, error: String((e && e.message) || e), cuando: Date.now() };
    }
    return estado;
  }

  function configurar(nuevaUrl) {
    const u = urlValida(nuevaUrl);
    if (u === url) return;
    url = u;
    if (temporizador) { clearInterval(temporizador); temporizador = null; }
    if (!url) {
      texto = ''; estado = { ok: false, error: null, cuando: null };
      try { fs.unlinkSync(copia); } catch {}
      if (alCambiar) alCambiar();
      return;
    }
    descargar();
    temporizador = setInterval(descargar, 15 * 60000);   // cada 15 min
  }

  return {
    configurar,
    descargar,
    estado: () => ({ ...estado, conectado: !!url }),
    reuniones: (desde, hasta) => (url && texto ? reunionesEntre(texto, desde, hasta) : []),
  };
}

module.exports = { crear, reunionesEntre, urlValida, _ocurrencias: ocurrencias, _leerRegla: leerRegla };
