/* =====================================================================
   CORREOS CON EMAILJS (pendiente de llaves)
   Usa la API REST de EmailJS, así no hay que instalar nada.
   Cuando llenes EMAILJS en src/config.js, la confirmación sale sola.

   Variables que recibe tu plantilla en EmailJS:
     {{to_name}} {{to_email}} {{service}} {{barber}} {{date}} {{time}}
     {{price}} {{code}} {{business}} {{address}} {{manage_url}}
   ===================================================================== */
import { EMAILJS } from "../config";

export const emailReady = () => !!(EMAILJS.serviceId && EMAILJS.templateConfirm && EMAILJS.publicKey);

export async function sendEmail(templateId, params) {
  if (!emailReady() || !params?.to_email) return { skipped: true };
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: EMAILJS.serviceId, template_id: templateId, user_id: EMAILJS.publicKey, template_params: params }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export function sendBookingEmail({ cita, config, prettyDate, timeLabel }) {
  return sendEmail(EMAILJS.templateConfirm, {
    to_name: cita.Cliente_Nombre, to_email: cita.Cliente_Email, service: cita.Servicio_Nombre, barber: cita.Barbero_Nombre,
    date: prettyDate, time: timeLabel, price: "$" + Number(cita.Precio).toLocaleString("es-CO"), code: cita.Codigo,
    business: config?.Negocio || "Stars Fashion", address: config?.Direccion || "", manage_url: `${location.origin}/clientes/mis-citas`,
  });
}
