/* =====================================================================
   PUSH RELAY (opcional) — Apps Script no puede firmar VAPID, este mini
   servidor sí. Despliégalo gratis (Render, Railway, Vercel Functions…).

   1) npm i web-push express
   2) npx web-push generate-vapid-keys   → pon las llaves abajo (o en env)
   3) En la hoja Config: Push_Relay_URL = https://tu-relay/send
                         Push_Relay_Secret = el mismo SECRET
   4) En el front (.env): VITE_VAPID_PUBLIC_KEY = la llave pública
   ===================================================================== */
const express = require("express");
const webpush = require("web-push");

const { VAPID_PUBLIC, VAPID_PRIVATE, SECRET, PORT = 3000 } = process.env;
webpush.setVapidDetails("mailto:hola@starsfashion.co", VAPID_PUBLIC, VAPID_PRIVATE);

const app = express();
app.use(express.json({ limit: "200kb" }));

app.post("/send", async (req, res) => {
  const { secret, subscriptions = [], payload = {} } = req.body || {};
  if (!SECRET || secret !== SECRET) return res.status(401).json({ ok: false });
  const results = await Promise.allSettled(subscriptions.map((s) => webpush.sendNotification(s, JSON.stringify(payload))));
  res.json({ ok: true, sent: results.filter((r) => r.status === "fulfilled").length });
});

app.get("/", (_, res) => res.send("Stars push relay ✦"));
app.listen(PORT, () => console.log("relay en", PORT));
