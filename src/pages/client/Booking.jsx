import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Crown, Sparkles, User, Phone, Mail, Check, CalendarPlus, MapPin, Gift, Loader2, Clock3, Scissors, Shuffle } from "lucide-react";
import { usePublic } from "./ClientLayout";
import { apiPost } from "../../lib/api";
import { track } from "../../lib/sync";
import { Avatar, Stars, Skeleton, toast, Field } from "../../components/ui";
import { SlotPicker } from "../../components/SlotPicker";
import { nice, h12, toHHMM, prettyDate, money, durLabel, phoneNorm, waLink, toMin } from "../../lib/time";
import { sendBookingEmail } from "../../lib/email";

const STEPS = ["Servicio", "Barbero", "Hora", "Tus datos"];

export const gcalLink = (c, cfg) => {
  const d = c.Fecha.replace(/-/g, "");
  const s = c.Hora_Inicio.replace(":", "") + "00", e = c.Hora_Fin.replace(":", "") + "00";
  const p = new URLSearchParams({
    action: "TEMPLATE", text: `${nice(c.Servicio_Nombre)} · ${cfg?.Negocio || "Stars Fashion"}`,
    dates: `${d}T${s}/${d}T${e}`, ctz: "America/Bogota", location: cfg?.Direccion || "", details: `Con ${c.Barbero_Nombre} · Código ${c.Codigo || ""}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
};

export const saveMine = (c) => {
  try {
    const l = JSON.parse(localStorage.getItem("sf_my_bookings") || "[]").filter((x) => x.Id !== c.Id);
    localStorage.setItem("sf_my_bookings", JSON.stringify([c, ...l].slice(0, 20)));
  } catch { /* */ }
};

export function Booking() {
  const { pub, loading, refresh, client, setClient, addBusy } = usePublic();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const loc = useLocation();
  const resched = loc.state?.reschedule || null;            // cita a reprogramar
  const [step, setStep] = useState(resched ? 2 : 0);
  const [svc, setSvc] = useState(resched?.Servicio_Id || q.get("servicio") || null);
  const [bid, setBid] = useState(resched?.Barbero_Id || q.get("barbero") || null);
  const [slot, setSlot] = useState({ fecha: resched?.Fecha, hora: null, barberId: null });
  const [form, setForm] = useState({ nombre: client.nombre || "", telefono: client.telefono || "", email: client.email || "", notas: "", club: true });
  const [done, setDone] = useState(null);                   // { cita, card, syncing }

  useEffect(() => { if (q.get("servicio") && !resched) setStep(q.get("barbero") ? 2 : 1); else if (q.get("barbero") && !resched) setStep(0); }, []); // eslint-disable-line

  const services = pub?.services || [];
  const barbers = pub?.barbers || [];
  const service = services.find((s) => s.Id === svc);
  const dur = resched ? Number(resched.Duracion_Min) : service?.Duracion_Min;
  const src = useMemo(() => ({ busy: pub?.busy || [] }), [pub]);
  const chosen = barbers.find((b) => b.User_Id === (slot.barberId || bid));

  const go = (n) => { setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const confirm = async () => {
    const tel = phoneNorm(form.telefono);
    if (!form.nombre.trim()) return toast("Escribe tu nombre.", "error");
    if (tel.length < 12) return toast("Escribe tu celular de 10 dígitos.", "error");
    setClient({ nombre: form.nombre.trim(), telefono: tel, email: form.email.trim() });
    const b = chosen;
    const optimistic = {
      Id: "tmp", Codigo: "…", Fecha: slot.fecha, Hora_Inicio: toHHMM(slot.hora), Hora_Fin: toHHMM(slot.hora + dur), Duracion_Min: dur,
      Barbero_Id: b.User_Id, Barbero_Nombre: b.Nombre, Servicio_Id: service.Id, Servicio_Nombre: service.Nombre, Precio: service.Precio,
      Cliente_Nombre: form.nombre.trim(), Cliente_Email: form.email.trim(), Estado: "reservada",
    };
    setDone({ cita: optimistic, syncing: true });            // pantalla de éxito al instante
    addBusy({ b: b.User_Id, f: slot.fecha, s: optimistic.Hora_Inicio, e: optimistic.Hora_Fin });
    try {
      const res = await track(apiPost("book", { booking: { servicio_id: service.Id, barbero_id: b.User_Id, fecha: slot.fecha, hora: optimistic.Hora_Inicio, nombre: form.nombre.trim(), telefono: tel, email: form.email.trim(), notas: form.notas, club: form.club } }));
      setDone({ cita: res.cita, card: res.card, syncing: false });
      saveMine(res.cita);
      sendBookingEmail({ cita: res.cita, config: pub.config, prettyDate: prettyDate(res.cita.Fecha), timeLabel: h12(res.cita.Hora_Inicio) });
      refresh().catch(() => {});
    } catch (e) {
      setDone(null);
      toast(e.message, "error", 4500);
      await refresh().catch(() => {});
      if (e.code === "slot" || e.network) { setSlot((s) => ({ ...s, hora: null })); go(2); }
    }
  };

  const reschedule = async () => {
    const b = chosen;
    const hora = toHHMM(slot.hora);
    const next = { ...resched, Fecha: slot.fecha, Hora_Inicio: hora, Hora_Fin: toHHMM(slot.hora + dur), Barbero_Id: b.User_Id, Barbero_Nombre: b.Nombre };
    setDone({ cita: next, syncing: true, moved: true });
    try {
      const res = await track(apiPost("client_reschedule", { id: resched.Id, telefono: client.telefono, fecha: slot.fecha, hora, barbero_id: b.User_Id }));
      setDone({ cita: res.cita, syncing: false, moved: true });
      saveMine(res.cita);
      refresh().catch(() => {});
    } catch (e) {
      setDone(null); toast(e.message, "error", 4500); refresh().catch(() => {});
    }
  };

  if (done) return <Ticket done={done} cfg={pub?.config} />;

  return (
    <main className="booking">
      <header className="bk-head">
        <button className="icon-btn" onClick={() => (step === 0 || resched ? nav(-1) : go(step - 1))} aria-label="Atrás"><ChevronLeft size={19} /></button>
        <div className="grow">
          <span className="eyebrow">{resched ? "Reprogramar" : `Paso ${step + 1} de 4`}</span>
          <h1 className="display">{resched ? "Nueva hora" : STEPS[step]}</h1>
        </div>
      </header>
      {!resched && <div className="bk-progress"><i style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>}

      {step === 0 && (
        <div className="svc-list stagger">
          {loading ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h={92} r={22} />) : services.map((s) => (
            <button key={s.Id} className={`svc glass pick ${s.Destacado ? "vip" : ""} ${svc === s.Id ? "on" : ""}`} onClick={() => { setSvc(s.Id); setSlot({ fecha: slot.fecha, hora: null }); go(bid ? 2 : 1); }}>
              <div className="svc-top">
                <div className="grow">
                  <b>{s.Destacado && <Crown size={14} className="gold-ico" />} {nice(s.Nombre)}</b>
                  <small>{s.Resumen}</small>
                  <span className="svc-meta"><Clock3 size={12} /> {durLabel(s.Duracion_Min)} · {s.Incluye.length} incluidos</span>
                </div>
                <span className="display num price">{money(s.Precio)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="bk-barbers stagger">
          <button className={`glass bk-barber any ${bid === "any" ? "on" : ""}`} onClick={() => { setBid("any"); go(2); }}>
            <span className="any-ico"><Shuffle size={22} /></span>
            <div className="grow"><b>El primero disponible</b><small>Te mostramos todas las horas libres ✦</small></div>
          </button>
          {barbers.map((b) => (
            <button key={b.User_Id} className={`glass bk-barber ${bid === b.User_Id ? "on" : ""}`} onClick={() => { setBid(b.User_Id); setSlot({ fecha: slot.fecha, hora: null }); go(2); }}>
              <Avatar user={b} size={56} ring={bid === b.User_Id} />
              <div className="grow">
                <b className="display">{b.Nombre}</b>
                <div className="row" style={{ gap: 6 }}><Stars value={Number(b.Estrellas) || 5} size={12} />{b.Especialidad && <small className="muted">{b.Especialidad}</small>}</div>
                {b.Descripcion && <small className="bk-desc">{b.Descripcion}</small>}
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (service || resched) && (
        <div className="fade-in">
          <div className="bk-sum glass">
            <Scissors size={16} /><span className="grow ellipsis">{nice(resched?.Servicio_Nombre || service.Nombre)} · {durLabel(dur)}</span>
            {!resched && <button className="link" onClick={() => go(1)}>{bid === "any" ? "Cualquiera" : barbers.find((b) => b.User_Id === bid)?.Nombre.split(" ")[0]}</button>}
          </div>
          <SlotPicker barbers={barbers} barberId={bid || "any"} dur={dur} src={src} cfg={pub?.config} excludeId={resched?.Id} loading={loading}
            value={slot} onChange={(v) => setSlot(v)} />
          {slot.hora !== null && slot.hora !== undefined && (
            <div className="sticky-cta">
              <div className="cta-sum"><b>{h12(toHHMM(slot.hora))} · {prettyDate(slot.fecha, { short: true })}</b><small>con {chosen?.Nombre}</small></div>
              <button className="btn btn-primary" onClick={() => (resched ? reschedule() : go(3))}>{resched ? "Confirmar cambio" : "Continuar"}</button>
            </div>
          )}
        </div>
      )}

      {step === 3 && service && (
        <div className="fade-in">
          <div className="bk-review glass strong">
            <div className="row"><Avatar user={chosen} size={46} /><div className="grow"><b>{nice(service.Nombre)}</b><small className="muted">con {chosen?.Nombre} · {durLabel(dur)}</small></div><span className="display num price">{money(service.Precio)}</span></div>
            <div className="bk-when"><CalendarPlus size={16} /><b>{prettyDate(slot.fecha)}</b> · {h12(toHHMM(slot.hora))} – {h12(toHHMM(slot.hora + dur))}</div>
          </div>
          <div className="glass card">
            <Field label="Tu nombre"><div className="input-ico"><User size={17} /><input autoComplete="name" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="¿Cómo te llamas?" /></div></Field>
            <Field label="Celular (WhatsApp)" hint="Es tu ID para ver tus citas y tu tarjeta de sellos"><div className="input-ico"><Phone size={17} /><input inputMode="tel" autoComplete="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="300 123 4567" /></div></Field>
            <Field label="Correo" hint="Te enviamos la confirmación"><div className="input-ico"><Mail size={17} /><input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tu@correo.com" /></div></Field>
            <Field label="¿Algo que debamos saber? (opcional)"><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Ej: quiero un fade bajo" /></Field>
            <label className={`check club-opt ${form.club ? "on" : ""}`}>
              <input type="checkbox" checked={form.club} onChange={(e) => setForm({ ...form, club: e.target.checked })} />
              <span><b><Gift size={15} /> Quiero ser parte del Club Stars</b><small>Tarjeta de 10 sellos con tu celular. En el sello 8 te espera una <b>SORPRESA</b>.</small></span>
            </label>
          </div>
          <div className="sticky-cta">
            <div className="cta-sum"><b className="num">{money(service.Precio)}</b><small>Pagas en la barbería · llave o efectivo</small></div>
            <button className="btn btn-gold" onClick={confirm}><Sparkles size={18} /> Reservar</button>
          </div>
        </div>
      )}
    </main>
  );
}

function Ticket({ done, cfg }) {
  const { cita: c, card, syncing, moved } = done;
  return (
    <main className="booking ticket-page">
      <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</div>
      <div className="ticket fade-in">
        <div className="ticket-top">
          <span className={`ticket-check ${syncing ? "sync" : ""}`}>{syncing ? <Loader2 size={30} className="spin" /> : <Check size={34} strokeWidth={3} />}</span>
          <span className="eyebrow">{syncing ? "Confirmando con la barbería…" : moved ? "Cita reprogramada" : "¡Cita confirmada!"}</span>
          <h1 className="display">{prettyDate(c.Fecha)}</h1>
          <b className="ticket-time num">{h12(c.Hora_Inicio)}</b>
        </div>
        <div className="ticket-cut"><i /><span /><i /></div>
        <div className="ticket-body">
          <div><small>Servicio</small><b>{nice(c.Servicio_Nombre)}</b></div>
          <div className="grid2">
            <div><small>Barbero</small><b>{c.Barbero_Nombre}</b></div>
            <div><small>Valor</small><b className="num">{money(c.Precio)}</b></div>
          </div>
          <div className="grid2">
            <div><small>Duración</small><b>{durLabel(c.Duracion_Min || toMin(c.Hora_Fin) - toMin(c.Hora_Inicio))}</b></div>
            <div><small>Código</small><b className="num code">{c.Codigo}</b></div>
          </div>
          <div className="ticket-addr"><MapPin size={15} /> {cfg?.Direccion}</div>
          <span className={`sync-badge ${syncing ? "saving" : "ok"}`}>{syncing ? <><Loader2 size={13} className="spin" /> Guardando…</> : <><Check size={13} strokeWidth={3} /> Guardado en la agenda</>}</span>
        </div>
      </div>

      {card && !syncing && (
        <Link to="/clientes/club" className="ticket-club glass fade-in">
          <Gift size={20} /><div className="grow"><b>Club Stars activo</b><small>Llevas {card.Sellos} de {card.Max} sellos · este servicio suma 1 al terminar</small></div>
        </Link>
      )}

      <div className="ticket-actions">
        <a className="btn btn-ghost" href={gcalLink(c, cfg)} target="_blank" rel="noreferrer" aria-disabled={syncing}><CalendarPlus size={17} /> Calendario</a>
        <a className="btn btn-ghost" href={waLink(cfg?.WhatsApp_1, `Hola ✦ reservé ${nice(c.Servicio_Nombre)} el ${prettyDate(c.Fecha)} a las ${h12(c.Hora_Inicio)} con ${c.Barbero_Nombre}. Código ${c.Codigo}`)} target="_blank" rel="noreferrer">WhatsApp</a>
      </div>
      <Link to="/clientes/mis-citas" className="btn btn-primary block">Ver mis citas</Link>
      <Link to="/clientes" className="btn btn-ghost block" style={{ marginTop: 8 }}>Volver al inicio</Link>
    </main>
  );
}
