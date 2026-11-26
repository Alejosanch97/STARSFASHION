/* =====================================================================
   STARS FASHION · CONFIGURACIÓN DEL FRONT
   La URL /exec de tu Apps Script va en .env como VITE_SCRIPT_URL
   (o pégala abajo en PASTE_URL si prefieres no usar .env).
   MODO DEMO (datos falsos en el navegador): solo si pones VITE_DEMO=true
   y NO hay URL. Úsalo para mostrarle la app a otro negocio.
   ===================================================================== */
const PASTE_URL = "";
export const SCRIPT_URL = (import.meta.env.VITE_SCRIPT_URL || PASTE_URL).trim();
export const DEMO_MODE = !SCRIPT_URL && import.meta.env.VITE_DEMO === "true";

/* EmailJS (pendiente): cuando tengas las llaves, llénalas y los correos salen solos */
export const EMAILJS = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE || "",
  templateConfirm: import.meta.env.VITE_EMAILJS_TEMPLATE || "",
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "",
};

/* Web Push real (opcional): llave pública VAPID del relay (carpeta push-relay/) */
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

/* Colores de las gráficas (validados para daltonismo, en este orden fijo) */
export const SERIES = ["#8a2f4c", "#c08a2e", "#3f6ea6", "#2f9a7a", "#a45fc0"];
