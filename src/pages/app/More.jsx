import { Link, useNavigate } from "react-router-dom";
import { UserRound, Clock4, CalendarOff, Gift, Scissors, Users, ShieldCheck, Link2, LogOut, ChevronRight, KeyRound, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "../../lib/store";
import { clearSession, apiPost } from "../../lib/api";
import { Avatar, Stars, Sheet, Field, toast, Spinner } from "../../components/ui";

export function More() {
  const { me, perms, data } = useApp();
  const nav = useNavigate();
  const [pw, setPw] = useState(false);
  const link = `${location.origin}/clientes`;

  const share = async () => {
    const text = `Reserva tu cita en ${data?.config?.Negocio || "Stars Fashion"} ✦`;
    if (navigator.share) { try { await navigator.share({ title: "Stars Fashion", text, url: link }); return; } catch { /* cancelado */ } }
    await navigator.clipboard?.writeText(link);
    toast("Link copiado ✦", "gold");
  };

  const items = [
    perms.barber && { to: "/app/perfil", icon: <UserRound size={19} />, t: "Mi perfil", s: "Nombre, estrellas, descripción y foto" },
    perms.barber && { to: "/app/horario", icon: <Clock4 size={19} />, t: "Mi horario y almuerzo", s: "Días, horas y ventana de almuerzo" },
    perms.barber && { to: "/app/bloqueos", icon: <CalendarOff size={19} />, t: "Ordenar mi horario", s: "Congela horas: “hoy llego a las 12”" },
    perms.manage && { to: "/app/club", icon: <Gift size={19} />, t: "Club de fidelización", s: `${data?.clubCount ?? "Tarjetas"} clientes · sellos y premios` },
    perms.owner && { to: "/app/equipo", icon: <Users size={19} />, t: "Equipo y turnos", s: "Quién atiende hoy y cómo va cada uno" },
    perms.owner && { to: "/app/servicios", icon: <Scissors size={19} />, t: "Servicios y precios", s: "Duración, precio y lo que incluye" },
    perms.super && { to: "/app/control", icon: <ShieldCheck size={19} />, t: "Control · super admin", s: "Crear barberos rápido y ajustes" },
  ].filter(Boolean);

  return (
    <div className="page stagger">
      <div className="me-card glass strong">
        <Avatar user={me} size={64} ring />
        <div className="grow">
          <h2 className="display">{me?.Nombre}</h2>
          <div className="row" style={{ gap: 8 }}><Stars value={Number(me?.Estrellas) || 5} /><span className="muted" style={{ fontSize: ".8rem" }}>{me?.Especialidad}</span></div>
          <div className="role-tags">{String(me?.Rol).split(",").map((r) => <span key={r} className="tag bord">{ROLE[r.trim()] || r}</span>)}</div>
        </div>
      </div>

      <div className="share-card glass">
        <Link2 size={20} />
        <div className="grow"><b>Tu link de reservas</b><small className="ellipsis">{link}</small></div>
        <button className="icon-btn" onClick={() => { navigator.clipboard?.writeText(link); toast("Link copiado ✦", "gold"); }} aria-label="Copiar"><Copy size={17} /></button>
        <button className="icon-btn" onClick={share} aria-label="Compartir"><Share2 size={17} /></button>
      </div>

      <div className="menu glass">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="menu-item">
            <span className="menu-ico">{i.icon}</span>
            <span className="grow"><b>{i.t}</b><small>{i.s}</small></span>
            <ChevronRight size={18} className="muted" />
          </Link>
        ))}
        <button className="menu-item" onClick={() => setPw(true)}>
          <span className="menu-ico"><KeyRound size={19} /></span><span className="grow"><b>Cambiar contraseña</b><small>Se guarda cifrada (SHA-256)</small></span><ChevronRight size={18} className="muted" />
        </button>
        <a className="menu-item" href="/clientes" target="_blank" rel="noreferrer">
          <span className="menu-ico"><Link2 size={19} /></span><span className="grow"><b>Ver página de clientes</b><small>Lo que ven al reservar</small></span><ChevronRight size={18} className="muted" />
        </a>
      </div>

      <button className="btn btn-ghost block" style={{ marginTop: 14 }} onClick={() => { clearSession(); nav("/", { replace: true }); }}><LogOut size={18} /> Cerrar sesión</button>
      <p className="muted made">Stars Fashion · hecho con ✦ por Nébula Estudio</p>
      <PasswordSheet open={pw} onClose={() => setPw(false)} />
    </div>
  );
}

export const ROLE = { barber: "Barbero", admin: "Barbero admin", owner: "Dueño", superadmin: "Super admin" };

function PasswordSheet({ open, onClose }) {
  const [f, setF] = useState({ actual: "", nueva: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await apiPost("password_change", f); toast("Contraseña actualizada ✦"); onClose(); setF({ actual: "", nueva: "" }); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Cambiar contraseña" footer={<button className="btn btn-primary" disabled={busy || !f.actual || f.nueva.length < 6} onClick={save}>{busy && <Spinner />} Guardar</button>}>
      <Field label="Contraseña actual"><input type="password" value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} /></Field>
      <Field label="Nueva contraseña" hint="Mínimo 6 caracteres"><input type="password" value={f.nueva} onChange={(e) => setF({ ...f, nueva: e.target.value })} /></Field>
    </Sheet>
  );
}
