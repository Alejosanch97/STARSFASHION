/* Fechas y horas siempre en hora de Bogotá, como texto "YYYY-MM-DD" y "HH:mm" */
export const TZ = "America/Bogota";

const dFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const tFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const todayStr = () => dFmt.format(new Date());
export const nowMin = () => toMin(tFmt.format(new Date()));

export const toMin = (s) => {
  const [h, m] = String(s || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const toHHMM = (m) => {
  m = Math.round(m);
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
};
export const addDays = (f, n) => {
  const [y, mo, d] = f.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
};
export const dow = (f) => new Date(f + "T12:00:00Z").getUTCDay();
export const diffDays = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);

/** lunes de la semana de la fecha */
export const weekStart = (f) => addDays(f, -((dow(f) + 6) % 7));

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAYS3 = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export { DAYS, DAYS3, MONTHS };

export const dayName = (f) => DAYS[dow(f)];
export const day3 = (f) => DAYS3[dow(f)];
export const dayNum = (f) => Number(f.slice(8, 10));
export const month3 = (f) => MONTHS3[Number(f.slice(5, 7)) - 1];
export const monthName = (f) => MONTHS[Number(f.slice(5, 7)) - 1];

/** "Hoy", "Mañana", o "Jueves 27 de noviembre" */
export function prettyDate(f, { short = false } = {}) {
  const t = todayStr();
  if (f === t) return "Hoy";
  if (f === addDays(t, 1)) return "Mañana";
  if (f === addDays(t, -1)) return "Ayer";
  return short ? `${day3(f)} ${dayNum(f)} ${month3(f)}` : `${dayName(f)} ${dayNum(f)} de ${monthName(f)}`;
}

/** "9:30 am" */
export function h12(hhmm) {
  const m = toMin(hhmm);
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  return `${h % 12 || 12}:${mm} ${h < 12 ? "am" : "pm"}`;
}

export const durLabel = (min) => {
  min = Number(min) || 0;
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");
export const kMoney = (n) => {
  n = Number(n) || 0;
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".0", "") + "M";
  if (n >= 1e3) return "$" + Math.round(n / 1e3) + "k";
  return "$" + n;
};

export const phoneNorm = (p) => {
  let d = String(p || "").replace(/\D/g, "");
  if (d.length === 10 && d[0] === "3") d = "57" + d;
  return d;
};
export const phonePretty = (p) => {
  const d = phoneNorm(p);
  const n = d.startsWith("57") ? d.slice(2) : d;
  return n.length === 10 ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : p;
};
export const waLink = (phone, text = "") => `https://wa.me/${phoneNorm(phone)}${text ? "?text=" + encodeURIComponent(text) : ""}`;

/** "CORTE DE CABALLERO" → "Corte de caballero" */
export const nice = (s) => { s = String(s || "").toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
