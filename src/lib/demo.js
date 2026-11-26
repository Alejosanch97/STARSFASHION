/* =====================================================================
   MODO DEMO — un "Apps Script de mentiras" dentro del navegador.
   Mismas acciones y respuestas que Code.gs, guardado en localStorage y con
   latencia simulada para que se vean los badges de sincronización.
   Se activa solo cuando SCRIPT_URL está vacío.
   ===================================================================== */
import { todayStr, nowMin, addDays, toMin, toHHMM, dow, phoneNorm } from "./time";
import { busyOf, checkSlot, DEFAULT_LUNCH } from "./slots";

const KEY = "sf_demo_db_v1";
const HOURS = {
  0: { on: true, start: "10:00", end: "19:00" }, 1: { on: true, start: "09:00", end: "20:00" }, 2: { on: true, start: "09:00", end: "20:00" },
  3: { on: true, start: "09:00", end: "20:00" }, 4: { on: true, start: "09:00", end: "20:00" }, 5: { on: true, start: "09:00", end: "20:00" },
  6: { on: true, start: "09:00", end: "20:00" },
};
const CONFIG = {
  Negocio: "STARS FASHION", Slogan: "Barbería VIP · Bogotá", Direccion: "Carrera 56 #2A-14, Piso 1, Bogotá, Colombia",
  Maps_URL: "https://www.google.com/maps/search/?api=1&query=Carrera%2056%202a14,%20Bogot%C3%A1,%20Colombia",
  WhatsApp_1: "573022339159", WhatsApp_2: "573022339167", Instagram: "", Horario_Local: HOURS,
  Paso_Min: 15, Anticipacion_Min: 30, Dias_Reserva: 21, Sellos_Tarjeta: 10, Sello_Premio: 8, Premio_Texto: "SORPRESA", Llave_Pago: "@starsfashion",
};
const SERVICES = [
  ["S01", "CORTE DE CABALLERO", 50, 23000, "Experiencia clásica completa", "Corte de cabello|Perfilado de cejas|Aplicación de producto para el peinado|Lavado de cabello|Bebida caliente o fría", "Cortes", false],
  ["S02", "CORTE DE CABELLO CON DISEÑO FREESTYLE", 60, 28000, "Corte personalizado con diseño de líneas y siluetas, para los que se atreven un poco más", "Diseño de líneas y siluetas|Lavado de cabello|Perfilado de cejas|Aplicación de productos para el peinado|Bebida caliente o fría", "Cortes", false],
  ["S03", "CORTE DE CABELLO VIP", 120, 50000, "Corte + ritual facial de carbón y colágeno", "Corte de cabello|Perfilado de cejas|Exfoliación con mascarilla de carbono (impurezas y puntos negros)|Mascarilla de colágeno para restaurar la piel|Lavado de cabello|Aplicación de producto para el peinado|Bebida caliente o fría", "VIP", true],
  ["S04", "CORTE DE CABELLO Y PERFILADO DE BARBA", 70, 32000, "El combo favorito", "Corte de cabello y perfilado de barba|Aceite hidratante para barba|Perfilado de cejas|Lavado de cabello|Aplicación de producto para el peinado|Bebida caliente o fría", "Combos", false],
  ["S05", "CORTE DE CABELLO Y PERFILADO DE BARBA VIP", 180, 60000, "La experiencia total Stars", "Corte de cabello|Perfilado de barba|Perfilado de cejas|Exfoliación con mascarilla de carbono|Mascarilla de colágeno para restaurar la piel|Champú|Aplicación de producto para el peinado|Bebida caliente o fría", "VIP", true],
  ["S06", "LIMPIEZA FACIAL", 90, 35000, "Piel nueva en hora y media", "Apertura de poros con vapor ozono|Exfoliación|Mascarilla para puntos negros|Mascarilla de colágeno|Bebida fría o caliente", "Facial", false],
  ["S07", "PERFILADO DE BARBA", 30, 14000, "Barba impecable", "Perfilado de barba|Aceite hidratante para barba|Bebida caliente o fría", "Barba", false],
].map((r, i) => ({ Id: r[0], Nombre: r[1], Duracion_Min: r[2], Precio: r[3], Resumen: r[4], Incluye: r[5].split("|"), Categoria: r[6], Destacado: r[7], Orden: i + 1, Activo: true }));

const USERS = [
  { User_Id: "U001", Nombre: "Alejo · Control", Email: "super@starsfashion.co", Password: "Stars2026*", Rol: "superadmin", Estrellas: 5, Especialidad: "Soporte", Descripcion: "Cuenta de control y arreglos.", Color: "#231a20" },
  { User_Id: "U002", Nombre: "Dueño Stars", Email: "dueno@starsfashion.co", Password: "Stars2026*", Rol: "barber,owner", WhatsApp: "573022339159", Estrellas: 5, Especialidad: "Fade & diseño", Descripcion: "Fundador de Stars Fashion. Precisión y estilo en cada corte.", Color: "#8a2f4c" },
  { User_Id: "U003", Nombre: "Santiago", Email: "santiago@starsfashion.co", Password: "Stars2026*", Rol: "barber,admin", WhatsApp: "573022339167", Estrellas: 5, Especialidad: "Freestyle", Descripcion: "Diseños de líneas y siluetas. Si lo imaginas, lo cortamos.", Color: "#c08a2e", Almuerzo: { desde: "13:00", hasta: "15:00", min: 60 } },
  { User_Id: "U004", Nombre: "Kevin", Email: "kevin@starsfashion.co", Password: "Stars2026*", Rol: "barber", Estrellas: 4.8, Especialidad: "Barba & ritual VIP", Descripcion: "Especialista en barba, faciales y experiencia VIP.", Color: "#3f6ea6" },
].map((u, i) => ({ Foto_URL: "", Horario: HOURS, Almuerzo: DEFAULT_LUNCH, Activo: true, Orden: i, ...u }));

const NAMES = ["Juan Pablo", "Mateo", "Sebastián", "Nicolás", "Samuel", "David", "Felipe", "Tomás", "Daniel", "Camilo", "Esteban", "Julián", "Miguel", "Simón", "Andrés", "Brayan", "Cristian"];
const rnd = (n) => Math.floor(Math.random() * n);
const uid = (p) => p + Date.now().toString(36).toUpperCase() + rnd(1296).toString(36).toUpperCase();
const code = () => "SF-" + Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[rnd(32)]).join("");
const isBarber = (u) => String(u.Rol).includes("barber");
const roles = (r) => String(r || "").toLowerCase().split(/[,\s|]+/);
const manage = (u) => roles(u.Rol).some((x) => ["admin", "owner", "superadmin"].includes(x));
const owner = (u) => roles(u.Rol).some((x) => ["owner", "superadmin"].includes(x));

function seed() {
  const t = todayStr(), now = nowMin();
  const citas = [];
  for (let d = -27; d <= 3; d++) {
    const f = addDays(t, d);
    USERS.filter(isBarber).forEach((u) => {
      const h = u.Horario[dow(f)];
      let cur = toMin(h.start) + 15 * rnd(3);
      const end = toMin(h.end);
      while (cur < end - 30) {
        const sv = SERVICES[rnd(SERVICES.length)];
        if (cur + sv.Duracion_Min > end) break;
        if (cur >= 12 * 60 + 30 && cur < 13 * 60 + 30) { cur = 13 * 60 + 30; continue; }
        const density = d > 0 ? 0.35 : 0.62;
        if (Math.random() < density) {
          const past = d < 0 || (d === 0 && cur + sv.Duracion_Min < now);
          const r = Math.random();
          const estado = past ? (r < 0.86 ? "completada" : r < 0.94 ? "no_asistio" : "cancelada") : "reservada";
          citas.push({
            Id: uid("C") + citas.length, Codigo: code(), Fecha: f, Hora_Inicio: toHHMM(cur), Hora_Fin: toHHMM(cur + sv.Duracion_Min),
            Duracion_Min: sv.Duracion_Min, Barbero_Id: u.User_Id, Barbero_Nombre: u.Nombre, Servicio_Id: sv.Id, Servicio_Nombre: sv.Nombre,
            Precio: sv.Precio, Propina: estado === "completada" && Math.random() < 0.3 ? 5000 : 0, Cliente_Nombre: NAMES[rnd(NAMES.length)],
            Cliente_Telefono: "573" + (100000000 + rnd(899999999)), Cliente_Email: "", Estado: estado, Origen: Math.random() < 0.6 ? "cliente" : "barbero",
            Metodo_Pago: estado === "completada" ? (Math.random() < 0.55 ? "llave" : "efectivo") : "", Notas: "", Sello: estado === "completada",
            Creado: new Date().toISOString(), Actualizado: new Date().toISOString(),
          });
          cur += sv.Duracion_Min;
        } else cur += 30;
        cur = Math.ceil(cur / 15) * 15;
      }
    });
  }
  return {
    config: CONFIG, services: SERVICES, users: USERS, citas, bloqueos: [], mensajes: [],
    club: [{ Telefono: "573001112233", Nombre: "Cliente Demo", Email: "", Sellos: 7, Tarjetas_Completas: 1, Sellos_Totales: 17, Premio_Pendiente: false, Premios_Canjeados: 1 }],
  };
}

let DB = null;
function db() {
  if (DB) return DB;
  try { DB = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { DB = null; }
  if (!DB) { DB = seed(); save(); }
  return DB;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch { /* lleno */ } };
export function resetDemo() { DB = seed(); save(); }

const pub = (u, full) => {
  const { Password: _p, Email, ...rest } = u;
  return full ? { ...rest, Email } : rest;
};
const ok = (o = {}) => ({ status: "success", ...o });
const fail = (message, extra = {}) => ({ status: "error", message, ...extra });
const userById = (id) => db().users.find((u) => u.User_Id === String(id));
const sessionUser = (token) => { const u = userById(token); return u && u.Activo !== false ? u : null; };
const card = (tel) => db().club.find((c) => c.Telefono === tel);
const cardOut = (c) => c && { ...c, Max: db().config.Sellos_Tarjeta, Premio_En: db().config.Sello_Premio, Premio_Texto: db().config.Premio_Texto };
const busyFor = (bid, f, ex) => busyOf(bid, f, db(), ex);

function stamp(tel, delta = 1) {
  const c = card(tel);
  if (!c) return null;
  const cfg = db().config;
  const before = c.Sellos;
  c.Sellos = Math.max(0, c.Sellos + delta);
  if (delta > 0) c.Sellos_Totales += delta;
  if (delta > 0 && c.Sellos >= cfg.Sello_Premio && before < cfg.Sello_Premio) c.Premio_Pendiente = true;
  if (c.Sellos >= cfg.Sellos_Tarjeta) { c.Sellos = 0; c.Tarjetas_Completas++; }
  return c;
}
function complete(c) {
  c.Estado = "completada";
  c.Finalizada = new Date().toISOString();
  if (!c.Sello && c.Cliente_Telefono && stamp(phoneNorm(c.Cliente_Telefono))) c.Sello = true;
}
function autoComplete() {
  const t = todayStr(), n = nowMin();
  db().citas.forEach((c) => { if (c.Estado === "en_curso" && (c.Fecha < t || (c.Fecha === t && toMin(c.Hora_Fin) <= n))) complete(c); });
}
function join(tel, nombre, email) {
  let c = card(tel);
  if (!c) { c = { Telefono: tel, Nombre: nombre, Email: email || "", Sellos: 0, Tarjetas_Completas: 0, Sellos_Totales: 0, Premio_Pendiente: false, Premios_Canjeados: 0 }; db().club.push(c); }
  return c;
}
function newCita(sv, u, fecha, start, o) {
  const dur = o.dur || sv.Duracion_Min;
  const c = {
    Id: o.id && !String(o.id).startsWith("tmp") ? o.id : uid("C"), Codigo: code(), Fecha: fecha, Hora_Inicio: toHHMM(start), Hora_Fin: toHHMM(start + dur),
    Duracion_Min: dur, Barbero_Id: u.User_Id, Barbero_Nombre: u.Nombre, Servicio_Id: sv.Id, Servicio_Nombre: sv.Nombre,
    Precio: o.precio ?? sv.Precio, Propina: 0, Cliente_Nombre: o.nombre, Cliente_Telefono: o.tel || "", Cliente_Email: o.email || "",
    Estado: "reservada", Origen: o.origen, Metodo_Pago: "", Notas: o.notas || "", Sello: false,
    Creado: new Date().toISOString(), Actualizado: new Date().toISOString(),
  };
  db().citas.push(c);
  return c;
}

export async function demoCall(action, p) {
  await new Promise((r) => setTimeout(r, 280 + rnd(520)));
  const D = db();
  autoComplete();
  const out = run(action, p, D);
  save();
  return JSON.parse(JSON.stringify(out));
}

function run(a, p, D) {
  const t = todayStr();
  if (a === "ping") return ok({ app: "Stars Fashion (demo)" });

  if (a === "public") {
    const to = addDays(t, D.config.Dias_Reserva + 1);
    return ok({
      today: t, now: nowMin(), config: D.config, services: D.services,
      barbers: D.users.filter((u) => u.Activo !== false && isBarber(u)).map((u) => pub(u)),
      busy: [...D.citas.filter((c) => c.Fecha >= t && c.Fecha <= to && c.Estado !== "cancelada").map((c) => ({ id: c.Id, b: c.Barbero_Id, f: c.Fecha, s: c.Hora_Inicio, e: c.Hora_Fin })),
        ...D.bloqueos.map((b) => ({ b: b.Barbero_Id, f: b.Fecha, s: b.Hora_Inicio, e: b.Hora_Fin }))],
    });
  }

  if (a === "login") {
    const u = D.users.find((x) => x.Email.toLowerCase() === String(p.email || "").trim().toLowerCase());
    if (!u || u.Password !== p.password) return fail("Correo o contraseña incorrectos.");
    if (u.Activo === false) return fail("Este usuario está inactivo.");
    u.Ultimo_Login = new Date().toISOString();
    return ok({ token: u.User_Id, user: pub(u, true) });
  }

  if (a === "client_lookup") {
    const tel = phoneNorm(p.telefono);
    if (tel.length < 10) return fail("Escribe un celular válido.");
    return ok({
      citas: D.citas.filter((c) => phoneNorm(c.Cliente_Telefono) === tel && c.Fecha >= addDays(t, -45)),
      card: cardOut(card(tel)), mensajes: D.mensajes.filter((m) => m.Cliente_Telefono === tel).slice(-30),
    });
  }
  if (a === "push_subscribe") return ok();

  if (a === "book") {
    const b = p.booking || {};
    const tel = phoneNorm(b.telefono);
    if (!b.nombre) return fail("Escribe tu nombre.");
    if (tel.length < 10) return fail("Escribe un celular válido.");
    const sv = D.services.find((s) => s.Id === b.servicio_id);
    const u = userById(b.barbero_id);
    if (!sv || !u) return fail("Elige servicio y barbero.");
    const start = toMin(b.hora);
    const why = checkSlot(u, b.fecha, start, sv.Duracion_Min, busyFor(u.User_Id, b.fecha), { cfg: D.config });
    if (why) return fail(why, { code: "slot" });
    const cita = newCita(sv, u, b.fecha, start, { nombre: b.nombre, tel, email: b.email, notas: b.notas, origen: "cliente" });
    return ok({ cita, card: cardOut(b.club ? join(tel, b.nombre, b.email) : card(tel)) });
  }

  if (a === "client_cancel" || a === "client_reschedule") {
    const tel = phoneNorm(p.telefono);
    const c = D.citas.find((x) => x.Id === p.id);
    if (!c || phoneNorm(c.Cliente_Telefono) !== tel) return fail("No encontramos esa cita con tu celular.");
    if (c.Estado !== "reservada") return fail("Esta cita ya no se puede modificar.");
    if (a === "client_cancel") { c.Estado = "cancelada"; return ok({ cita: c }); }
    const u = userById(p.barbero_id || c.Barbero_Id);
    const start = toMin(p.hora);
    const why = checkSlot(u, p.fecha, start, c.Duracion_Min, busyFor(u.User_Id, p.fecha, c.Id), { cfg: D.config });
    if (why) return fail(why, { code: "slot" });
    Object.assign(c, { Fecha: p.fecha, Hora_Inicio: toHHMM(start), Hora_Fin: toHHMM(start + c.Duracion_Min), Barbero_Id: u.User_Id, Barbero_Nombre: u.Nombre });
    return ok({ cita: c });
  }

  if (a === "loyalty_join") {
    const tel = phoneNorm(p.telefono);
    if (tel.length < 10) return fail("Escribe un celular válido.");
    return ok({ card: cardOut(join(tel, p.nombre, p.email)) });
  }

  /* ---------- con sesión ---------- */
  const me = sessionUser(p.token);
  if (!me) return fail("Tu sesión expiró. Vuelve a entrar.", { code: "auth" });

  if (a === "bootstrap") {
    const from = p.from || addDays(t, -60), to = p.to || addDays(t, 30);
    const all = manage(me);
    return ok({
      today: t, now: nowMin(), me: pub(me, true), config: D.config, services: D.services,
      users: D.users.filter((u) => roles(me.Rol).includes("superadmin") || u.Activo !== false).map((u) => pub(u, owner(me))),
      citas: D.citas.filter((c) => c.Fecha >= from && c.Fecha <= to && (all || c.Barbero_Id === me.User_Id)),
      bloqueos: D.bloqueos.filter((b) => all || b.Barbero_Id === me.User_Id),
      clubCount: D.club.length,
    });
  }
  if (a === "loyalty") return ok({ cards: D.club.map(cardOut) });
  if (a === "client_find") {
    const tel = phoneNorm(p.telefono);
    const list = D.citas.filter((c) => phoneNorm(c.Cliente_Telefono) === tel).sort((x, y) => (y.Fecha + y.Hora_Inicio).localeCompare(x.Fecha + x.Hora_Inicio));
    const cd = card(tel);
    if (!list.length && !cd) return ok({ client: null });
    const last = list[0] || {};
    return ok({ client: { Nombre: last.Cliente_Nombre || cd?.Nombre || "", Email: list.find((c) => c.Cliente_Email)?.Cliente_Email || cd?.Email || "", Visitas: list.filter((c) => c.Estado === "completada").length, Ultimo_Servicio: last.Servicio_Nombre || "", Ultimo_Servicio_Id: last.Servicio_Id || "", Ultima_Fecha: last.Fecha || "", Sellos: cd ? cd.Sellos : undefined } });
  }

  if (a === "profile_save") {
    const x = p.profile || {};
    const target = x.User_Id && roles(me.Rol).includes("superadmin") ? userById(x.User_Id) : me;
    ["Nombre", "Estrellas", "Especialidad", "Descripcion", "Foto_URL", "Color", "Horario", "Almuerzo", "WhatsApp"].forEach((k) => { if (x[k] !== undefined) target[k] = x[k]; });
    return ok({ user: pub(target, true) });
  }
  if (a === "password_change") {
    if (me.Password !== p.actual) return fail("La contraseña actual no coincide.");
    if (String(p.nueva || "").length < 6) return fail("Mínimo 6 caracteres.");
    me.Password = p.nueva;
    return ok();
  }
  if (a === "block_save") {
    const b = p.block || {};
    const row = { ...b, Id: uid("B"), Barbero_Id: b.Barbero_Id || me.User_Id };
    D.bloqueos.push(row);
    return ok({ block: row, tmpId: b.Id });
  }
  if (a === "block_delete") { D.bloqueos = D.bloqueos.filter((b) => b.Id !== p.id); return ok(); }

  if (a === "appt_create") {
    const x = p.cita || {};
    const u = userById(x.Barbero_Id || me.User_Id);
    const sv = D.services.find((s) => s.Id === x.Servicio_Id);
    if (!u || !sv) return fail("Elige barbero y servicio.");
    if (!x.Cliente_Nombre) return fail("Escribe el nombre del cliente.");
    const start = toMin(x.Hora_Inicio), dur = Number(x.Duracion_Min) || sv.Duracion_Min;
    const why = checkSlot(u, x.Fecha, start, dur, busyFor(u.User_Id, x.Fecha), { cfg: D.config, force: !!p.force });
    if (why) return fail(why, { code: "slot" });
    const tel = phoneNorm(x.Cliente_Telefono);
    const cita = newCita(sv, u, x.Fecha, start, { nombre: x.Cliente_Nombre, tel, email: x.Cliente_Email, notas: x.Notas, origen: "barbero", dur, precio: x.Precio === "" || x.Precio === undefined ? undefined : Number(x.Precio), id: x.Id });
    if (x.club && tel.length >= 10) join(tel, x.Cliente_Nombre, x.Cliente_Email);
    return ok({ cita, tmpId: x.Id });
  }

  if (a === "appt_update") {
    const c = D.citas.find((x) => x.Id === p.id);
    if (!c) return fail("No encontramos la cita.");
    const ch = p.changes || {};
    if (ch.Fecha !== undefined || ch.Hora_Inicio !== undefined || ch.Barbero_Id !== undefined) {
      const u = userById(ch.Barbero_Id || c.Barbero_Id);
      const f = ch.Fecha || c.Fecha, s = toMin(ch.Hora_Inicio || c.Hora_Inicio);
      const why = checkSlot(u, f, s, c.Duracion_Min, busyFor(u.User_Id, f, c.Id), { cfg: D.config, force: true });
      if (why) return fail(why, { code: "slot" });
      Object.assign(c, { Fecha: f, Hora_Inicio: toHHMM(s), Hora_Fin: toHHMM(s + c.Duracion_Min), Barbero_Id: u.User_Id, Barbero_Nombre: u.Nombre });
      if (c.Cliente_Telefono) D.mensajes.push({ Id: uid("M"), Cita_Id: c.Id, Cliente_Telefono: phoneNorm(c.Cliente_Telefono), Barbero_Id: c.Barbero_Id, Barbero_Nombre: c.Barbero_Nombre, Tipo: "mover", Mensaje: `Tu cita se movió a ${c.Fecha} a las ${c.Hora_Inicio} con ${c.Barbero_Nombre}.`, Creado: new Date().toISOString() });
    }
    ["Metodo_Pago", "Notas", "Precio", "Propina"].forEach((k) => { if (ch[k] !== undefined) c[k] = ch[k]; });
    if (ch.Estado) { c.Estado = ch.Estado; if (ch.Estado === "en_curso") c.Llegada = new Date().toISOString(); }
    if (ch.Estado === "completada") complete(c);
    return ok({ cita: c, card: cardOut(card(phoneNorm(c.Cliente_Telefono))) });
  }

  if (a === "message_send") {
    const c = D.citas.find((x) => x.Id === p.cita_id);
    if (!c) return fail("No encontramos la cita.");
    const m = { Id: uid("M"), Cita_Id: c.Id, Cliente_Telefono: phoneNorm(c.Cliente_Telefono), Barbero_Id: c.Barbero_Id, Barbero_Nombre: me.Nombre, Tipo: p.tipo, Mensaje: p.mensaje, Creado: new Date().toISOString() };
    D.mensajes.push(m);
    return ok({ mensaje: m });
  }
  if (a === "stamp_add") { const c = stamp(phoneNorm(p.telefono), Number(p.delta) || 1); return c ? ok({ card: cardOut(c) }) : fail("Ese celular no está en el club."); }
  if (a === "loyalty_redeem") { const c = card(phoneNorm(p.telefono)); if (!c) return fail("No está en el club."); c.Premio_Pendiente = false; c.Premios_Canjeados++; return ok({ card: cardOut(c) }); }

  if (a === "user_save") {
    if (!roles(me.Rol).includes("superadmin")) return fail("Solo el super admin crea o edita cuentas.");
    const x = p.user || {};
    if (!x.Nombre || !x.Email) return fail("Nombre y correo son obligatorios.");
    let u = x.User_Id && userById(x.User_Id);
    if (D.users.some((z) => z.Email.toLowerCase() === x.Email.toLowerCase() && z !== u)) return fail("Ya existe un usuario con ese correo.");
    if (!u) {
      if (!x.Password) return fail("Ponle una contraseña inicial.");
      u = { User_Id: "U" + String(D.users.length + 1).padStart(3, "0") + rnd(36).toString(36).toUpperCase(), Estrellas: 5, Descripcion: "", Foto_URL: "", Color: "#8a2f4c", Horario: HOURS, Almuerzo: DEFAULT_LUNCH, Orden: D.users.length };
      D.users.push(u);
    }
    Object.assign(u, { Nombre: x.Nombre, Email: x.Email.toLowerCase(), Rol: x.Rol || "barber", Activo: x.Activo !== false, ...(x.Especialidad !== undefined ? { Especialidad: x.Especialidad } : {}), ...(x.Color ? { Color: x.Color } : {}), ...(x.WhatsApp !== undefined ? { WhatsApp: phoneNorm(x.WhatsApp) } : {}), ...(x.Password ? { Password: x.Password } : {}) });
    return ok({ user: pub(u, true) });
  }
  if (a === "service_save") {
    const x = p.service || {};
    const ex = D.services.find((s) => s.Id === x.Id);
    const row = { ...x, Duracion_Min: Number(x.Duracion_Min) || 30, Precio: Number(x.Precio) || 0, Incluye: Array.isArray(x.Incluye) ? x.Incluye : String(x.Incluye || "").split("|").filter(Boolean) };
    if (ex) Object.assign(ex, row); else D.services.push({ ...row, Id: uid("S"), Orden: D.services.length + 1, Activo: true });
    D.services = D.services.filter((s) => s.Activo !== false);
    return ok({ services: D.services });
  }
  if (a === "config_save") { Object.assign(D.config, p.config || {}); return ok({ config: D.config }); }

  return fail("Acción desconocida");
}
