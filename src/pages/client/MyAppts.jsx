import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Phone, Search, CalendarPlus, RefreshCw, XCircle, MessageSquareText, Bell, Gift, CalendarHeart } from "lucide-react";
import { usePublic } from "./ClientLayout";
import { apiPost } from "../../lib/api";
import { track } from "../../lib/sync";
import { nice, h12, prettyDate, money, phoneNorm, phonePretty, todayStr, nowMin, toMin } from "../../lib/time";
import { StatusPill, Skeleton, Empty, toast, Spinner } from "../../components/ui";
import { gcalLink, saveMine } from "./Booking";
import { enableNotifications, permission, localNotify, once } from "../../lib/push";

export function MyAppts() {
  const { client, setClient, pub, refresh } = usePublic();
  const nav = useNavigate();
  const [tel, setTel] = useState(client.telefono ? phonePretty(client.telefono) : "");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState(permission());
  const first = useRef(true);

  const lookup = useCallback(async (silent) => {
    const t = phoneNorm(tel);
    if (t.length < 12) { if (!silent) toast("Escribe tu celular de 10 dígitos.", "error"); return; }
    if (!silent) setBusy(true);
    try {
      const r = await (silent ? apiPost("client_lookup", { telefono: t }) : track(apiPost("client_lookup", { telefono: t })));
      setClient({ telefono: t });
      (r.mensajes || []).forEach((m) => { if (!first.current && once("msg_" + m.Id)) localNotify(`${m.Barbero_Nombre} · Stars Fashion`, m.Mensaje, "/clientes/mis-citas", m.Id); else once("msg_" + m.Id); });
      first.current = false;
      setRes(r);
    } catch (e) { if (!silent) toast(e.message, "error"); } finally { setBusy(false); }
  }, [tel, setClient]);

  useEffect(() => { if (client.telefono) lookup(true); }, []); // eslint-disable-line
  useEffect(() => { if (!res) return; const id = setInterval(() => lookup(true), 60000); return () => clearInterval(id); }, [res, lookup]);

  const t = todayStr(), n = nowMin();
  const citas = (res?.citas || []).slice().sort((a, b) => (a.Fecha + a.Hora_Inicio).localeCompare(b.Fecha + b.Hora_Inicio));
  const upcoming = citas.filter((c) => (c.Estado === "reservada" || c.Estado === "en_curso") && (c.Fecha > t || (c.Fecha === t && toMin(c.Hora_Fin) > n)));
  const past = citas.filter((c) => !upcoming.includes(c)).reverse().slice(0, 8);
  const msgs = (res?.mensajes || []).slice().reverse();

  const cancel = async (c) => {
    if (!confirm(`¿Cancelar tu cita del ${prettyDate(c.Fecha)} a las ${h12(c.Hora_Inicio)}?`)) return;
    setRes((r) => ({ ...r, citas: r.citas.map((x) => (x.Id === c.Id ? { ...x, Estado: "cancelada" } : x)) }));
    try { await track(apiPost("client_cancel", { id: c.Id, telefono: phoneNorm(tel) })); toast("Cita cancelada. ¡Te esperamos pronto! ✦"); refresh().catch(() => {}); saveMine({ ...c, Estado: "cancelada" }); }
    catch (e) { toast(e.message, "error"); lookup(true); }
  };

  return (
    <main className="booking">
      <header className="bk-head">
        <button className="icon-btn" onClick={() => nav("/clientes")} aria-label="Atrás"><ChevronLeft size={19} /></button>
        <div className="grow"><span className="eyebrow">Tu espacio</span><h1 className="display">Mis citas</h1></div>
      </header>

      <form className="lookup glass" onSubmit={(e) => { e.preventDefault(); lookup(false); }}>
        <div className="input-ico grow"><Phone size={17} /><input className="input" inputMode="tel" placeholder="Tu celular" value={tel} onChange={(e) => setTel(e.target.value)} /></div>
        <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? <Spinner /> : <Search size={17} />}</button>
      </form>

      {res && perm !== "granted" && perm !== "unsupported" && (
        <button className="notif-banner" onClick={async () => { const r = await enableNotifications({ telefono: phoneNorm(tel) }); setPerm(permission()); if (!r.ok && r.reason === "ios") toast("En iPhone: Compartir → Agregar a inicio", "info", 5000); }}>
          <Bell size={18} /><span><b>Avísame de mi cita</b><small>Recordatorio y mensajes de tu barbero</small></span>
        </button>
      )}

      {busy && !res ? <div style={{ display: "grid", gap: 10 }}><Skeleton h={130} r={22} /><Skeleton h={90} r={22} /></div> : !res ? (
        <Empty icon={<CalendarHeart size={22} />} title="Escribe tu celular" text="Con tu número vemos tus citas, mensajes y tu tarjeta Stars." />
      ) : (
        <div className="stagger">
          {msgs.length > 0 && (
            <section className="inbox glass strong">
              <h3 className="card-t"><MessageSquareText size={17} /> Mensajes de tu barbero</h3>
              {msgs.slice(0, 4).map((m) => (
                <div key={m.Id} className="msg"><b>{m.Barbero_Nombre}</b><p>{m.Mensaje}</p><small className="muted">{new Date(m.Creado).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small></div>
              ))}
            </section>
          )}

          {res.card && (
            <Link to="/clientes/club" className="ticket-club glass"><Gift size={20} /><div className="grow"><b>{res.card.Sellos} de {res.card.Max} sellos</b><small>{res.card.Premio_Pendiente ? "¡Tienes una SORPRESA esperándote! 🎁" : `Te faltan ${Math.max(0, res.card.Premio_En - res.card.Sellos)} para tu sorpresa`}</small></div></Link>
          )}

          <div className="title-row"><h2>Próximas</h2><Link to="/clientes/reservar">+ Reservar</Link></div>
          {upcoming.length === 0 ? <div className="glass"><Empty title="No tienes citas próximas" text="¿Te agendamos una?"><Link to="/clientes/reservar" className="btn btn-sm btn-gold">Reservar ahora</Link></Empty></div> : upcoming.map((c) => (
            <article key={c.Id} className="glass appt-card">
              <div className="row">
                <div className="appt-date"><b className="display">{Number(c.Fecha.slice(8))}</b><small>{prettyDate(c.Fecha, { short: true }).split(" ")[0]}</small></div>
                <div className="grow"><b>{h12(c.Hora_Inicio)} · {c.Barbero_Nombre}</b><small className="muted ellipsis">{nice(c.Servicio_Nombre)} · {money(c.Precio)}</small></div>
                <StatusPill estado={c.Estado} />
              </div>
              <div className="appt-actions">
                <a className="btn btn-xs btn-ghost" href={gcalLink(c, pub?.config)} target="_blank" rel="noreferrer"><CalendarPlus size={13} /> Calendario</a>
                {c.Estado === "reservada" && <>
                  <button className="btn btn-xs btn-soft" onClick={() => nav("/clientes/reservar", { state: { reschedule: c } })}><RefreshCw size={13} /> Reprogramar</button>
                  <button className="btn btn-xs btn-danger" onClick={() => cancel(c)}><XCircle size={13} /> Cancelar</button>
                </>}
              </div>
              <small className="muted code">Código {c.Codigo}</small>
            </article>
          ))}

          {past.length > 0 && (
            <>
              <div className="title-row"><h2>Historial</h2></div>
              <div className="glass"><ul className="list">
                {past.map((c) => <li key={c.Id}><div className="grow"><b>{prettyDate(c.Fecha, { short: true })} · {h12(c.Hora_Inicio)}</b><small>{nice(c.Servicio_Nombre)} · {c.Barbero_Nombre}</small></div><StatusPill estado={c.Estado} /></li>)}
              </ul></div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
