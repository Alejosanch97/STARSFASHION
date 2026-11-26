/* =====================================================================
   CLIENTE DE LA API (Apps Script, sin CORS)
   - GET con ?action=…&token=…
   - POST con el body como texto plano (no dispara preflight)
   - Sin SCRIPT_URL → modo demo (src/lib/demo.js) con la misma interfaz
   ===================================================================== */
import { SCRIPT_URL, DEMO_MODE } from "../config";

export const DEMO = DEMO_MODE;
export const NOT_CONFIGURED = !SCRIPT_URL && !DEMO_MODE;
const SESSION_KEY = "sf_session_v1";

export const getSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
};
export const setSession = (s) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("sf_app_cache_v1");
  localStorage.removeItem("sf_outbox_v1");
};

let expired = false;
function onExpired() {
  if (expired) return;
  expired = true;
  clearSession();
  window.location.assign("/?expired=1");
}

class ApiError extends Error {
  constructor(msg, extra = {}) { super(msg); Object.assign(this, extra); }
}

async function request(method, action, payload = {}, { timeoutMs = 30000 } = {}) {
  if (DEMO) {
    const { demoCall } = await import("./demo.js");
    const data = await demoCall(action, { ...payload, token: payload.token ?? getSession()?.token });
    return handle(data, action);
  }
  if (NOT_CONFIGURED) throw new ApiError("Falta conectar el backend: pon VITE_SCRIPT_URL en el archivo .env y reinicia (npm run dev).");
  const token = payload.token ?? getSession()?.token;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    if (method === "GET") {
      const qs = new URLSearchParams({ action, ...(token ? { token } : {}), ...clean(payload) });
      res = await fetch(`${SCRIPT_URL}?${qs}`, { signal: ctrl.signal });
    } else {
      res = await fetch(SCRIPT_URL, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...payload, token }),
      });
    }
  } catch (e) {
    clearTimeout(timer);
    throw new ApiError(navigator.onLine ? "No pudimos conectar con el servidor." : "Sin conexión a internet.", { network: true, cause: e });
  }
  clearTimeout(timer);
  let data = null;
  try { data = await res.json(); } catch { /* HTML de error de Google */ }
  if (!data) throw new ApiError(`Error del servidor (${res.status}).`, { network: true });
  return handle(data, action);
}

function clean(o) {
  const x = {};
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && k !== "token") x[k] = String(v); });
  return x;
}

function handle(data, action) {
  if (data.status === "error") {
    if (data.code === "auth" && action !== "login") onExpired();
    throw new ApiError(data.message || "Error", { code: data.code });
  }
  return data;
}

export const apiGet = (action, params, opts) => request("GET", action, params, opts);
export const apiPost = (action, body, opts) => request("POST", action, body, opts);

/** reintenta errores de red (Apps Script a veces tarda en despertar) */
export async function apiRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (!e.network) throw e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw last;
}

export const roles = (r) => String(r || "").toLowerCase().split(/[,\s|]+/).filter(Boolean);
export const can = (user) => {
  const r = roles(user?.Rol);
  const owner = r.includes("owner") || r.includes("superadmin");
  return {
    barber: r.includes("barber"),
    manage: owner || r.includes("admin"),
    owner,
    super: r.includes("superadmin"),
  };
};
