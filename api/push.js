/* =====================================================================
   PUSH REAL (Vercel Function) — /api/push
   Apps Script no puede firmar notificaciones (VAPID), esta función sí.
   Apps Script la llama cuando hay nueva cita, recordatorio o mensaje.

   Variables en Vercel (Settings → Environment Variables):
     VITE_VAPID_PUBLIC_KEY  → llave pública  (también la usa el front)
     VAPID_PRIVATE_KEY      → llave privada  (solo aquí, nunca en el front)
     PUSH_SECRET            → una clave inventada, igual a Push_Relay_Secret en la hoja Config
   ===================================================================== */
import webpush from "web-push";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("Stars Fashion push ✦ listo");
  const { VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SECRET } = process.env;
  if (!VITE_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !PUSH_SECRET) return res.status(500).json({ ok: false, error: "Faltan variables VAPID/PUSH_SECRET en Vercel" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { secret, subscriptions = [], payload = {} } = body || {};
  if (secret !== PUSH_SECRET) return res.status(401).json({ ok: false, error: "Secreto incorrecto" });

  webpush.setVapidDetails("mailto:hola@starsfashion.co", VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const results = await Promise.allSettled(
    subscriptions.slice(0, 50).map((s) => webpush.sendNotification(s, JSON.stringify(payload), { TTL: 3600, urgency: "high" })),
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  const gone = results.map((r, i) => (r.status === "rejected" && [404, 410].includes(r.reason?.statusCode) ? subscriptions[i].endpoint : null)).filter(Boolean);
  return res.status(200).json({ ok: true, sent, failed: results.length - sent, gone });
}
