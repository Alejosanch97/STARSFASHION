/* Cálculos para dashboards y análisis */
import { addDays, weekStart, todayStr, toMin, nowMin, day3 } from "./time";

export const isDone = (c) => c.Estado === "completada";
export const isLive = (c) => c.Estado !== "cancelada" && c.Estado !== "no_asistio";
export const income = (c) => (isDone(c) ? (Number(c.Precio) || 0) + (Number(c.Propina) || 0) : 0);
export const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
export const byTime = (a, b) => (a.Fecha + a.Hora_Inicio).localeCompare(b.Fecha + b.Hora_Inicio);

export function range(kind, ref = todayStr()) {
  if (kind === "hoy") return { from: ref, to: ref, days: [ref] };
  if (kind === "semana") {
    const from = weekStart(ref);
    return { from, to: addDays(from, 6), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
  }
  if (kind === "mes") {
    const from = ref.slice(0, 8) + "01";
    const days = [];
    for (let d = from; d.slice(0, 7) === ref.slice(0, 7); d = addDays(d, 1)) days.push(d);
    return { from, to: days[days.length - 1], days };
  }
  const from = addDays(ref, -29);
  return { from, to: ref, days: Array.from({ length: 30 }, (_, i) => addDays(from, i)) };
}

export const inRange = (list, r) => list.filter((c) => c.Fecha >= r.from && c.Fecha <= r.to);

export function summary(list) {
  const done = list.filter(isDone);
  const rev = sum(done, income);
  return {
    total: list.filter(isLive).length,
    done: done.length,
    revenue: rev,
    tips: sum(done, (c) => Number(c.Propina) || 0),
    avg: done.length ? rev / done.length : 0,
    noShow: list.filter((c) => c.Estado === "no_asistio").length,
    canceled: list.filter((c) => c.Estado === "cancelada").length,
    projected: sum(list.filter((c) => c.Estado === "reservada" || c.Estado === "en_curso"), (c) => Number(c.Precio) || 0),
    llave: sum(done.filter((c) => c.Metodo_Pago === "llave"), income),
    efectivo: sum(done.filter((c) => c.Metodo_Pago === "efectivo"), income),
    minutes: sum(done, (c) => Number(c.Duracion_Min) || 0),
  };
}

export function perDay(list, days) {
  return days.map((d) => {
    const l = list.filter((c) => c.Fecha === d);
    const ing = sum(l, income);
    const hide = d > todayStr() && ing === 0;   // futuro sin ventas: no se dibuja
    return { day: d, label: days.length <= 7 ? day3(d) : String(Number(d.slice(8))), ingresos: hide ? null : ing, cortes: hide ? null : l.filter(isDone).length };
  });
}

export function perService(list) {
  const m = {};
  list.filter(isDone).forEach((c) => {
    const k = c.Servicio_Nombre || "Otro";
    m[k] = m[k] || { name: k, value: 0, count: 0 };
    m[k].value += income(c); m[k].count++;
  });
  return Object.values(m).sort((a, b) => b.value - a.value);
}

export function perHour(list) {
  const h = {};
  list.filter(isLive).forEach((c) => { const k = Math.floor(toMin(c.Hora_Inicio) / 60); h[k] = (h[k] || 0) + 1; });
  return Array.from({ length: 13 }, (_, i) => i + 8).map((k) => ({ label: `${k % 12 || 12}${k < 12 ? "a" : "p"}`, citas: h[k] || 0 }));
}

export function perBarber(list, users) {
  return users.map((u) => {
    const l = list.filter((c) => c.Barbero_Id === u.User_Id);
    const s = summary(l);
    return { user: u, id: u.User_Id, name: u.Nombre.split(" ")[0], ...s };
  }).sort((a, b) => b.done - a.done || b.revenue - a.revenue);
}

/** próxima cita (o la que está en silla) */
export function nextUp(list, ref = todayStr()) {
  const n = nowMin();
  const today = list.filter((c) => c.Fecha === ref).sort(byTime);
  const live = today.find((c) => c.Estado === "en_curso");
  const next = today.find((c) => c.Estado === "reservada" && toMin(c.Hora_Fin) > n);
  const later = !next ? list.filter((c) => c.Fecha > ref && c.Estado === "reservada").sort(byTime)[0] : null;
  return { live, next: next || later || null };
}
