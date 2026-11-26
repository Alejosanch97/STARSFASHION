/* =====================================================================
   MOTOR DE DISPONIBILIDAD (misma lógica que checkSlot_ en Code.gs)
   - horario del barbero por día
   - citas y bloqueos ocupan
   - ALMUERZO FLEXIBLE: el barbero define una ventana (ej. 12:00–15:00) y
     cuánto dura su almuerzo (60 min). Las reservas pueden caer dentro de la
     ventana siempre que quede un hueco libre de 60 min para almorzar.
   ===================================================================== */
import { toMin, toHHMM, dow, todayStr, nowMin, addDays } from "./time";

export const DEFAULT_LUNCH = { desde: "12:00", hasta: "15:00", min: 60 };

export function dayHours(barber, fecha) {
  const h = (barber?.Horario || {})[String(dow(fecha))];
  if (!h || !h.on) return null;
  return { start: toMin(h.start), end: toMin(h.end) };
}

/** intervalos ocupados de un barbero en una fecha.
 *  src: { citas?, bloqueos?, busy? }  (busy = lista pública {b,f,s,e}) */
export function busyOf(barberId, fecha, src, excludeId) {
  const out = [];
  (src.citas || []).forEach((c) => {
    if (String(c.Barbero_Id) === String(barberId) && c.Fecha === fecha && c.Estado !== "cancelada" && String(c.Id) !== String(excludeId || ""))
      out.push({ s: toMin(c.Hora_Inicio), e: toMin(c.Hora_Fin), kind: "cita", ref: c });
  });
  (src.bloqueos || []).forEach((b) => {
    if (String(b.Barbero_Id) === String(barberId) && b.Fecha === fecha)
      out.push({ s: toMin(b.Hora_Inicio), e: toMin(b.Hora_Fin), kind: "bloqueo", ref: b });
  });
  (src.busy || []).forEach((x) => {
    if (String(x.b) === String(barberId) && x.f === fecha && String(x.id || "") !== String(excludeId || ""))
      out.push({ s: toMin(x.s), e: toMin(x.e), kind: "busy" });
  });
  return out;
}

function clip(lunch, busy) {
  const lf = toMin(lunch.desde), lt = toMin(lunch.hasta);
  return {
    lf, lt,
    list: busy.filter((i) => i.e > lf && i.s < lt).map((i) => ({ s: Math.max(i.s, lf), e: Math.min(i.e, lt) })).sort((a, b) => a.s - b.s),
  };
}

export function hasLunchGap(lunch, busy) {
  return !!lunchPlacement(lunch, busy);
}

/** dónde cae el almuerzo hoy: primer hueco libre suficiente dentro de la ventana */
export function lunchPlacement(lunch, busy) {
  if (!lunch || !(Number(lunch.min) > 0)) return null;
  const need = Number(lunch.min);
  const { lf, lt, list } = clip(lunch, busy);
  let cur = lf;
  for (const i of list) {
    if (i.s - cur >= need) return { s: cur, e: cur + need };
    cur = Math.max(cur, i.e);
  }
  return lt - cur >= need ? { s: cur, e: cur + need } : null;
}

/** '' si el hueco sirve; si no, el motivo */
export function checkSlot(barber, fecha, start, dur, busy, { cfg = {}, force = false } = {}) {
  const end = start + dur;
  if (busy.some((i) => start < i.e && end > i.s)) return "Ese horario ya está ocupado.";
  if (force) return "";
  const t = todayStr();
  if (fecha < t) return "Esa fecha ya pasó.";
  if (fecha === t && start < nowMin() + (Number(cfg.Anticipacion_Min) || 0)) return "Esa hora ya pasó.";
  if (cfg.Dias_Reserva && fecha > addDays(t, Number(cfg.Dias_Reserva))) return "Aún no abrimos agenda para esa fecha.";
  const h = dayHours(barber, fecha);
  if (!h) return "No atiende ese día.";
  if (start < h.start || end > h.end) return "Fuera del horario.";
  const lunch = barber.Almuerzo || DEFAULT_LUNCH;
  if (lunch && Number(lunch.min) > 0 && end > toMin(lunch.desde) && start < toMin(lunch.hasta)) {
    if (!hasLunchGap(lunch, busy.concat([{ s: start, e: end }]))) return "Es la hora de almuerzo.";
  }
  return "";
}

/** horas libres para un servicio de `dur` minutos */
export function slotsFor(barber, fecha, dur, busy, opts = {}) {
  const h = dayHours(barber, fecha);
  const step = Number(opts.cfg?.Paso_Min) || 15;
  if (!h && !opts.force) return [];
  const start = h ? h.start : 7 * 60, end = h ? h.end : 21 * 60;
  const out = [];
  for (let t = Math.ceil(start / step) * step; t + dur <= (opts.force ? Math.max(end, 21 * 60) : end); t += step) {
    if (!checkSlot(barber, fecha, t, dur, busy, opts)) out.push(t);
  }
  return out;
}

/** primer hueco libre después de `after` (para "mover a la siguiente hora") */
export function nextFree(barber, fecha, after, dur, busy, opts = {}) {
  const s = slotsFor(barber, fecha, dur, busy, opts).filter((t) => t >= after);
  return s.length ? s[0] : null;
}

export const groupSlots = (mins) => {
  const g = { "En la mañana": [], "En la tarde": [], "En la noche": [] };
  mins.forEach((m) => (m < 12 * 60 ? g["En la mañana"] : m < 18 * 60 ? g["En la tarde"] : g["En la noche"]).push(m));
  return Object.entries(g).filter(([, v]) => v.length);
};

export { toHHMM };
