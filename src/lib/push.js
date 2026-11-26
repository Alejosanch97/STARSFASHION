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
  const reg = await registerSW();
  if (reg && VAPID_PUBLIC_KEY && "PushManager" in window) {
    try {
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) }));
      await apiPost("push_subscribe", { subscription: sub.toJSON(), ...who });
    } catch { /* push real no disponible: quedan los avisos locales */ }
  }
  localNotify("¡Listo! ✦", "Te avisaremos de tus próximas citas.");
  return { ok: true };
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
