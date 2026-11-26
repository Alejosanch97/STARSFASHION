import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home as HomeIco, CalendarDays, Plus, ChartNoAxesColumn, Menu, Bell, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { getSession, DEMO } from "../../lib/api";
import { AppDataProvider, useApp } from "../../lib/store";
import { SyncBadge, Avatar, Logo } from "../../components/ui";
import { permission, enableNotifications, ensureSubscribed, testSelf } from "../../lib/push";
import { toast } from "../../components/ui";

export function AppShell() {
  if (!getSession()?.token) return <Navigate to="/" replace />;
  return (
    <AppDataProvider>
      <Shell />
    </AppDataProvider>
  );
}

function Shell() {
  const { me, error, loading, data } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [perm, setPerm] = useState(permission());
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => { ensureSubscribed(); }, []);

  const askPush = async () => {
    if (permission() === "granted") {
      const t = await testSelf({}, () => toast("Cierra la app: la prueba llega en 5 segundos", "gold", 4500));
      toast(t.reason, t.ok ? "ok" : "error", 7000);
      return;
    }
    const r = await enableNotifications();
    setPerm(permission());
    if (!r.ok) toast(r.reason === "ios" ? "En iPhone: Compartir → Agregar a inicio, y abre la app desde ahí." : "Activa las notificaciones en los ajustes del navegador.", "info", 5000);
    else toast(r.push?.reason || "Avisos activos", r.push?.ok ? "ok" : "error", 6000);
  };

  return (
    <div className="app">
      <header className="app-top">
        <button className="top-me" onClick={() => nav("/app/perfil")} aria-label="Mi perfil">
          {me ? <Avatar user={me} size={38} ring /> : <Logo size={38} />}
        </button>
        <div className="top-brand">
          <span className="display">Stars <em>Fashion</em></span>
          {DEMO && <small>demo</small>}
        </div>
        <SyncBadge smart />
        <button className={`icon-btn ${perm === "granted" ? "on" : ""}`} onClick={askPush} aria-label="Notificaciones">
          {perm === "granted" ? <BellRing size={18} /> : <Bell size={18} />}
        </button>
      </header>

      <main className="app-main">
        {error && !data ? (
          <div className="glass card fade-in" style={{ marginTop: 20 }}>
            <b>No pudimos cargar tu agenda</b>
            <p className="muted" style={{ margin: "6px 0 12px" }}>{error}</p>
            <button className="btn btn-primary block" onClick={() => location.reload()}>Reintentar</button>
          </div>
        ) : loading && !data ? <ShellSkeleton /> : <Outlet />}
      </main>

      <nav className="tabbar" aria-label="Navegación">
        <NavLink end to="/app" className="tab"><HomeIco size={21} /><span>Inicio</span></NavLink>
        <NavLink to="/app/agenda" className="tab"><CalendarDays size={21} /><span>Agenda</span></NavLink>
        <NavLink to="/app/nueva" className="tab-fab" aria-label="Agendar"><Plus size={26} strokeWidth={2.6} /></NavLink>
        <NavLink to="/app/analisis" className="tab"><ChartNoAxesColumn size={21} /><span>Números</span></NavLink>
        <NavLink to="/app/mas" className={({ isActive }) => `tab ${isActive || ["/app/perfil", "/app/horario", "/app/bloqueos", "/app/club", "/app/servicios", "/app/equipo", "/app/control"].includes(loc.pathname) ? "active" : ""}`}><Menu size={21} /><span>Más</span></NavLink>
      </nav>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="stagger" style={{ display: "grid", gap: 12, marginTop: 14 }}>
      <span className="skel" style={{ height: 30, width: "60%", borderRadius: 12 }} />
      <span className="skel" style={{ height: 190, borderRadius: 26 }} />
      <div className="grid2"><span className="skel" style={{ height: 96, borderRadius: 22 }} /><span className="skel" style={{ height: 96, borderRadius: 22 }} /></div>
      <span className="skel" style={{ height: 220, borderRadius: 22 }} />
    </div>
  );
}
