/* =====================================================================
   NOTIFICACIONES
   1) Avisos locales: mientras la app esté abierta (o instalada y en segundo
      plano reciente) mostramos notificaciones del sistema vía Service Worker.
   2) Push real (opcional): si hay VAPID_PUBLIC_KEY, suscribimos el equipo y
      guardamos la suscripción en Push_Subs; Apps Script la reenvía al relay.
   En iPhone solo funciona si la web se agrega a la pantalla de inicio (iOS 16.4+).
   ===================================================================== */
import { VAPID_PUBLIC_KEY } from "../config";
import { apiPost } from "./api";

export const pushSupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
export const permission = () => (pushSupported() ? Notification.permission : "unsupported");
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

let regPromise = null;
export function registerSW() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  if (!regPromise) regPromise = navigator.serviceWorker.register("/sw.js").catch(() => null);
  return regPromise;
}

function b64ToUint8(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** pide permiso; si hay VAPID suscribe y guarda en el backend. who = { telefono } para clientes */
export async function enableNotifications(who = {}) {
  if (!pushSupported()) return { ok: false, reason: isIOS() && !isStandalone() ? "ios" : "unsupported" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };
  const sub = await ensureSubscribed(who, { force: true });
  localNotify("¡Listo! ✦", sub.ok ? "Te avisaremos de tus próximas citas." : "Avisos activos solo con la app abierta.");
  return { ok: true, push: sub };
}

/** si ya dio permiso, (re)suscribe este equipo al push real. Devuelve { ok, reason } para poder diagnosticar */
/* la llave pública la entrega el MISMO servidor que firma (como en Dulce Fresa): nunca quedan cruzadas */
let keyCache = null;
async function serverKey() {
  if (keyCache) return keyCache;
  try {
    const r = await fetch("/api/push", { cache: "no-store" });
    const j = await r.json();
    if (j.publicKey) return (keyCache = j.publicKey);
  } catch { /* sin función en local: usamos la del build */ }
  return VAPID_PUBLIC_KEY || "";
}
const sameKey = (sub, key) => {
  try {
    const a = new Uint8Array(sub.options?.applicationServerKey || []), b = b64ToUint8(key);
    return a.length === 0 || (a.length === b.length && a.every((x, i) => x === b[i]));
  } catch { return true; }
};

/** suscribe este celular al push real. Devuelve { ok, reason, sub } para poder diagnosticar */
export async function ensureSubscribed(who = {}, { force = false } = {}) {
  if (permission() !== "granted") return { ok: false, reason: "Falta dar permiso de notificaciones." };
  if (!("PushManager" in window)) return { ok: false, reason: isIOS() ? "En iPhone abre la app desde el ícono de inicio." : "Este navegador no soporta push." };
  const key = await serverKey();
  if (!key) return { ok: false, reason: "El servidor no tiene llave pública (VITE_VAPID_PUBLIC_KEY en Vercel)." };
  let sub, renewed = false;
  try {
    const reg = await registerSW();
    await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, key)) { await sub.unsubscribe(); sub = null; renewed = true; }   // llave vieja → renovar
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) });
  } catch (e) {
    return { ok: false, reason: "El celular no aceptó la suscripción: " + (e?.message || e) };
  }
  const lk = "sf_sub_" + (who.telefono || "barbero");
  const sig = sub.endpoint.slice(-40) + key.slice(0, 8);
  if (!force && !renewed && localStorage.getItem(lk) === sig) return { ok: true, reason: "Notificaciones conectadas ✓", sub };
  try {
    await apiPost("push_subscribe", { subscription: sub.toJSON(), ...who, ...(who.telefono ? { token: "" } : {}) });
    localStorage.setItem(lk, sig);
    return { ok: true, reason: renewed ? "Notificaciones renovadas ✓" : "Notificaciones conectadas ✓", sub };
  } catch (e) {
    return { ok: false, reason: "La hoja no guardó la suscripción: " + e.message };
  }
}

/** manda una prueba a ESTE celular directo desde Vercel (sin Apps Script) */
export async function testSelf(who = {}, onSending) {
  const r = await ensureSubscribed(who);
  if (!r.ok) return r;
  onSending?.();
  try {
    const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true, subscription: r.sub.toJSON(), url: location.pathname }) });
    const j = await res.json();
    return j.ok ? { ok: true, reason: "Prueba enviada ✓ Si no llegó, revisa Ajustes → Notificaciones" } : { ok: false, reason: "Vercel no pudo enviar: " + (j.error || res.status) };
  } catch (e) {
    return { ok: false, reason: "No se pudo llamar a /api/push: " + e.message };
  }
}

export async function localNotify(title, body, url = "/", tag) {
  if (permission() !== "granted") return false;
  const reg = await registerSW();
  const opts = { body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url }, tag, vibrate: [80, 40, 80] };
  try {
    if (reg?.showNotification) await reg.showNotification(title, opts);
    else new Notification(title, opts);
    return true;
  } catch { return false; }
}

/* evita avisar dos veces lo mismo */
const SEEN = "sf_notified_v1";
export function once(key) {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SEEN) || "{}"); } catch { /* */ }
  if (s[key]) return false;
  s[key] = Date.now();
  const keys = Object.keys(s);
  if (keys.length > 300) keys.sort((a, b) => s[a] - s[b]).slice(0, 100).forEach((k) => delete s[k]);
  localStorage.setItem(SEEN, JSON.stringify(s));
  return true;
}
