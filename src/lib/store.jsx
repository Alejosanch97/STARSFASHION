/* =====================================================================
   DATOS DE LA APP DE BARBEROS — optimistic first
   - Pinta al instante lo último guardado en el celular (cache)
   - Refresca en segundo plano (y cada 45 s)
   - Cada cambio se ve YA en pantalla; si no hay señal queda en la "bandeja"
     (outbox) y se sube solo cuando vuelve internet
   ===================================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { apiGet, apiPost, getSession, setSession, can } from "./api";
import { track, setQueued, markSynced } from "./sync";
import { nice, addDays, todayStr, nowMin, toMin, h12 } from "./time";
import { localNotify, once } from "./push";
import { toast } from "../components/ui";

const CACHE = "sf_app_cache_v1";
const OUTBOX = "sf_outbox_v1";
const Ctx = createContext(null);

const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? fb; } catch { return fb; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* lleno */ } };

export function AppDataProvider({ children }) {
  const [data, setData] = useState(() => readJSON(CACHE, null));
  const [loading, setLoading] = useState(!readJSON(CACHE, null));
  const [error, setError] = useState("");
  const dataRef = useRef(data);
  const busyRef = useRef(0);
  const firstRef = useRef(true);
  dataRef.current = data;

  const commit = useCallback((fn) => {
    setData((prev) => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      writeJSON(CACHE, next);
      return next;
    });
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading((l) => l || !dataRef.current);
    try {
      const t = todayStr();
      const res = await (silent ? apiGet("bootstrap", { from: addDays(t, -70), to: addDays(t, 35) }) :
        track(apiGet("bootstrap", { from: addDays(t, -70), to: addDays(t, 35) })));
      if (busyRef.current > 0) return;            // hay cambios en vuelo: no pisarlos
      const prev = dataRef.current;
      // aviso de citas nuevas que llegaron desde /clientes
      if (prev && !firstRef.current && res.me) {
        const known = new Set((prev.citas || []).map((c) => c.Id));
        res.citas.filter((c) => !known.has(c.Id) && c.Barbero_Id === res.me.User_Id && c.Origen === "cliente" && c.Estado === "reservada")
          .forEach((c) => {
            if (once("new_" + c.Id)) {
              localNotify(`✦ Nueva cita · ${h12(c.Hora_Inicio)}`, `${c.Cliente_Nombre} · ${nice(c.Servicio_Nombre)}`, "/app/agenda", c.Id);
              toast(`Nueva cita: ${c.Cliente_Nombre} a las ${h12(c.Hora_Inicio)}`, "gold");
            }
          });
      }
      firstRef.current = false;
      const s = getSession();
      if (s && res.me) setSession({ ...s, user: res.me });
      commit({ ...res, loadedAt: Date.now() });
      markSynced();
      setError("");
    } catch (e) {
      if (!dataRef.current) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [commit]);

  /* ---------- bandeja de salida (sin señal) ---------- */
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    let box = readJSON(OUTBOX, []);
    if (!box.length) return;
    flushing.current = true;
    try {
      while (box.length) {
        const item = box[0];
        try {
          await track(apiPost(item.action, item.body));
        } catch (e) {
          if (e.network) break;                    // seguimos sin señal
          toast(`No se guardó: ${e.message}`, "error");
        }
        box = box.slice(1);
        writeJSON(OUTBOX, box);
        setQueued(box.length);
      }
    } finally {
      flushing.current = false;
      if (!box.length) load({ silent: true });
    }
  }, [load]);

  /**
   * mutate: aplica el cambio en pantalla YA y lo manda al backend.
   *  apply(data) → data nueva (optimistic)
   *  done(res, data) → data con la respuesta real (ids definitivos, etc.)
   */
  const mutate = useCallback(async (action, body, { apply, done, okMsg, queue = true } = {}) => {
    if (apply) commit((d) => apply(d));
    busyRef.current++;
    try {
      const res = await track(apiPost(action, body));
      if (done) commit((d) => done(res, d));
      if (okMsg) toast(okMsg, "ok");
      return res;
    } catch (e) {
      if (e.network && queue) {
        const box = [...readJSON(OUTBOX, []), { action, body, at: Date.now() }];
        writeJSON(OUTBOX, box);
        setQueued(box.length);
        toast("Sin señal: lo guardamos en el celular y se sube solo ✦", "info");
        return null;
      }
      toast(e.message, "error");
      busyRef.current--;
      await load({ silent: true });               // vuelve a la verdad del servidor
      busyRef.current++;
      throw e;
    } finally {
      busyRef.current--;
    }
  }, [commit, load]);

  useEffect(() => {
    setQueued(readJSON(OUTBOX, []).length);
    load();
    flush();
    const onOnline = () => flush();
    const onVis = () => { if (document.visibilityState === "visible") load({ silent: true }); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    const poll = setInterval(() => { if (document.visibilityState === "visible") { flush(); load({ silent: true }); } }, 45000);
    return () => { window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVis); clearInterval(poll); };
  }, [load, flush]);

  /* ---------- recordatorio "próximo cliente" (15 min antes) ---------- */
  useEffect(() => {
    const check = () => {
      const d = dataRef.current;
      if (!d?.me) return;
      const t = todayStr(), n = nowMin();
      (d.citas || []).forEach((c) => {
        if (c.Barbero_Id !== d.me.User_Id || c.Fecha !== t || c.Estado !== "reservada") return;
        const diff = toMin(c.Hora_Inicio) - n;
        if (diff > 0 && diff <= 15 && once("rem_" + c.Id)) {
          localNotify(`Próximo cliente: ${c.Cliente_Nombre}`, `${h12(c.Hora_Inicio)} · ${nice(c.Servicio_Nombre)} — recuerda iniciar el servicio ✦`, "/app", "rem_" + c.Id);
        }
      });
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo(() => ({
    data, loading, error, load, mutate, commit,
    me: data?.me || getSession()?.user || null,
    perms: can(data?.me || getSession()?.user),
  }), [data, loading, error, load, mutate, commit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
AppDataProvider.propTypes = { children: PropTypes.node };

export const useApp = () => useContext(Ctx);

/* ---------- helpers de datos ---------- */
export const tmpId = (p = "tmp") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const replaceCita = (d, id, next) => ({ ...d, citas: d.citas.map((c) => (c.Id === id ? { ...c, ...next } : c)) });
export const barberName = (d, id) => d?.users?.find((u) => u.User_Id === id)?.Nombre || "";
