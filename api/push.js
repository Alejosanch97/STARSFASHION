/* =====================================================================
   PUSH REAL (Vercel Function) — /api/push
   Igual que en Dulce Fresa: el MISMO servidor entrega la llave pública y
   firma con la privada, así nunca quedan llaves cruzadas.

   GET  /api/push                     → { ok, publicKey }  (el celular la usa para suscribirse)
   POST /api/push { test, subscription } → manda una prueba SOLO a ese celular (diagnóstico)
   POST /api/push { secret, subscriptions, payload } → lo usa Apps Script

   Variables en Vercel (Settings → Environment Variables):
     VITE_VAPID_PUBLIC_KEY  (o VAPID_PUBLIC_KEY) → llave pública
     VAPID_PRIVATE_KEY      → llave privada (Secret)
     PUSH_SECRET            → igual a Push_Relay_Secret en la hoja Config (Secret)
   ===================================================================== */
import webpush from "web-push";

const pub = () => (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || "").trim();
const priv = () => (process.env.VAPID_PRIVATE_KEY || "").trim();
const why = (r) => `${r?.statusCode || ""} ${String(r?.body || r?.message || "").replace(/\s+/g, " ").slice(0, 140)}`.trim();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(200).json({ ok: !!(pub() && priv()), msg: "Stars Fashion push ✦ listo", publicKey: pub(), hasPrivate: !!priv(), hasSecret: !!process.env.PUSH_SECRET });
  }
  if (!pub() || !priv()) return res.status(500).json({ ok: false, error: "Faltan VITE_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en Vercel" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  try {
    webpush.setVapidDetails("mailto:hola@starsfashion.co", pub(), priv());
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Llaves VAPID inválidas: " + e.message });
  }
  const opts = { TTL: 3600, urgency: "high" };

  /* ---------- prueba desde el propio celular ---------- */
  if (body.test) {
    if (!body.subscription?.endpoint) return res.status(400).json({ ok: false, error: "Falta la suscripción" });
    await new Promise((r) => setTimeout(r, 5000));               // 5 s para que cierres la app
    try {
      await webpush.sendNotification(body.subscription, JSON.stringify({ title: "Prueba Stars Fashion ✦", body: "¡Las notificaciones funcionan!", url: body.url || "/" }), opts);
      return res.status(200).json({ ok: true, sent: 1 });
    } catch (e) {
      return res.status(200).json({ ok: false, sent: 0, error: why(e) });
    }
  }

  /* ---------- envío desde Apps Script ---------- */
  if (!process.env.PUSH_SECRET) return res.status(500).json({ ok: false, error: "Falta PUSH_SECRET en Vercel" });
  if (String(body.secret || "").trim() !== process.env.PUSH_SECRET.trim()) return res.status(401).json({ ok: false, error: "Secreto incorrecto (Push_Relay_Secret ≠ PUSH_SECRET)" });

  const subs = (body.subscriptions || []).slice(0, 50);
  const results = await Promise.allSettled(subs.map((s) => webpush.sendNotification(s, JSON.stringify(body.payload || {}), opts)));
  const sent = results.filter((r) => r.status === "fulfilled").length;
  const gone = results.map((r, i) => (r.status === "rejected" && [404, 410].includes(r.reason?.statusCode) ? subs[i].endpoint : null)).filter(Boolean);
  const errors = results.filter((r) => r.status === "rejected").map((r) => why(r.reason));
  return res.status(200).json({ ok: true, sent, failed: subs.length - sent, gone, errors, keyStart: pub().slice(0, 12) });
}
