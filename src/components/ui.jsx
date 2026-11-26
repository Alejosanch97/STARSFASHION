/* Piezas de interfaz compartidas: glass, sheets, badges, estrellas, toasts… */
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Check, CloudOff, Loader2, AlertTriangle, X, Star, Sparkles, CloudUpload } from "lucide-react";
import { useSync } from "../lib/sync";

/* ---------------- Logo ---------------- */
export function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="lg-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6a2640" /><stop offset="1" stopColor="#2a0f1b" /></linearGradient>
        <linearGradient id="lg-o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3dcaa" /><stop offset="1" stopColor="#b8853a" /></linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="url(#lg-b)" />
      <circle cx="256" cy="256" r="168" fill="none" stroke="url(#lg-o)" strokeWidth="6" opacity=".5" />
      <path d="M256 104C268 210 302 244 408 256C302 268 268 302 256 408C244 302 210 268 104 256C210 244 244 210 256 104Z" fill="url(#lg-o)" />
      <path d="M362 132C366 160 376 170 404 174C376 178 366 188 362 216C358 188 348 178 320 174C348 170 358 160 362 132Z" fill="#f3dcaa" />
    </svg>
  );
}
Logo.propTypes = { size: PropTypes.number };

/* ---------------- Badge de sincronización ---------------- */
export function SyncBadge({ compact = false, smart = false }) {
  const s = useSync();
  let cls = "ok", icon = <Check size={13} strokeWidth={3} />, label = "Sincronizado";
  if (!s.online) { cls = "off"; icon = <CloudOff size={13} />; label = s.queued ? `Sin señal · ${s.queued} en cola` : "Sin conexión"; }
  else if (s.pending > 0) { cls = "saving"; icon = <Loader2 size={13} className="spin" />; label = "Guardando…"; }
  else if (s.queued > 0) { cls = "saving"; icon = <CloudUpload size={13} />; label = `${s.queued} por subir`; }
  else if (s.error) { cls = "err"; icon = <AlertTriangle size={13} />; label = "Revisar"; }
  if (smart) compact = cls === "ok";
  return (
    <span className={`sync-badge ${cls} ${compact ? "compact" : ""}`} title={label} role="status" aria-live="polite">
      {icon}{!compact && <span>{label}</span>}
    </span>
  );
}
SyncBadge.propTypes = { compact: PropTypes.bool, smart: PropTypes.bool };

/* ---------------- Toasts ---------------- */
let toasts = [];
const tSubs = new Set();
const tEmit = () => tSubs.forEach((f) => f());
export function toast(msg, type = "ok", ms = 3200) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, msg, type }].slice(-3);
  tEmit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); tEmit(); }, ms);
}
export function Toaster() {
  const list = useSyncExternalStore((f) => { tSubs.add(f); return () => tSubs.delete(f); }, () => toasts);
  return (
    <div className="toaster" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "error" ? <AlertTriangle size={16} /> : t.type === "gold" ? <Sparkles size={16} /> : <Check size={16} />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Bottom sheet ---------------- */
export function Sheet({ open, onClose, title, subtitle, children, footer, tall = false }) {
  const [show, setShow] = useState(open);
  useEffect(() => {
    if (open) setShow(true);
    else { const t = setTimeout(() => setShow(false), 260); return () => clearTimeout(t); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("no-scroll"); };
  }, [open, onClose]);
  if (!show) return null;
  return createPortal(
    <div className={`sheet-wrap ${open ? "in" : "out"}`} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`sheet ${tall ? "tall" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        {(title || onClose) && (
          <div className="sheet-head">
            <div>
              {title && <h3>{title}</h3>}
              {subtitle && <p>{subtitle}</p>}
            </div>
            {onClose && <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>}
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
Sheet.propTypes = { open: PropTypes.bool, onClose: PropTypes.func, title: PropTypes.node, subtitle: PropTypes.node, children: PropTypes.node, footer: PropTypes.node, tall: PropTypes.bool };

/* ---------------- Estrellas ---------------- */
export function Stars({ value = 5, onChange, size = 14 }) {
  return (
    <span className={`stars ${onChange ? "edit" : ""}`} aria-label={`${value} estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = value >= i ? 1 : value >= i - 0.5 ? 0.5 : 0;
        const el = (
          <span className="star" key={i} style={{ "--fill": `${fill * 100}%` }}>
            <Star size={size} className="s-bg" />
            <span className="s-fg"><Star size={size} /></span>
          </span>
        );
        return onChange ? <button type="button" key={i} onClick={() => onChange(i)} aria-label={`${i} estrellas`}>{el}</button> : el;
      })}
    </span>
  );
}
Stars.propTypes = { value: PropTypes.number, onChange: PropTypes.func, size: PropTypes.number };

/* ---------------- Avatar ---------------- */
export function Avatar({ user, size = 44, ring = false }) {
  const name = user?.Nombre || "?";
  const ini = name.split(/\s+/).filter((w) => /\w/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const color = user?.Color || "#8a2f4c";
  return (
    <span className={`avatar ${ring ? "ring" : ""}`} style={{ width: size, height: size, "--c": color, fontSize: size * 0.36 }}>
      {user?.Foto_URL ? <img src={user.Foto_URL} alt={name} loading="lazy" /> : ini}
    </span>
  );
}
Avatar.propTypes = { user: PropTypes.object, size: PropTypes.number, ring: PropTypes.bool };

/* ---------------- Segmented ---------------- */
export function Segmented({ options, value, onChange, small }) {
  return (
    <div className={`segmented ${small ? "sm" : ""}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)} type="button">
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}
Segmented.propTypes = { options: PropTypes.array.isRequired, value: PropTypes.any, onChange: PropTypes.func.isRequired, small: PropTypes.bool };

/* ---------------- Estado de cita ---------------- */
export const ESTADOS = {
  reservada: { label: "Reservada", cls: "res" },
  en_curso: { label: "En silla", cls: "cur" },
  completada: { label: "Completada", cls: "done" },
  cancelada: { label: "Cancelada", cls: "can" },
  no_asistio: { label: "No asistió", cls: "no" },
};
export function StatusPill({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.reservada;
  return <span className={`pill st-${e.cls}`}><i />{e.label}</span>;
}
StatusPill.propTypes = { estado: PropTypes.string };

export function Skeleton({ h = 16, w = "100%", r = 12, style }) {
  return <span className="skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}
Skeleton.propTypes = { h: PropTypes.any, w: PropTypes.any, r: PropTypes.any, style: PropTypes.object };

export function Empty({ icon, title, text, children }) {
  return (
    <div className="empty">
      <div className="empty-ico">{icon || <Sparkles size={22} />}</div>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
Empty.propTypes = { icon: PropTypes.node, title: PropTypes.node, text: PropTypes.node, children: PropTypes.node };

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
Field.propTypes = { label: PropTypes.node, hint: PropTypes.node, children: PropTypes.node };

export function Spinner({ size = 18 }) { return <Loader2 size={size} className="spin" />; }
Spinner.propTypes = { size: PropTypes.number };
