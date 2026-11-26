/* Contenedor de /clientes: datos públicos con cache instantáneo + identidad del cliente */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { apiGet } from "../../lib/api";

const PUB = "sf_public_v1";
const ME = "sf_client_v1";
const Ctx = createContext(null);
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };

export function ClientLayout() {
  const [pub, setPub] = useState(() => read(PUB));
  const [loading, setLoading] = useState(true);
  const [client, setClientState] = useState(() => read(ME) || { nombre: "", telefono: "", email: "" });
  const loc = useLocation();
  const inflight = useRef(null);

  const refresh = useCallback(() => {
    if (inflight.current) return inflight.current;
    inflight.current = apiGet("public").then((r) => {
      setPub(r);
      try { localStorage.setItem(PUB, JSON.stringify(r)); } catch { /* */ }
      return r;
    }).finally(() => { setLoading(false); inflight.current = null; });
    return inflight.current;
  }, []);

  const setClient = useCallback((c) => {
    setClientState((prev) => {
      const next = { ...prev, ...c };
      localStorage.setItem(ME, JSON.stringify(next));
      return next;
    });
  }, []);

  /** reserva optimista: la agregamos a "busy" ya mismo para que nadie vea ese cupo */
  const addBusy = useCallback((x) => setPub((p) => (p ? { ...p, busy: [...(p.busy || []), x] } : p)), []);

  useEffect(() => { refresh().catch(() => setLoading(false)); }, [refresh]);
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && refresh().catch(() => {}), 60000);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <Ctx.Provider value={{ pub, loading: loading && !pub, refreshing: loading, refresh, client, setClient, addBusy }}>
      <div className="client">
        <Outlet />
      </div>
    </Ctx.Provider>
  );
}

export const usePublic = () => useContext(Ctx);
