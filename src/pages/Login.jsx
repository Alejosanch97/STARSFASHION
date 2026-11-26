import { useState } from "react";
import { Navigate, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Scissors, Sparkles } from "lucide-react";
import { apiPost, apiRetry, getSession, setSession, DEMO, NOT_CONFIGURED } from "../lib/api";
import { Logo, Spinner } from "../components/ui";

const DEMO_USERS = [
  { email: "dueno@starsfashion.co", label: "Dueño", sub: "barbero + análisis" },
  { email: "santiago@starsfashion.co", label: "Barbero admin", sub: "ayuda a otros" },
  { email: "kevin@starsfashion.co", label: "Barbero", sub: "su agenda" },
  { email: "super@starsfashion.co", label: "Super admin", sub: "control total" },
];

export function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(params.get("expired") ? "Tu sesión expiró. Vuelve a entrar." : "");

  if (getSession()?.token) return <Navigate to="/app" replace />;

  const submit = async (e, em = email, pw = password) => {
    e?.preventDefault();
    if (!em || !pw) return setErr("Escribe tu correo y contraseña.");
    setBusy(true); setErr("");
    try {
      const res = await apiRetry(() => apiPost("login", { email: em.trim(), password: pw }));
      setSession({ token: res.token, user: res.user });
      nav("/app", { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <div className="login-hero fade-in">
        <div className="login-logo"><Logo size={84} /><span className="twinkle" /></div>
        <span className="eyebrow">Barbería VIP · Bogotá</span>
        <h1 className="display login-title">Stars <em>Fashion</em></h1>
        <p className="muted">Tu agenda, tus clientes y tu día, en la palma de la mano.</p>
      </div>

      <form className="glass strong login-card fade-in" onSubmit={submit} style={{ animationDelay: ".08s" }}>
        <div className="login-card-head">
          <span className="login-chip"><Scissors size={14} /> Acceso del equipo</span>
        </div>
        <label className="field">
          <span className="field-label">Correo</span>
          <div className="input-ico"><Mail size={18} /><input type="email" autoComplete="username" inputMode="email" placeholder="tu@starsfashion.co" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </label>
        <label className="field">
          <span className="field-label">Contraseña</span>
          <div className="input-ico pass">
            <Lock size={18} />
            <input type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? "Ocultar" : "Mostrar"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </label>
        {NOT_CONFIGURED && <p className="form-err">Falta conectar la base de datos: pon <b>VITE_SCRIPT_URL</b> en el archivo .env y reinicia con npm run dev.</p>}
        {err && <p className="form-err">{err}</p>}
        <button className="btn btn-primary block" disabled={busy}>
          {busy ? <><Spinner /> Entrando…</> : <>Entrar <ArrowRight size={18} /></>}
        </button>
      </form>

      {DEMO && (
        <div className="glass demo-box fade-in" style={{ animationDelay: ".16s" }}>
          <p className="demo-t"><Sparkles size={14} /> Modo demo · toca un perfil para entrar</p>
          <div className="demo-grid">
            {DEMO_USERS.map((u) => (
              <button key={u.email} type="button" className="demo-user" disabled={busy} onClick={() => submit(null, u.email, "Stars2026*")}>
                <b>{u.label}</b><small>{u.sub}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <Link to="/clientes" className="login-client">¿Eres cliente? <b>Reserva tu cita aquí</b> <ArrowRight size={15} /></Link>
    </main>
  );
}
