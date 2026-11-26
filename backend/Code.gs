/**
 * =====================================================================
 *  STARS FASHION · BARBERÍA VIP — BACKEND (Google Apps Script)
 *  Base de datos: Google Sheets "STARSFASHION"
 *
 *  Hojas (se crean solas con setupStars):
 *    Users         → barberos, dueño y super admin (tú creas las cuentas aquí)
 *    Services      → catálogo de servicios (duración y precio)
 *    Citas         → todas las reservas (cliente o agendadas por el barbero)
 *    Bloqueos      → horas congeladas por el barbero ("llego a las 12")
 *    Fidelizacion  → tarjetas de sellos (ID = celular)
 *    Mensajes      → avisos privados barbero → cliente
 *    Push_Subs     → suscripciones push (barberos y clientes)
 *    Config        → datos del negocio y reglas (pasos, sellos, premio…)
 *
 *  Roles (columna Rol, puedes combinarlos con coma):
 *    barber       → atiende, ve SU agenda
 *    admin        → barbero admin: además puede mover/cancelar citas de otros
 *    owner        → dueño: todo lo de admin + análisis económico y top 3
 *    superadmin   → tú: control total, crear barberos rápido, configuración
 *    ej: "barber,admin"  ·  "barber,owner"  ·  "superadmin"
 *
 *  Endpoints (sin CORS: el front manda el body como texto plano):
 *    GET  ?action=ping
 *    GET  ?action=public                         (página /clientes)
 *    GET  ?action=bootstrap&token=…&from=&to=     (app de barberos)
 *    GET  ?action=loyalty&token=…
 *    POST { action: book | client_lookup | client_cancel | client_reschedule |
 *                   loyalty_join | push_subscribe | login | profile_save |
 *                   password_change | block_save | block_delete | appt_create |
 *                   appt_update | message_send | stamp_add | loyalty_redeem |
 *                   user_save | service_save | config_save | client_find, … }
 *
 *  PASOS RÁPIDOS:
 *   1) Crea una Google Sheet llamada STARSFASHION → Extensiones → Apps Script.
 *   2) Pega TODO este archivo en Code.gs (y appsscript.json si quieres la zona horaria fija).
 *   3) Ejecuta setupStars() UNA vez (acepta permisos). Crea hojas, servicios,
 *      usuarios demo y el reloj automático (sellos + recordatorios cada 5 min).
 *   4) (Opcional para vender) ejecuta seedDemoData() → llena 3 semanas de citas falsas.
 *   5) Implementar → Nueva implementación → Aplicación web
 *        Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario.
 *   6) Copia la URL /exec y pégala en src/config.js (SCRIPT_URL) o en .env (VITE_SCRIPT_URL).
 *   ⚠ Cada vez que cambies el código: Implementar → Gestionar → Editar → Nueva versión.
 * =====================================================================
 */

const SHEET_ID = '';
const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
const TZ = 'America/Bogota';
const TOKEN_DAYS = 30;

const SCHEMA = {
  Users: ['User_Id', 'Nombre', 'Email', 'Password', 'Rol', 'Estrellas', 'Especialidad', 'Descripcion', 'Foto_URL', 'Color',
    'Horario_JSON', 'Almuerzo_JSON', 'Activo', 'Orden', 'Ultimo_Login', 'Creado', 'WhatsApp'],
  Services: ['Id', 'Nombre', 'Duracion_Min', 'Precio', 'Resumen', 'Incluye', 'Categoria', 'Destacado', 'Activo', 'Orden'],
  Citas: ['Id', 'Codigo', 'Fecha', 'Hora_Inicio', 'Hora_Fin', 'Duracion_Min', 'Barbero_Id', 'Barbero_Nombre', 'Servicio_Id',
    'Servicio_Nombre', 'Precio', 'Propina', 'Cliente_Nombre', 'Cliente_Telefono', 'Cliente_Email', 'Estado', 'Origen',
    'Metodo_Pago', 'Notas', 'Sello', 'Recordado', 'Llegada', 'Finalizada', 'Creado', 'Actualizado', 'Creado_Por'],
  Bloqueos: ['Id', 'Barbero_Id', 'Fecha', 'Hora_Inicio', 'Hora_Fin', 'Motivo', 'Creado'],
  Fidelizacion: ['Telefono', 'Nombre', 'Email', 'Sellos', 'Tarjetas_Completas', 'Sellos_Totales', 'Premio_Pendiente',
    'Premios_Canjeados', 'Ultimo_Sello', 'Creado'],
  Mensajes: ['Id', 'Cita_Id', 'Cliente_Telefono', 'Barbero_Id', 'Barbero_Nombre', 'Tipo', 'Mensaje', 'Leido', 'Creado'],
  Push_Subs: ['Id', 'Tipo', 'Ref', 'Endpoint', 'Keys_JSON', 'Creado'],
  Config: ['Clave', 'Valor', 'Nota'],
};

/* columnas que SIEMPRE deben ser texto (evita que Sheets convierta fechas, horas o celulares) */
const TEXT_COLS = {
  Users: ['User_Id', 'Password', 'Horario_JSON', 'Almuerzo_JSON', 'WhatsApp'],
  Services: ['Id'],
  Citas: ['Id', 'Codigo', 'Fecha', 'Hora_Inicio', 'Hora_Fin', 'Barbero_Id', 'Servicio_Id', 'Cliente_Telefono'],
  Bloqueos: ['Id', 'Barbero_Id', 'Fecha', 'Hora_Inicio', 'Hora_Fin'],
  Fidelizacion: ['Telefono'],
  Mensajes: ['Id', 'Cita_Id', 'Cliente_Telefono', 'Barbero_Id'],
  Push_Subs: ['Id', 'Ref'],
  Config: ['Clave', 'Valor'],
};
const DATE_KEYS = { Fecha: 1 };
const TIME_KEYS = { Hora_Inicio: 1, Hora_Fin: 1 };

const COLORS = {
  Users: '#4b1d2f', Services: '#b88a44', Citas: '#2f3a56', Bloqueos: '#7b6b70',
  Fidelizacion: '#6f8f7a', Mensajes: '#a4566b', Push_Subs: '#231a20', Config: '#231a20',
};

const SHOP_HOURS = {
  '0': { on: true, start: '10:00', end: '19:00' }, '1': { on: true, start: '09:00', end: '20:00' },
  '2': { on: true, start: '09:00', end: '20:00' }, '3': { on: true, start: '09:00', end: '20:00' },
  '4': { on: true, start: '09:00', end: '20:00' }, '5': { on: true, start: '09:00', end: '20:00' },
  '6': { on: true, start: '09:00', end: '20:00' },
};
const DEFAULT_LUNCH = { desde: '12:00', hasta: '15:00', min: 60 };

const DEFAULT_CONFIG = [
  ['Negocio', 'STARS FASHION', 'Nombre que ven los clientes'],
  ['Slogan', 'Barbería VIP · Bogotá', ''],
  ['Direccion', 'Carrera 56 #2A-14, Piso 1, Bogotá, Colombia', ''],
  ['Maps_URL', 'https://www.google.com/maps/search/?api=1&query=Carrera%2056%202a14,%20Bogot%C3%A1,%20Colombia', ''],
  ['WhatsApp_1', '573022339159', 'Solo números con indicativo'],
  ['WhatsApp_2', '573022339167', ''],
  ['Instagram', '', 'usuario sin @ (opcional)'],
  ['Horario_Local', JSON.stringify(SHOP_HOURS), '0 = domingo … 6 = sábado'],
  ['Paso_Min', '15', 'Cada cuántos minutos se ofrecen horas'],
  ['Anticipacion_Min', '30', 'Mínimo de minutos para reservar desde ahora'],
  ['Dias_Reserva', '21', 'Cuántos días hacia adelante se puede reservar'],
  ['Sellos_Tarjeta', '10', 'Sellos de la tarjeta'],
  ['Sello_Premio', '8', 'En qué sello sale el regalo'],
  ['Premio_Texto', 'SORPRESA', 'Lo que dice la casilla del regalo'],
  ['Llave_Pago', '@starsfashion', 'Llave Bre-B / Nequi para pagos'],
  ['Push_Relay_URL', '', 'PRIVADO · https://TU-APP.vercel.app/api/push'],
  ['Push_Relay_Secret', '', 'PRIVADO · igual a PUSH_SECRET en Vercel'],
];
const PRIVATE_CONFIG = { Push_Relay_URL: 1, Push_Relay_Secret: 1 };

const SERVICES_SEED = [
  ['S01', 'CORTE DE CABALLERO', 50, 23000, 'Experiencia clásica completa',
    'Corte de cabello|Perfilado de cejas|Aplicación de producto para el peinado|Lavado de cabello|Bebida caliente o fría', 'Cortes', false],
  ['S02', 'CORTE DE CABELLO CON DISEÑO FREESTYLE', 60, 28000, 'Corte personalizado con diseño de líneas y siluetas, para los que se atreven un poco más',
    'Diseño de líneas y siluetas|Lavado de cabello|Perfilado de cejas|Aplicación de productos para el peinado|Bebida caliente o fría', 'Cortes', false],
  ['S03', 'CORTE DE CABELLO VIP', 120, 50000, 'Corte + ritual facial de carbón y colágeno',
    'Corte de cabello|Perfilado de cejas|Exfoliación con mascarilla de carbono (impurezas y puntos negros)|Mascarilla de colágeno para restaurar la piel|Lavado de cabello|Aplicación de producto para el peinado|Bebida caliente o fría', 'VIP', true],
  ['S04', 'CORTE DE CABELLO Y PERFILADO DE BARBA', 70, 32000, 'El combo favorito',
    'Corte de cabello y perfilado de barba|Aceite hidratante para barba|Perfilado de cejas|Lavado de cabello|Aplicación de producto para el peinado|Bebida caliente o fría', 'Combos', false],
  ['S05', 'CORTE DE CABELLO Y PERFILADO DE BARBA VIP', 180, 60000, 'La experiencia total Stars',
    'Corte de cabello|Perfilado de barba|Perfilado de cejas|Exfoliación con mascarilla de carbono|Mascarilla de colágeno para restaurar la piel|Champú|Aplicación de producto para el peinado|Bebida caliente o fría', 'VIP', true],
  ['S06', 'LIMPIEZA FACIAL', 90, 35000, 'Piel nueva en hora y media',
    'Apertura de poros con vapor ozono|Exfoliación|Mascarilla para puntos negros|Mascarilla de colágeno|Bebida fría o caliente', 'Facial', false],
  ['S07', 'PERFILADO DE BARBA', 30, 14000, 'Barba impecable',
    'Perfilado de barba|Aceite hidratante para barba|Bebida caliente o fría', 'Barba', false],
];

/* =====================================================================
   SETUP ▶ ejecútalo UNA vez desde el editor
   ===================================================================== */
function setupStars() {
  Object.keys(SCHEMA).forEach(function (name) {
    const headers = SCHEMA[name];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const lastCol = Math.max(sh.getLastColumn(), 1);
    const current = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    if (!current[0]) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      headers.forEach(function (h) { if (current.indexOf(h) === -1) sh.getRange(1, sh.getLastColumn() + 1).setValue(h); });
    }
    const n = sh.getLastColumn();
    sh.getRange(1, 1, 1, n).setFontWeight('bold').setFontColor('#ffffff').setBackground(COLORS[name])
      .setHorizontalAlignment('center').setFontFamily('Montserrat');
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 32);
    const h = headers_(sh);
    (TEXT_COLS[name] || []).forEach(function (c) {
      const i = h.indexOf(c);
      if (i >= 0) sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
    });
  });

  const list = function (sh, col, values, help) {
    const i = headers_(sh).indexOf(col);
    if (i < 0) return;
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(true);
    if (help) rule.setHelpText(help);
    sh.getRange(2, i + 1, 1500, 1).setDataValidation(rule.build());
  };

  // ---------- Users ----------
  const u = sheet_('Users');
  list(u, 'Rol', ['barber', 'barber,admin', 'barber,owner', 'owner', 'superadmin'], 'barber · admin · owner · superadmin (puedes combinarlos con coma)');
  list(u, 'Activo', ['TRUE', 'FALSE']);
  u.setColumnWidth(2, 180); u.setColumnWidth(3, 230); u.setColumnWidth(8, 280);
  if (u.getLastRow() < 2) {
    const now = new Date();
    const H = JSON.stringify(SHOP_HOURS), L = JSON.stringify(DEFAULT_LUNCH);
    [
      ['U001', 'Alejo · Control', 'super@starsfashion.co', 'Stars2026*', 'superadmin', 5, 'Soporte', 'Cuenta de control y arreglos.', '', '#231a20', H, L, true, 0, '', now],
      ['U002', 'Dueño Stars', 'dueno@starsfashion.co', 'Stars2026*', 'barber,owner', 5, 'Fade & diseño', 'Fundador de Stars Fashion. Precisión y estilo en cada corte.', '', '#8a2f4c', H, L, true, 1, '', now],
      ['U003', 'Santiago', 'santiago@starsfashion.co', 'Stars2026*', 'barber,admin', 5, 'Freestyle', 'Diseños de líneas y siluetas. Si lo imaginas, lo cortamos.', '', '#c08a2e', H, JSON.stringify({ desde: '13:00', hasta: '15:00', min: 60 }), true, 2, '', now],
      ['U004', 'Kevin', 'kevin@starsfashion.co', 'Stars2026*', 'barber', 4.8, 'Barba & ritual VIP', 'Especialista en barba, faciales y experiencia VIP.', '', '#3f6ea6', H, L, true, 3, '', now],
    ].forEach(function (r) { u.appendRow(r); });
  }

  // ---------- Services ----------
  const s = sheet_('Services');
  s.setColumnWidth(2, 300); s.setColumnWidth(5, 260); s.setColumnWidth(6, 420);
  list(s, 'Activo', ['TRUE', 'FALSE']); list(s, 'Destacado', ['TRUE', 'FALSE']);
  if (s.getLastRow() < 2) SERVICES_SEED.forEach(function (r, i) { s.appendRow(r.concat([true, i + 1])); });

  // ---------- Citas ----------
  const c = sheet_('Citas');
  list(c, 'Estado', ['reservada', 'en_curso', 'completada', 'cancelada', 'no_asistio']);
  list(c, 'Metodo_Pago', ['llave', 'efectivo']);
  list(c, 'Origen', ['cliente', 'barbero']);

  // ---------- Config ----------
  const cf = sheet_('Config');
  cf.setColumnWidth(1, 170); cf.setColumnWidth(2, 380); cf.setColumnWidth(3, 300);
  const have = rows_('Config').map(function (r) { return String(r.Clave); });
  DEFAULT_CONFIG.forEach(function (r) { if (have.indexOf(r[0]) === -1) cf.appendRow(r); });

  ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (nm) {
    const x = ss.getSheetByName(nm);
    if (x && x.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(x);
  });

  installTriggers();
  bump_();
  Logger.log('✨ STARS FASHION listo. Entra con super@starsfashion.co / Stars2026* (cámbialo en Users).');
}

/* Reloj automático: cada 5 min pone sellos, cierra servicios y manda recordatorios */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'tick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
}

/* =====================================================================
   HELPERS
   ===================================================================== */
const MEMO = {};

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function sheet_(name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Falta la hoja "' + name + '". Ejecuta setupStars().');
  return sh;
}
function headers_(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim(); });
}
function rows_(name) {
  if (MEMO[name]) return MEMO[name];
  const sh = sheet_(name);
  if (sh.getLastRow() < 2) return (MEMO[name] = []);
  const values = sh.getDataRange().getValues();
  const h = values[0].map(function (x) { return String(x).trim(); });
  const out = [];
  for (let r = 1; r < values.length; r++) {
    if (values[r].every(function (c) { return c === '' || c === null; })) continue;
    const o = { _row: r + 1 };
    h.forEach(function (k, i) {
      if (!k) return;
      let v = values[r][i];
      if (v instanceof Date) {
        if (DATE_KEYS[k]) v = Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
        else if (TIME_KEYS[k]) v = Utilities.formatDate(v, TZ, 'HH:mm');
        else v = v.toISOString();
      }
      o[k] = v;
    });
    out.push(o);
  }
  return (MEMO[name] = out);
}
function clean_(o) { const x = {}; Object.keys(o).forEach(function (k) { if (k !== '_row') x[k] = o[k]; }); return x; }
function append_(name, obj) {
  const sh = sheet_(name);
  const h = headers_(sh);
  sh.appendRow(h.map(function (k) { return obj[k] === undefined ? '' : obj[k]; }));
  delete MEMO[name];
}
function update_(name, row, obj) {
  const sh = sheet_(name);
  const h = headers_(sh);
  const range = sh.getRange(row._row, 1, 1, h.length);
  const cur = range.getValues()[0];
  const merged = h.map(function (k, i) { return obj[k] !== undefined ? obj[k] : cur[i]; });
  range.setValues([merged]);
  Object.keys(obj).forEach(function (k) { row[k] = obj[k]; });
}
function deleteRow_(name, row) { sheet_(name).deleteRow(row._row); delete MEMO[name]; }
function newId_(prefix) {
  return prefix + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
}
function code_() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'SF-';
  for (let i = 0; i < 4; i++) s += A.charAt(Math.floor(Math.random() * A.length));
  return s;
}
function sha256_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function bool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function parse_(s, fb) { try { const v = JSON.parse(s); return v === null || v === undefined ? fb : v; } catch (e) { return fb; } }
function phone_(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10 && d.charAt(0) === '3') d = '57' + d;
  return d;
}
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function nowMin_() { const t = Utilities.formatDate(new Date(), TZ, 'HH:mm'); return toMin_(t); }
function addDays_(fecha, n) {
  const p = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}
function dow_(fecha) { const p = fecha.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }
function toMin_(hhmm) { const p = String(hhmm || '0:0').split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
function toHHMM_(m) { m = Math.round(m); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
function validDate_(f) { return /^\d{4}-\d{2}-\d{2}$/.test(String(f)); }
function validTime_(t) { return /^\d{2}:\d{2}$/.test(String(t)); }

/* ---------- configuración ---------- */
function config_() {
  if (MEMO._cfg) return MEMO._cfg;
  const c = {};
  DEFAULT_CONFIG.forEach(function (r) { c[r[0]] = r[1]; });
  rows_('Config').forEach(function (r) { if (r.Clave) c[String(r.Clave)] = String(r.Valor); });
  c.Horario_Local = parse_(c.Horario_Local, SHOP_HOURS);
  ['Paso_Min', 'Anticipacion_Min', 'Dias_Reserva', 'Sellos_Tarjeta', 'Sello_Premio'].forEach(function (k) { c[k] = Number(c[k]) || 0; });
  return (MEMO._cfg = c);
}
function publicConfig_() {
  const c = config_(), o = {};
  Object.keys(c).forEach(function (k) { if (!PRIVATE_CONFIG[k]) o[k] = c[k]; });
  return o;
}

/* ---------- cache (página pública rápida) ---------- */
function bump_() { PropertiesService.getScriptProperties().setProperty('SF_VER', String(Date.now())); }
function ver_() { return PropertiesService.getScriptProperties().getProperty('SF_VER') || '0'; }

/* ---------- usuarios ---------- */
function roles_(r) { return String(r || '').toLowerCase().split(/[,\s|]+/).filter(String); }
function isBarber_(u) { return roles_(u.Rol).indexOf('barber') >= 0; }
function canManage_(s) { const r = roles_(s.rol); return r.indexOf('admin') >= 0 || r.indexOf('owner') >= 0 || r.indexOf('superadmin') >= 0; }
function isOwner_(s) { const r = roles_(s.rol); return r.indexOf('owner') >= 0 || r.indexOf('superadmin') >= 0; }
function isSuper_(s) { return roles_(s.rol).indexOf('superadmin') >= 0; }
function active_(u) { return !(u.Activo === false || String(u.Activo).toUpperCase() === 'FALSE'); }
function userById_(id) { return rows_('Users').find(function (u) { return String(u.User_Id) === String(id); }); }

function publicUser_(u, full) {
  const o = {
    User_Id: String(u.User_Id), Nombre: u.Nombre, Rol: String(u.Rol || 'barber'),
    Estrellas: Number(u.Estrellas) || 5, Especialidad: u.Especialidad || '', Descripcion: u.Descripcion || '',
    Foto_URL: u.Foto_URL || '', Color: u.Color || '#4b1d2f',
    Horario: parse_(u.Horario_JSON, config_().Horario_Local),
    Almuerzo: parse_(u.Almuerzo_JSON, DEFAULT_LUNCH),
    Activo: active_(u), Orden: Number(u.Orden) || 99, WhatsApp: phone_(u.WhatsApp),
  };
  if (full) { o.Email = u.Email; o.Ultimo_Login = u.Ultimo_Login; }
  return o;
}
function services_() {
  return rows_('Services').filter(function (s) { return s.Nombre && active_(s); }).map(function (s) {
    return {
      Id: String(s.Id), Nombre: s.Nombre, Duracion_Min: Number(s.Duracion_Min) || 30, Precio: Number(s.Precio) || 0,
      Resumen: s.Resumen || '', Incluye: String(s.Incluye || '').split('|').filter(String),
      Categoria: s.Categoria || '', Destacado: bool_(s.Destacado), Orden: Number(s.Orden) || 99,
    };
  }).sort(function (a, b) { return a.Orden - b.Orden; });
}

/* ---------- sesiones ---------- */
function createToken_(u) {
  const token = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('SF_' + token, JSON.stringify({
    id: String(u.User_Id), email: u.Email, nombre: u.Nombre, rol: String(u.Rol || 'barber'), exp: Date.now() + TOKEN_DAYS * 864e5,
  }));
  return token;
}
function session_(token) {
  if (!token) return null;
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('SF_' + token);
  if (!raw) return null;
  const s = JSON.parse(raw);
  if (Date.now() > s.exp) { props.deleteProperty('SF_' + token); return null; }
  const u = userById_(s.id);                      // el rol se lee siempre fresco de la hoja
  if (!u || !active_(u)) return null;
  s.rol = String(u.Rol || 'barber'); s.nombre = u.Nombre;
  return s;
}
const NO_SESSION = { status: 'error', code: 'auth', message: 'Tu sesión expiró. Vuelve a entrar.' };

/* =====================================================================
   DISPONIBILIDAD (misma lógica que src/lib/slots.js)
   ===================================================================== */
function activeAppt_(c) { return c.Estado !== 'cancelada'; }

function busy_(barberId, fecha, excludeId) {
  const out = [];
  rows_('Citas').forEach(function (c) {
    if (String(c.Barbero_Id) === String(barberId) && c.Fecha === fecha && activeAppt_(c) && String(c.Id) !== String(excludeId || '')) {
      out.push({ s: toMin_(c.Hora_Inicio), e: toMin_(c.Hora_Fin) });
    }
  });
  rows_('Bloqueos').forEach(function (b) {
    if (String(b.Barbero_Id) === String(barberId) && b.Fecha === fecha) out.push({ s: toMin_(b.Hora_Inicio), e: toMin_(b.Hora_Fin) });
  });
  return out;
}

function hasLunchGap_(lunch, busy) {
  const lf = toMin_(lunch.desde), lt = toMin_(lunch.hasta), need = Number(lunch.min) || 0;
  const list = busy.filter(function (i) { return i.e > lf && i.s < lt; })
    .map(function (i) { return { s: Math.max(i.s, lf), e: Math.min(i.e, lt) }; })
    .sort(function (a, b) { return a.s - b.s; });
  let cur = lf;
  for (let k = 0; k < list.length; k++) {
    if (list[k].s - cur >= need) return true;
    cur = Math.max(cur, list[k].e);
  }
  return lt - cur >= need;
}

/** Devuelve '' si el hueco sirve, o el motivo si no. */
function checkSlot_(u, fecha, start, dur, excludeId, force) {
  const end = start + dur;
  const busy = busy_(u.User_Id, fecha, excludeId);
  if (busy.some(function (i) { return start < i.e && end > i.s; })) return 'Ese horario ya fue tomado. Elige otro.';
  if (force) return '';
  const cfg = config_();
  if (fecha < today_()) return 'Esa fecha ya pasó.';
  if (fecha === today_() && start < nowMin_() + cfg.Anticipacion_Min) return 'Esa hora ya no está disponible.';
  if (fecha > addDays_(today_(), cfg.Dias_Reserva)) return 'Aún no abrimos agenda para esa fecha.';
  const h = parse_(u.Horario_JSON, cfg.Horario_Local)[String(dow_(fecha))];
  if (!h || !h.on) return 'El barbero no atiende ese día.';
  if (start < toMin_(h.start) || end > toMin_(h.end)) return 'Fuera del horario del barbero.';
  const lunch = parse_(u.Almuerzo_JSON, DEFAULT_LUNCH);
  if (lunch && Number(lunch.min) > 0 && end > toMin_(lunch.desde) && start < toMin_(lunch.hasta)) {
    if (!hasLunchGap_(lunch, busy.concat([{ s: start, e: end }]))) return 'Ese espacio es la hora de almuerzo del barbero.';
  }
  return '';
}

function busyPublic_() {
  const from = today_(), to = addDays_(from, config_().Dias_Reserva + 1);
  const out = [];
  rows_('Citas').forEach(function (c) {
    if (c.Fecha >= from && c.Fecha <= to && activeAppt_(c)) out.push({ id: String(c.Id), b: String(c.Barbero_Id), f: c.Fecha, s: c.Hora_Inicio, e: c.Hora_Fin });
  });
  rows_('Bloqueos').forEach(function (b) {
    if (b.Fecha >= from && b.Fecha <= to) out.push({ b: String(b.Barbero_Id), f: b.Fecha, s: b.Hora_Inicio, e: b.Hora_Fin });
  });
  return out;
}

/* =====================================================================
   FIDELIZACIÓN
   ===================================================================== */
function card_(tel) { return rows_('Fidelizacion').find(function (r) { return phone_(r.Telefono) === tel; }); }
function cardOut_(r) {
  if (!r) return null;
  const cfg = config_();
  return {
    Telefono: String(r.Telefono), Nombre: r.Nombre, Sellos: Number(r.Sellos) || 0, Tarjetas_Completas: Number(r.Tarjetas_Completas) || 0,
    Sellos_Totales: Number(r.Sellos_Totales) || 0, Premio_Pendiente: bool_(r.Premio_Pendiente), Premios_Canjeados: Number(r.Premios_Canjeados) || 0,
    Max: cfg.Sellos_Tarjeta, Premio_En: cfg.Sello_Premio, Premio_Texto: cfg.Premio_Texto, Ultimo_Sello: r.Ultimo_Sello || '',
  };
}
function join_(tel, nombre, email) {
  const ex = card_(tel);
  if (ex) return ex;
  append_('Fidelizacion', {
    Telefono: tel, Nombre: nombre || '', Email: email || '', Sellos: 0, Tarjetas_Completas: 0, Sellos_Totales: 0,
    Premio_Pendiente: false, Premios_Canjeados: 0, Ultimo_Sello: '', Creado: new Date(),
  });
  return card_(tel);
}
function stamp_(tel, delta) {
  const r = card_(tel);
  if (!r) return null;
  const cfg = config_();
  let sellos = (Number(r.Sellos) || 0) + (delta || 1);
  let completas = Number(r.Tarjetas_Completas) || 0;
  let premio = bool_(r.Premio_Pendiente);
  if (sellos < 0) sellos = 0;
  if ((delta || 1) > 0 && sellos >= cfg.Sello_Premio && (Number(r.Sellos) || 0) < cfg.Sello_Premio) premio = true;
  if (sellos >= cfg.Sellos_Tarjeta) { sellos = 0; completas++; }
  update_('Fidelizacion', r, {
    Sellos: sellos, Tarjetas_Completas: completas, Sellos_Totales: (Number(r.Sellos_Totales) || 0) + Math.max(delta || 1, 0),
    Premio_Pendiente: premio, Ultimo_Sello: new Date(),
  });
  return r;
}
function complete_(c) {
  const upd = { Estado: 'completada', Finalizada: c.Finalizada || new Date(), Actualizado: new Date() };
  if (!bool_(c.Sello) && c.Cliente_Telefono) {
    const card = stamp_(phone_(c.Cliente_Telefono), 1);
    if (card) upd.Sello = true;
  }
  update_('Citas', c, upd);
}

/* =====================================================================
   PUSH (opcional): Apps Script no puede firmar VAPID (ES256), así que
   reenvía a un "relay" web-push (ver push-relay/ en el repo).
   ===================================================================== */
function notify_(tipo, ref, title, body, url) {
  try {
    const cfg = config_();
    const relay = String(cfg.Push_Relay_URL || '').trim();
    if (!relay) { Logger.log('push: falta Push_Relay_URL en Config'); return { sent: 0, error: 'Falta Push_Relay_URL en la hoja Config' }; }
    const subs = rows_('Push_Subs').filter(function (p) { return String(p.Tipo).trim() === tipo && String(p.Ref).trim() === String(ref); })
      .map(function (p) { return { endpoint: String(p.Endpoint).trim(), keys: parse_(p.Keys_JSON, {}) }; });
    if (!subs.length) { Logger.log('push: ' + tipo + ' ' + ref + ' no tiene suscripción'); return { sent: 0, error: 'sin-suscripcion' }; }
    const r = UrlFetchApp.fetch(relay, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ secret: String(cfg.Push_Relay_Secret || '').trim(), subscriptions: subs, payload: { title: title, body: body, url: url || '/' } }),
    });
    const txt = r.getContentText();
    Logger.log('push ' + tipo + ' ' + ref + ' → ' + r.getResponseCode() + ' ' + txt.slice(0, 300));
    const out = parse_(txt, {});
    (out.gone || []).forEach(function (ep) {                       // borra suscripciones vencidas
      const row = rows_('Push_Subs').find(function (p) { return String(p.Endpoint).trim() === ep; });
      if (row) deleteRow_('Push_Subs', row);
    });
    if (r.getResponseCode() !== 200) return { sent: 0, error: out.error || ('HTTP ' + r.getResponseCode()) };
    return { sent: Number(out.sent) || 0, error: (out.errors && out.errors[0]) || '' };
  } catch (e) { Logger.log('push: ' + e.message); return { sent: 0, error: e.message }; }
}

/* =====================================================================
   RELOJ (trigger cada 5 min)
   ===================================================================== */
function tick() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try { autoComplete_(); reminders_(); } finally { lock.releaseLock(); }
}
function autoComplete_() {
  const t = today_(), now = nowMin_();
  let n = 0;
  rows_('Citas').forEach(function (c) {
    if (c.Estado !== 'en_curso') return;
    if (c.Fecha < t || (c.Fecha === t && toMin_(c.Hora_Fin) <= now)) { complete_(c); n++; }
  });
  if (n) bump_();
  return n;
}
function reminders_() {
  const t = today_(), now = nowMin_();
  rows_('Citas').forEach(function (c) {
    if (c.Fecha !== t || c.Estado !== 'reservada' || bool_(c.Recordado)) return;
    const diff = toMin_(c.Hora_Inicio) - now;
    if (diff > 0 && diff <= 20) {
      notify_('barbero', c.Barbero_Id, 'Próximo cliente: ' + c.Cliente_Nombre, c.Hora_Inicio + ' · ' + c.Servicio_Nombre + ' — recuerda iniciar el servicio ✦', '/app');
      notify_('cliente', phone_(c.Cliente_Telefono), 'Tu cita es a las ' + c.Hora_Inicio, 'Te esperamos en Stars Fashion con ' + c.Barbero_Nombre + ' ✦', '/clientes');
      update_('Citas', c, { Recordado: true });
    }
  });
}

/* =====================================================================
   GET
   ===================================================================== */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (!p.action || p.action === 'ping') return json_({ status: 'success', app: 'Stars Fashion', time: new Date(), ver: ver_() });

    if (p.action === 'public') {
      const cache = CacheService.getScriptCache();
      const key = 'pub_' + ver_() + '_' + today_() + '_' + Math.floor(nowMin_() / 5);
      const hit = cache.get(key);
      if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
      const out = JSON.stringify({
        status: 'success', ver: ver_(), today: today_(), now: nowMin_(),
        config: publicConfig_(), services: services_(),
        barbers: rows_('Users').filter(function (u) { return active_(u) && isBarber_(u); }).map(function (u) { return publicUser_(u); })
          .sort(function (a, b) { return a.Orden - b.Orden; }),
        busy: busyPublic_(),
      });
      try { cache.put(key, out, 300); } catch (x) { /* > 100 KB */ }
      return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
    }

    const s = session_(p.token);
    if (!s) return json_(NO_SESSION);

    if (p.action === 'bootstrap') {
      const from = validDate_(p.from) ? p.from : addDays_(today_(), -60);
      const to = validDate_(p.to) ? p.to : addDays_(today_(), 30);
      const all = canManage_(s);
      const me = userById_(s.id);
      const citas = rows_('Citas').filter(function (c) {
        return c.Fecha >= from && c.Fecha <= to && (all || String(c.Barbero_Id) === s.id);
      }).map(clean_);
      const bloqueos = rows_('Bloqueos').filter(function (b) {
        return b.Fecha >= addDays_(today_(), -1) && (all || String(b.Barbero_Id) === s.id);
      }).map(clean_);
      const users = rows_('Users').filter(function (u) { return isSuper_(s) || active_(u); })
        .map(function (u) { return publicUser_(u, isOwner_(s)); }).sort(function (a, b) { return a.Orden - b.Orden; });
      return json_({
        status: 'success', ver: ver_(), today: today_(), now: nowMin_(),
        me: publicUser_(me, true), config: isOwner_(s) ? config_() : publicConfig_(), services: services_(), users: users,
        citas: citas, bloqueos: bloqueos,
        clubCount: isOwner_(s) ? rows_('Fidelizacion').length : undefined,
      });
    }

    if (p.action === 'loyalty') {
      if (!canManage_(s)) return json_({ status: 'error', message: 'Sin permiso.' });
      return json_({ status: 'success', cards: rows_('Fidelizacion').map(cardOut_) });
    }

    return json_({ status: 'error', message: 'Acción desconocida' });
  } catch (err) {
    return json_({ status: 'error', message: err.message });
  }
}

/* =====================================================================
   POST
   ===================================================================== */
function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const a = p.action;

    /* ---------- LOGIN ---------- */
    if (a === 'login') {
      const email = String(p.email || '').trim().toLowerCase();
      const pass = String(p.password || '');
      const u = rows_('Users').find(function (x) { return String(x.Email).trim().toLowerCase() === email; });
      const stored = u ? String(u.Password) : '';
      const ok = u && pass && (stored === pass || stored === 'sha256:' + sha256_(pass));
      if (!ok) return json_({ status: 'error', message: 'Correo o contraseña incorrectos.' });
      if (!active_(u)) return json_({ status: 'error', message: 'Este usuario está inactivo.' });
      update_('Users', u, { Ultimo_Login: new Date() });
      return json_({ status: 'success', token: createToken_(u), user: publicUser_(u, true) });
    }

    /* ---------- PÚBLICO: consultar mis citas + tarjeta ---------- */
    if (a === 'client_lookup') {
      const tel = phone_(p.telefono);
      if (tel.length < 10) return json_({ status: 'error', message: 'Escribe un celular válido.' });
      const from = addDays_(today_(), -45);
      const citas = rows_('Citas').filter(function (c) { return phone_(c.Cliente_Telefono) === tel && c.Fecha >= from; })
        .map(function (c) {
          return {
            Id: c.Id, Codigo: c.Codigo, Fecha: c.Fecha, Hora_Inicio: c.Hora_Inicio, Hora_Fin: c.Hora_Fin, Duracion_Min: c.Duracion_Min,
            Barbero_Id: String(c.Barbero_Id), Barbero_Nombre: c.Barbero_Nombre, Servicio_Id: String(c.Servicio_Id),
            Servicio_Nombre: c.Servicio_Nombre, Precio: c.Precio, Estado: c.Estado, Cliente_Nombre: c.Cliente_Nombre, Sello: bool_(c.Sello),
          };
        });
      const mensajes = rows_('Mensajes').filter(function (m) { return phone_(m.Cliente_Telefono) === tel; }).slice(-30).map(clean_);
      return json_({ status: 'success', citas: citas, card: cardOut_(card_(tel)), mensajes: mensajes });
    }

    if (a === 'push_subscribe') {
      const sub = p.subscription || {};
      if (!sub.endpoint) return json_({ status: 'error', message: 'Suscripción inválida.' });
      let tipo = 'cliente', ref = phone_(p.telefono);
      if (p.token) { const s0 = session_(p.token); if (s0) { tipo = 'barbero'; ref = s0.id; } }
      if (!ref) return json_({ status: 'error', message: 'Falta el celular.' });
      const lockP = LockService.getScriptLock(); lockP.tryLock(10000);
      try {
        const dup = rows_('Push_Subs').find(function (x) { return x.Endpoint === sub.endpoint; });
        if (dup) update_('Push_Subs', dup, { Tipo: tipo, Ref: ref, Keys_JSON: JSON.stringify(sub.keys || {}) });
        else append_('Push_Subs', { Id: newId_('P'), Tipo: tipo, Ref: ref, Endpoint: sub.endpoint, Keys_JSON: JSON.stringify(sub.keys || {}), Creado: new Date() });
      } finally { lockP.releaseLock(); }
      return json_({ status: 'success' });
    }

    const PUBLIC_WRITE = { book: 1, client_cancel: 1, client_reschedule: 1, loyalty_join: 1 };
    let s = null;
    if (!PUBLIC_WRITE[a]) {
      s = session_(p.token);
      if (!s) return json_(NO_SESSION);
    }

    /* ---------- BARBERO: buscar cliente por celular (autocompletar) ---------- */
    if (a === 'client_find') {
      const tel = phone_(p.telefono);
      if (tel.length < 10) return json_({ status: 'success', client: null });
      const list = rows_('Citas').filter(function (c) { return phone_(c.Cliente_Telefono) === tel; })
        .sort(function (x, y) { return (String(y.Fecha) + y.Hora_Inicio).localeCompare(String(x.Fecha) + x.Hora_Inicio); });
      const card = card_(tel);
      if (!list.length && !card) return json_({ status: 'success', client: null });
      const last = list[0] || {};
      const withMail = list.find(function (c) { return c.Cliente_Email; });
      return json_({ status: 'success', client: {
        Nombre: last.Cliente_Nombre || (card && card.Nombre) || '', Email: (withMail && withMail.Cliente_Email) || (card && card.Email) || '',
        Visitas: list.filter(function (c) { return c.Estado === 'completada'; }).length,
        Ultimo_Servicio: last.Servicio_Nombre || '', Ultimo_Servicio_Id: last.Servicio_Id ? String(last.Servicio_Id) : '', Ultima_Fecha: last.Fecha || '',
        Sellos: card ? Number(card.Sellos) || 0 : undefined,
      } });
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return json_({ status: 'error', message: 'Servidor ocupado, intenta de nuevo.' });
    try {
      const out = handleWrite_(a, p, s);
      if (out.status === 'success') bump_();
      return json_(out);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ status: 'error', message: err.message });
  }
}

function ok_(o) { o = o || {}; o.status = 'success'; return o; }
function fail_(m, extra) { const o = extra || {}; o.status = 'error'; o.message = m; return o; }

function handleWrite_(a, p, s) {
  /* =========================== PÚBLICO =========================== */
  if (a === 'book') {
    const b = p.booking || {};
    const tel = phone_(b.telefono);
    const nombre = String(b.nombre || '').trim().slice(0, 60);
    const email = String(b.email || '').trim().slice(0, 120);
    if (!nombre) return fail_('Escribe tu nombre.');
    if (tel.length < 10) return fail_('Escribe un celular válido.');
    const sv = services_().find(function (x) { return x.Id === String(b.servicio_id); });
    if (!sv) return fail_('Elige un servicio.');
    const u = userById_(b.barbero_id);
    if (!u || !active_(u) || !isBarber_(u)) return fail_('Elige un barbero.');
    if (!validDate_(b.fecha) || !validTime_(b.hora)) return fail_('Elige fecha y hora.');
    const start = toMin_(b.hora);
    const why = checkSlot_(u, b.fecha, start, sv.Duracion_Min, null, false);
    if (why) return fail_(why, { code: 'slot' });
    const cita = newCita_(sv, u, b.fecha, start, { nombre: nombre, tel: tel, email: email, notas: b.notas, origen: 'cliente', por: 'cliente' });
    let card = null;
    if (b.club) card = cardOut_(join_(tel, nombre, email));
    else card = cardOut_(card_(tel));
    notify_('barbero', u.User_Id, '✦ Nueva cita · ' + b.hora, nombre + ' · ' + sv.Nombre + ' · ' + b.fecha, '/app/agenda');
    return ok_({ cita: cita, card: card });
  }

  if (a === 'client_cancel' || a === 'client_reschedule') {
    const tel = phone_(p.telefono);
    const c = rows_('Citas').find(function (x) { return String(x.Id) === String(p.id); });
    if (!c || phone_(c.Cliente_Telefono) !== tel) return fail_('No encontramos esa cita con tu celular.');
    if (c.Estado !== 'reservada') return fail_('Esta cita ya no se puede modificar.');
    if (a === 'client_cancel') {
      update_('Citas', c, { Estado: 'cancelada', Actualizado: new Date(), Notas: String(c.Notas || '') + ' [Cancelada por el cliente]' });
      notify_('barbero', c.Barbero_Id, 'Cita cancelada', c.Cliente_Nombre + ' canceló ' + c.Fecha + ' ' + c.Hora_Inicio, '/app/agenda');
      return ok_({ cita: clean_(c) });
    }
    const u = userById_(p.barbero_id || c.Barbero_Id);
    if (!u || !active_(u)) return fail_('Barbero no disponible.');
    if (!validDate_(p.fecha) || !validTime_(p.hora)) return fail_('Elige fecha y hora.');
    const dur = Number(c.Duracion_Min) || 30, start = toMin_(p.hora);
    const why = checkSlot_(u, p.fecha, start, dur, c.Id, false);
    if (why) return fail_(why, { code: 'slot' });
    update_('Citas', c, {
      Fecha: p.fecha, Hora_Inicio: toHHMM_(start), Hora_Fin: toHHMM_(start + dur), Barbero_Id: String(u.User_Id),
      Barbero_Nombre: u.Nombre, Recordado: false, Actualizado: new Date(),
    });
    notify_('barbero', u.User_Id, 'Cita reprogramada', c.Cliente_Nombre + ' → ' + p.fecha + ' ' + p.hora, '/app/agenda');
    return ok_({ cita: clean_(c) });
  }

  if (a === 'loyalty_join') {
    const tel = phone_(p.telefono);
    if (tel.length < 10) return fail_('Escribe un celular válido.');
    return ok_({ card: cardOut_(join_(tel, String(p.nombre || '').slice(0, 60), String(p.email || '').slice(0, 120))) });
  }

  /* =========================== BARBEROS =========================== */
  const me = userById_(s.id);

  if (a === 'profile_save') {
    const x = p.profile || {};
    const target = (x.User_Id && x.User_Id !== s.id && isSuper_(s)) ? userById_(x.User_Id) : me;
    const upd = { };
    if (x.Nombre !== undefined) upd.Nombre = String(x.Nombre).slice(0, 60);
    if (x.Estrellas !== undefined) upd.Estrellas = Math.min(5, Math.max(1, Number(x.Estrellas) || 5));
    if (x.Especialidad !== undefined) upd.Especialidad = String(x.Especialidad).slice(0, 60);
    if (x.Descripcion !== undefined) upd.Descripcion = String(x.Descripcion).slice(0, 280);
    if (x.Foto_URL !== undefined) upd.Foto_URL = String(x.Foto_URL).slice(0, 500);
    if (x.Color !== undefined) upd.Color = String(x.Color).slice(0, 9);
    if (x.WhatsApp !== undefined) upd.WhatsApp = phone_(x.WhatsApp);
    if (x.Horario) upd.Horario_JSON = JSON.stringify(x.Horario);
    if (x.Almuerzo) upd.Almuerzo_JSON = JSON.stringify({ desde: x.Almuerzo.desde, hasta: x.Almuerzo.hasta, min: Number(x.Almuerzo.min) || 0 });
    update_('Users', target, upd);
    return ok_({ user: publicUser_(target, true) });
  }

  if (a === 'password_change') {
    const stored = String(me.Password);
    const cur = String(p.actual || '');
    if (!(stored === cur || stored === 'sha256:' + sha256_(cur))) return fail_('La contraseña actual no coincide.');
    if (String(p.nueva || '').length < 6) return fail_('La nueva contraseña debe tener mínimo 6 caracteres.');
    update_('Users', me, { Password: 'sha256:' + sha256_(p.nueva) });
    return ok_();
  }

  if (a === 'block_save') {
    const b = p.block || {};
    const bid = String(b.Barbero_Id || s.id);
    if (bid !== s.id && !canManage_(s)) return fail_('Sin permiso.');
    if (!validDate_(b.Fecha) || !validTime_(b.Hora_Inicio) || !validTime_(b.Hora_Fin) || toMin_(b.Hora_Fin) <= toMin_(b.Hora_Inicio)) return fail_('Revisa las horas del bloqueo.');
    const row = { Id: b.Id && String(b.Id).indexOf('tmp') !== 0 ? b.Id : newId_('B'), Barbero_Id: bid, Fecha: b.Fecha, Hora_Inicio: b.Hora_Inicio, Hora_Fin: b.Hora_Fin, Motivo: String(b.Motivo || '').slice(0, 80), Creado: new Date() };
    append_('Bloqueos', row);
    return ok_({ block: row, tmpId: b.Id });
  }

  if (a === 'block_delete') {
    const b = rows_('Bloqueos').find(function (x) { return String(x.Id) === String(p.id); });
    if (!b) return ok_();
    if (String(b.Barbero_Id) !== s.id && !canManage_(s)) return fail_('Sin permiso.');
    deleteRow_('Bloqueos', b);
    return ok_();
  }

  if (a === 'appt_create') {
    const x = p.cita || {};
    const bid = String(x.Barbero_Id || s.id);
    if (bid !== s.id && !canManage_(s)) return fail_('Sin permiso para agendar a otro barbero.');
    const u = userById_(bid);
    const sv = services_().find(function (z) { return z.Id === String(x.Servicio_Id); });
    if (!u || !sv) return fail_('Elige barbero y servicio.');
    if (!validDate_(x.Fecha) || !validTime_(x.Hora_Inicio)) return fail_('Elige fecha y hora.');
    const nombre = String(x.Cliente_Nombre || '').trim();
    if (!nombre) return fail_('Escribe el nombre del cliente.');
    const start = toMin_(x.Hora_Inicio);
    const dur = Number(x.Duracion_Min) || sv.Duracion_Min;
    const why = checkSlot_(u, x.Fecha, start, dur, null, !!p.force);
    if (why) return fail_(why, { code: 'slot' });
    const tel = phone_(x.Cliente_Telefono);
    const cita = newCita_(sv, u, x.Fecha, start, {
      nombre: nombre, tel: tel, email: x.Cliente_Email, notas: x.Notas, origen: 'barbero', por: s.email, dur: dur,
      precio: x.Precio !== undefined && x.Precio !== '' ? Number(x.Precio) : undefined, id: x.Id,
    });
    if (x.club && tel.length >= 10) join_(tel, nombre, x.Cliente_Email);
    return ok_({ cita: cita, tmpId: x.Id });
  }

  if (a === 'appt_update') {
    const c = rows_('Citas').find(function (z) { return String(z.Id) === String(p.id); });
    if (!c) return fail_('No encontramos la cita.');
    if (String(c.Barbero_Id) !== s.id && !canManage_(s)) return fail_('Sin permiso.');
    const ch = p.changes || {};
    const upd = { Actualizado: new Date() };
    const moving = ch.Fecha !== undefined || ch.Hora_Inicio !== undefined || ch.Barbero_Id !== undefined;
    if (moving) {
      const u = userById_(ch.Barbero_Id || c.Barbero_Id);
      if (!u) return fail_('Barbero no existe.');
      if (String(u.User_Id) !== s.id && !canManage_(s)) return fail_('Sin permiso.');
      const fecha = ch.Fecha || c.Fecha, start = toMin_(ch.Hora_Inicio || c.Hora_Inicio), dur = Number(c.Duracion_Min) || 30;
      const why = checkSlot_(u, fecha, start, dur, c.Id, true);
      if (why) return fail_(why, { code: 'slot' });
      upd.Fecha = fecha; upd.Hora_Inicio = toHHMM_(start); upd.Hora_Fin = toHHMM_(start + dur);
      upd.Barbero_Id = String(u.User_Id); upd.Barbero_Nombre = u.Nombre; upd.Recordado = false;
    }
    ['Metodo_Pago', 'Notas'].forEach(function (k) { if (ch[k] !== undefined) upd[k] = String(ch[k]).slice(0, 400); });
    ['Precio', 'Propina'].forEach(function (k) { if (ch[k] !== undefined) upd[k] = Number(ch[k]) || 0; });
    if (ch.Estado) {
      const E = ['reservada', 'en_curso', 'completada', 'cancelada', 'no_asistio'];
      if (E.indexOf(ch.Estado) < 0) return fail_('Estado inválido.');
      upd.Estado = ch.Estado;
      if (ch.Estado === 'en_curso') upd.Llegada = new Date();
    }
    update_('Citas', c, upd);
    if (ch.Estado === 'completada') complete_(c);
    if (moving && c.Cliente_Telefono) {
      const msg = 'Tu cita se movió a ' + c.Fecha + ' a las ' + c.Hora_Inicio + ' con ' + c.Barbero_Nombre + '.';
      append_('Mensajes', { Id: newId_('M'), Cita_Id: c.Id, Cliente_Telefono: phone_(c.Cliente_Telefono), Barbero_Id: c.Barbero_Id, Barbero_Nombre: c.Barbero_Nombre, Tipo: 'mover', Mensaje: msg, Leido: false, Creado: new Date() });
      notify_('cliente', phone_(c.Cliente_Telefono), 'Tu cita cambió de hora', msg, '/clientes/mis-citas');
    }
    return ok_({ cita: clean_(c), card: c.Cliente_Telefono ? cardOut_(card_(phone_(c.Cliente_Telefono))) : null });
  }

  if (a === 'message_send') {
    const c = rows_('Citas').find(function (z) { return String(z.Id) === String(p.cita_id); });
    if (!c) return fail_('No encontramos la cita.');
    if (String(c.Barbero_Id) !== s.id && !canManage_(s)) return fail_('Sin permiso.');
    const msg = String(p.mensaje || '').trim().slice(0, 400);
    if (!msg) return fail_('Escribe el mensaje.');
    const m = { Id: newId_('M'), Cita_Id: c.Id, Cliente_Telefono: phone_(c.Cliente_Telefono), Barbero_Id: c.Barbero_Id, Barbero_Nombre: me.Nombre, Tipo: String(p.tipo || 'personalizado'), Mensaje: msg, Leido: false, Creado: new Date() };
    append_('Mensajes', m);
    const push = notify_('cliente', m.Cliente_Telefono, me.Nombre + ' · Stars Fashion', msg, '/clientes/mis-citas');
    return ok_({ mensaje: m, push: push });
  }

  if (a === 'stamp_add' || a === 'loyalty_redeem') {
    if (!canManage_(s) && a === 'loyalty_redeem') return fail_('Sin permiso.');
    const tel = phone_(p.telefono);
    if (!card_(tel)) return fail_('Ese celular no está en el club.');
    if (a === 'stamp_add') stamp_(tel, Number(p.delta) || 1);
    else { const r = card_(tel); update_('Fidelizacion', r, { Premio_Pendiente: false, Premios_Canjeados: (Number(r.Premios_Canjeados) || 0) + 1 }); }
    return ok_({ card: cardOut_(card_(tel)) });
  }

  /* =========================== DUEÑO / SUPER =========================== */
  if (a === 'user_save') {
    if (!isSuper_(s)) return fail_('Solo el super admin crea o edita cuentas.');
    const x = p.user || {};
    const email = String(x.Email || '').trim().toLowerCase();
    if (!x.Nombre || !email) return fail_('Nombre y correo son obligatorios.');
    const ex = x.User_Id ? userById_(x.User_Id) : null;
    const dup = rows_('Users').find(function (u) { return String(u.Email).trim().toLowerCase() === email && (!ex || u.User_Id !== ex.User_Id); });
    if (dup) return fail_('Ya existe un usuario con ese correo.');
    const base = {
      Nombre: String(x.Nombre).slice(0, 60), Email: email, Rol: String(x.Rol || 'barber'),
      Activo: x.Activo === undefined ? true : !!x.Activo,
    };
    if (x.Especialidad !== undefined) base.Especialidad = x.Especialidad;
    if (x.Color) base.Color = x.Color;
    if (x.WhatsApp !== undefined) base.WhatsApp = phone_(x.WhatsApp);
    if (x.Password) base.Password = String(x.Password);
    if (ex) { update_('Users', ex, base); return ok_({ user: publicUser_(ex, true) }); }
    if (!x.Password) return fail_('Ponle una contraseña inicial.');
    const nid = 'U' + ('00' + (rows_('Users').length + 1)).slice(-3) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
    const row = Object.assign({
      User_Id: nid, Estrellas: 5, Especialidad: '', Descripcion: '', Foto_URL: '', Color: '#4b1d2f',
      Horario_JSON: JSON.stringify(config_().Horario_Local), Almuerzo_JSON: JSON.stringify(DEFAULT_LUNCH),
      Orden: rows_('Users').length + 1, Ultimo_Login: '', Creado: new Date(),
    }, base);
    append_('Users', row);
    return ok_({ user: publicUser_(userById_(nid), true) });
  }

  if (a === 'service_save') {
    if (!isOwner_(s)) return fail_('Solo el dueño edita servicios.');
    const x = p.service || {};
    const ex = rows_('Services').find(function (z) { return String(z.Id) === String(x.Id); });
    const row = {
      Nombre: String(x.Nombre || '').slice(0, 80), Duracion_Min: Math.max(10, Number(x.Duracion_Min) || 30),
      Precio: Math.max(0, Number(x.Precio) || 0), Resumen: String(x.Resumen || '').slice(0, 200),
      Incluye: Array.isArray(x.Incluye) ? x.Incluye.join('|') : String(x.Incluye || ''),
      Categoria: String(x.Categoria || ''), Destacado: !!x.Destacado, Activo: x.Activo === undefined ? true : !!x.Activo,
    };
    if (!row.Nombre) return fail_('Ponle nombre al servicio.');
    if (ex) update_('Services', ex, row);
    else append_('Services', Object.assign({ Id: 'S' + newId_(''), Orden: rows_('Services').length + 1 }, row));
    return ok_({ services: services_() });
  }

  if (a === 'config_save') {
    if (!isOwner_(s)) return fail_('Sin permiso.');
    const x = p.config || {};
    Object.keys(x).forEach(function (k) {
      if (PRIVATE_CONFIG[k] && !isSuper_(s)) return;
      const v = typeof x[k] === 'object' ? JSON.stringify(x[k]) : String(x[k]);
      const r = rows_('Config').find(function (z) { return String(z.Clave) === k; });
      if (r) update_('Config', r, { Valor: v }); else append_('Config', { Clave: k, Valor: v, Nota: '' });
    });
    delete MEMO._cfg;
    return ok_({ config: config_() });
  }

  return fail_('Acción desconocida');
}

function newCita_(sv, u, fecha, start, o) {
  const dur = o.dur || sv.Duracion_Min;
  const cita = {
    Id: o.id && String(o.id).indexOf('tmp') !== 0 ? o.id : newId_('C'), Codigo: code_(), Fecha: fecha,
    Hora_Inicio: toHHMM_(start), Hora_Fin: toHHMM_(start + dur), Duracion_Min: dur,
    Barbero_Id: String(u.User_Id), Barbero_Nombre: u.Nombre, Servicio_Id: sv.Id, Servicio_Nombre: sv.Nombre,
    Precio: o.precio !== undefined ? o.precio : sv.Precio, Propina: 0,
    Cliente_Nombre: o.nombre, Cliente_Telefono: o.tel || '', Cliente_Email: String(o.email || '').slice(0, 120),
    Estado: 'reservada', Origen: o.origen, Metodo_Pago: '', Notas: String(o.notas || '').slice(0, 400),
    Sello: false, Recordado: false, Llegada: '', Finalizada: '', Creado: new Date().toISOString(), Actualizado: new Date().toISOString(), Creado_Por: o.por,
  };
  append_('Citas', cita);
  return cita;
}

/* =====================================================================
   UTILIDADES MANUALES (ejecútalas desde el editor)
   ===================================================================== */

/* Llena ~3 semanas de citas falsas para mostrar la demo con gráficas bonitas */
function seedDemoData() {
  const names = ['Juan Pablo', 'Mateo', 'Sebastián', 'Nicolás', 'Samuel', 'David', 'Felipe', 'Tomás', 'Daniel', 'Camilo', 'Esteban', 'Julián', 'Miguel', 'Simón', 'Andrés'];
  const barbers = rows_('Users').filter(function (u) { return active_(u) && isBarber_(u); });
  const svs = services_();
  const t = today_();
  const sh = sheet_('Citas');
  const h = headers_(sh);
  const out = [];
  for (let d = -21; d <= 2; d++) {
    const fecha = addDays_(t, d);
    barbers.forEach(function (u) {
      const hor = parse_(u.Horario_JSON, SHOP_HOURS)[String(dow_(fecha))];
      if (!hor || !hor.on) return;
      let cur = toMin_(hor.start) + 15 * Math.floor(Math.random() * 4);
      const end = toMin_(hor.end);
      while (cur < end - 30) {
        const sv = svs[Math.floor(Math.random() * svs.length)];
        if (cur + sv.Duracion_Min > end) break;
        if (cur >= 12 * 60 + 30 && cur < 13 * 60 + 30) { cur = 13 * 60 + 30; continue; }
        if (Math.random() < 0.62) {
          const past = d < 0 || (d === 0 && cur + sv.Duracion_Min < nowMin_());
          const r = Math.random();
          const estado = past ? (r < 0.86 ? 'completada' : r < 0.94 ? 'no_asistio' : 'cancelada') : 'reservada';
          const nm = names[Math.floor(Math.random() * names.length)];
          const o = {
            Id: newId_('C') + out.length, Codigo: code_(), Fecha: fecha, Hora_Inicio: toHHMM_(cur), Hora_Fin: toHHMM_(cur + sv.Duracion_Min),
            Duracion_Min: sv.Duracion_Min, Barbero_Id: String(u.User_Id), Barbero_Nombre: u.Nombre, Servicio_Id: sv.Id, Servicio_Nombre: sv.Nombre,
            Precio: sv.Precio, Propina: estado === 'completada' && Math.random() < 0.3 ? 5000 : 0, Cliente_Nombre: nm,
            Cliente_Telefono: '573' + Math.floor(100000000 + Math.random() * 899999999), Cliente_Email: '', Estado: estado,
            Origen: Math.random() < 0.6 ? 'cliente' : 'barbero', Metodo_Pago: estado === 'completada' ? (Math.random() < 0.55 ? 'llave' : 'efectivo') : '',
            Notas: '[demo]', Sello: estado === 'completada', Recordado: true, Llegada: '', Finalizada: '', Creado: new Date(), Actualizado: new Date(), Creado_Por: 'demo',
          };
          out.push(h.map(function (k) { return o[k] === undefined ? '' : o[k]; }));
          cur += sv.Duracion_Min;
        } else cur += 30;
        cur = Math.ceil(cur / 15) * 15;
      }
    });
  }
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, h.length).setValues(out);
  bump_();
  Logger.log('Citas demo creadas: ' + out.length);
}

/* Borra SOLO las citas demo (Notas = [demo]) */
function clearDemoData() {
  const sh = sheet_('Citas');
  const rows = rows_('Citas').filter(function (c) { return String(c.Notas).indexOf('[demo]') >= 0; }).map(function (c) { return c._row; }).sort(function (a, b) { return b - a; });
  rows.forEach(function (r) { sh.deleteRow(r); });
  bump_();
  Logger.log('Citas demo borradas: ' + rows.length);
}

/* Convierte contraseñas en texto plano a SHA-256 */
function hashPasswords() {
  const sh = sheet_('Users');
  const col = headers_(sh).indexOf('Password') + 1;
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const vals = sh.getRange(2, col, n, 1).getValues();
  sh.getRange(2, col, n, 1).setValues(vals.map(function (r) { const v = String(r[0]); return [v && v.indexOf('sha256:') !== 0 ? 'sha256:' + sha256_(v) : v]; }));
  Logger.log('🔒 Contraseñas convertidas: ' + n);
}

/* Cierra todas las sesiones */
function clearSessions() {
  const props = PropertiesService.getScriptProperties();
  let n = 0;
  Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf('SF_') === 0 && k !== 'SF_VER') { props.deleteProperty(k); n++; } });
  Logger.log('Sesiones cerradas: ' + n);
}

/* ▶ Prueba de push: ejecútala desde el editor (la 1ª vez pide permiso para "conectarse a servicios externos").
   Manda una notificación a TODOS los equipos suscritos en Push_Subs. Mira el resultado en Ejecuciones / Registro. */
function testPush() {
  const subs = rows_('Push_Subs');
  Logger.log('Relay: ' + (config_().Push_Relay_URL || '(vacío: llena Push_Relay_URL en Config)'));
  Logger.log('Suscripciones: ' + subs.length);
  const seen = {};
  subs.forEach(function (p) {
    const k = p.Tipo + '|' + p.Ref;
    if (seen[k]) return; seen[k] = 1;
    notify_(p.Tipo, p.Ref, 'Prueba Stars Fashion ✦', 'Si ves esto con la app cerrada, el push funciona.', p.Tipo === 'barbero' ? '/app' : '/clientes');
  });
}

function testStars() {
  Object.keys(SCHEMA).forEach(function (n) { Logger.log(n + ': ' + rows_(n).length + ' filas'); });
  Logger.log('Hoy (Bogotá): ' + today_() + ' ' + toHHMM_(nowMin_()));
}
