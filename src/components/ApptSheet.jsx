/* Hoja de detalle de una cita: llegó, finalizar y cobrar, mover, mensaje, cancelar */
import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Play, CheckCircle2, MoveRight, MessageCircle, XCircle, UserX, Phone, Wallet, Banknote, KeyRound, Clock3, Scissors,
  FastForward, Send, ChevronLeft, Stamp, CalendarClock,
} from "lucide-react";
import { Sheet, StatusPill, Avatar, Segmented, toast, Spinner } from "./ui";
import { SlotPicker } from "./SlotPicker";
import { useApp, replaceCita } from "../lib/store";
import { nice, h12, prettyDate, durLabel, money, phonePretty, waLink, toMin, toHHMM, todayStr, nowMin } from "../lib/time";
import { busyOf, nextFree } from "../lib/slots";

const TEMPLATES = [
  "¿Puedes llegar 10 minutos más tarde? Te espero ✦",
  "Voy un poquito atrasado, te aviso apenas esté listo.",
  "¡Ya te estoy esperando en la silla! ✦",
  "Recuerda tu cita de hoy. ¡Te esperamos en Stars Fashion!",
];
const TIPS = [0, 2000, 5000, 10000];

export function ApptSheet({ cita, onClose }) {
  const { data, mutate, perms, me } = useApp();
  const [mode, setMode] = useState("main");
  const [pay, setPay] = useState({ metodo: cita?.Metodo_Pago || "llave", propina: Number(cita?.Propina) || 0, precio: Number(cita?.Precio) || 0 });
  const [move, setMove] = useState(null);
  const [moveBarber, setMoveBarber] = useState(cita?.Barbero_Id);
  const [force, setForce] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const live = useMemo(() => data?.citas?.find((c) => c.Id === cita?.Id) || cita, [data, cita]);
  const barbers = useMemo(() => (data?.users || []).filter((u) => String(u.Rol).includes("barber") && u.Activo !== false && (perms.manage || u.User_Id === me?.User_Id)), [data, perms, me]);
  if (!cita) return <Sheet open={false} />;
  const c = live;
  const pending = String(c.Id).startsWith("tmp");
  const src = { citas: data.citas, bloqueos: data.bloqueos };

  const update = (changes, okMsg) => {
    const id = c.Id;
    return mutate("appt_update", { id, changes }, {
      apply: (d) => replaceCita(d, id, changes.Hora_Inicio ? { ...changes, Hora_Fin: toHHMM(toMin(changes.Hora_Inicio) + Number(c.Duracion_Min)) } : changes),
      done: (res, d) => replaceCita(d, id, res.cita),
      okMsg,
    });
  };

  const start = () => { update({ Estado: "en_curso" }, "Servicio iniciado ✦"); onClose(); };
  const finish = () => {
    update({ Estado: "completada", Metodo_Pago: pay.metodo, Propina: pay.propina, Precio: pay.precio }, "Servicio cerrado · sello asignado ✦");
    onClose();
  };
  const doMove = () => {
    if (!move?.hora && move?.hora !== 0) return;
    update({ Fecha: move.fecha, Hora_Inicio: toHHMM(move.hora), Barbero_Id: move.barberId || moveBarber }, "Cita movida · le avisamos al cliente");
    onClose();
  };
  const quickNext = () => {
    const u = data.users.find((x) => x.User_Id === c.Barbero_Id);
    const busy = busyOf(c.Barbero_Id, c.Fecha, src, c.Id);
    const from = Math.max(toMin(c.Hora_Inicio) + 1, c.Fecha === todayStr() ? nowMin() : 0);
    const t = nextFree(u, c.Fecha, from, Number(c.Duracion_Min), busy, { cfg: data.config });
    if (t === null) return toast("No hay otro hueco hoy. Elige día y hora abajo.", "info");
    setMove({ fecha: c.Fecha, hora: t, barberId: c.Barbero_Id });
    toast(`Siguiente hueco: ${h12(toHHMM(t))}. Toca "Mover aquí".`, "gold");
  };
  const sendMsg = async (alsoWa) => {
    const text = msg.trim();
    if (!text) return;
    if (alsoWa && c.Cliente_Telefono) window.open(waLink(c.Cliente_Telefono, text), "_blank");
    setSending(true);
    try {
      await mutate("message_send", { cita_id: c.Id, tipo: "personalizado", mensaje: text }, { okMsg: "Mensaje enviado al cliente ✦" });
      setMode("main"); setMsg("");
    } catch { /* toast ya mostrado */ } finally { setSending(false); }
  };

  const back = <button className="link-back" onClick={() => setMode("main")}><ChevronLeft size={16} /> Volver</button>;

  let body, footer;
  if (mode === "pay") {
    body = (
      <div className="fade-in">
        {back}
        <p className="eyebrow" style={{ margin: "12px 0 8px" }}>¿Cómo pagó?</p>
        <div className="pay-opts">
          <button className={pay.metodo === "llave" ? "on" : ""} onClick={() => setPay({ ...pay, metodo: "llave" })}><KeyRound size={22} /><b>Llave</b><small>{data.config?.Llave_Pago || "Bre-B / Nequi"}</small></button>
          <button className={pay.metodo === "efectivo" ? "on" : ""} onClick={() => setPay({ ...pay, metodo: "efectivo" })}><Banknote size={22} /><b>Efectivo</b><small>En caja</small></button>
        </div>
        <p className="eyebrow" style={{ margin: "16px 0 8px" }}>Propina</p>
        <div className="chips">
          {TIPS.map((t) => <button key={t} className={`chip ${pay.propina === t ? "on" : ""}`} onClick={() => setPay({ ...pay, propina: t })}>{t ? money(t) : "Sin propina"}</button>)}
        </div>
        <label className="field" style={{ marginTop: 14 }}>
          <span className="field-label">Valor del servicio</span>
          <input type="number" inputMode="numeric" value={pay.precio} onChange={(e) => setPay({ ...pay, precio: Number(e.target.value) })} />
        </label>
        <div className="pay-total"><span>Total</span><b className="display num">{money(pay.precio + pay.propina)}</b></div>
        <p className="muted small-note"><Stamp size={14} /> Si el cliente está en el club, el sello se le pone solo.</p>
      </div>
    );
    footer = <button className="btn btn-sage" onClick={finish}><CheckCircle2 size={18} /> Cerrar servicio</button>;
  } else if (mode === "move") {
    body = (
      <div className="fade-in">
        {back}
        <button className="quick-next" onClick={quickNext}><FastForward size={18} /> <span><b>Mover al siguiente hueco libre</b><small>Ideal si el cliente no llegó a tiempo</small></span></button>
        {perms.manage && barbers.length > 1 && (
          <div className="barber-pick">
            {barbers.map((b) => (
              <button key={b.User_Id} className={moveBarber === b.User_Id ? "on" : ""} onClick={() => { setMoveBarber(b.User_Id); setMove(null); }}>
                <Avatar user={b} size={30} /><span>{b.Nombre.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        )}
        <label className="check" style={{ margin: "8px 0 12px" }}>
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          <span><b>Permitir fuera de horario</b><small>Incluye almuerzo y horas fuera del turno</small></span>
        </label>
        <SlotPicker barbers={barbers} barberId={moveBarber} dur={Number(c.Duracion_Min)} src={src} cfg={data.config} excludeId={c.Id} force={force}
          value={move ? { ...move } : { fecha: c.Fecha, hora: null }} onChange={(v) => setMove({ ...v, barberId: v.barberId || moveBarber })} showLunch />
      </div>
    );
    footer = <button className="btn btn-primary" disabled={!move || move.hora === null || move.hora === undefined} onClick={doMove}>
      <MoveRight size={18} /> {move?.hora != null ? `Mover a ${h12(toHHMM(move.hora))}` : "Elige la nueva hora"}
    </button>;
  } else if (mode === "msg") {
    body = (
      <div className="fade-in">
        {back}
        <p className="muted" style={{ margin: "10px 0" }}>El cliente lo ve en <b>Mis citas</b> (y como notificación si las activó).</p>
        <div className="tpl-list">
          {TEMPLATES.map((t) => <button key={t} className={msg === t ? "on" : ""} onClick={() => setMsg(t)}>{t}</button>)}
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span className="field-label">Mensaje</span>
          <textarea value={msg} maxLength={400} onChange={(e) => setMsg(e.target.value)} placeholder="Escribe algo para tu cliente…" />
        </label>
      </div>
    );
    footer = (
      <>
        {c.Cliente_Telefono && <button className="btn btn-ghost" disabled={!msg.trim() || sending} onClick={() => sendMsg(true)}>+ WhatsApp</button>}
        <button className="btn btn-primary" disabled={!msg.trim() || sending} onClick={() => sendMsg(false)}>{sending ? <Spinner /> : <Send size={17} />} Enviar</button>
      </>
    );
  } else {
    body = (
      <div className="fade-in">
        <div className="appt-hero">
          <div className="appt-time">
            <b className="display num">{h12(c.Hora_Inicio)}</b>
            <span>hasta {h12(c.Hora_Fin)}</span>
          </div>
          <StatusPill estado={c.Estado} />
        </div>
        <div className="appt-info">
          <div><Scissors size={16} /><span>{nice(c.Servicio_Nombre)}</span></div>
          <div><Clock3 size={16} /><span>{prettyDate(c.Fecha)} · {durLabel(c.Duracion_Min)}</span></div>
          <div><Wallet size={16} /><span className="num">{money(c.Precio)}{Number(c.Propina) ? ` + ${money(c.Propina)} propina` : ""}{c.Metodo_Pago ? ` · ${c.Metodo_Pago}` : ""}</span></div>
          {perms.manage && <div><CalendarClock size={16} /><span>Barbero: {c.Barbero_Nombre}</span></div>}
          {c.Notas && <div className="appt-note">“{c.Notas}”</div>}
        </div>
        <div className="client-row">
          <Avatar user={{ Nombre: c.Cliente_Nombre, Color: "#b8853a" }} size={44} />
          <div className="grow">
            <b>{c.Cliente_Nombre}</b>
            <small className="muted">{c.Cliente_Telefono ? phonePretty(c.Cliente_Telefono) : "Sin celular"} · {c.Origen === "cliente" ? "Reservó en línea" : "Agendado por barbero"}</small>
          </div>
          {c.Cliente_Telefono && (
            <>
              <a className="icon-btn" href={`tel:+${c.Cliente_Telefono}`} aria-label="Llamar"><Phone size={17} /></a>
              <a className="icon-btn wa" href={waLink(c.Cliente_Telefono, `Hola ${c.Cliente_Nombre.split(" ")[0]}, te escribe ${me?.Nombre?.split(" ")[0] || "tu barbero"} de Stars Fashion ✦`)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={17} /></a>
            </>
          )}
        </div>
        {pending && <p className="muted small-note"><Spinner size={14} /> Guardando la cita… las acciones se activan en un segundo.</p>}

        {!pending && c.Estado === "reservada" && (
          <div className="action-grid">
            <button className="act gold" onClick={start}><Play size={20} /><b>Llegó · iniciar</b></button>
            <button className="act" onClick={() => setMode("move")}><MoveRight size={20} /><b>Mover</b></button>
            <button className="act" onClick={() => setMode("msg")}><MessageCircle size={20} /><b>Mensaje</b></button>
            <button className="act" onClick={() => { update({ Estado: "no_asistio" }, "Marcado como no asistió"); onClose(); }}><UserX size={20} /><b>No vino</b></button>
            <button className="act danger" onClick={() => { if (confirm("¿Cancelar esta cita?")) { update({ Estado: "cancelada" }, "Cita cancelada"); onClose(); } }}><XCircle size={20} /><b>Cancelar</b></button>
          </div>
        )}
        {!pending && c.Estado === "en_curso" && (
          <div className="action-grid">
            <button className="act sage wide" onClick={() => setMode("pay")}><CheckCircle2 size={20} /><b>Finalizar y cobrar</b></button>
            <button className="act" onClick={() => setMode("msg")}><MessageCircle size={20} /><b>Mensaje</b></button>
          </div>
        )}
        {!pending && c.Estado === "completada" && (
          <div style={{ marginTop: 14 }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Método de pago</p>
            <Segmented value={c.Metodo_Pago || ""} onChange={(v) => update({ Metodo_Pago: v }, "Pago actualizado")}
              options={[{ value: "llave", label: "Llave", icon: <KeyRound size={15} /> }, { value: "efectivo", label: "Efectivo", icon: <Banknote size={15} /> }]} />
            {c.Sello === true || String(c.Sello).toUpperCase() === "TRUE" ? <p className="muted small-note"><Stamp size={14} /> Sello de fidelización asignado.</p> : null}
          </div>
        )}
        {!pending && (c.Estado === "cancelada" || c.Estado === "no_asistio") && (
          <button className="btn btn-ghost block" style={{ marginTop: 14 }} onClick={() => update({ Estado: "reservada" }, "Cita reactivada")}>Reactivar cita</button>
        )}
      </div>
    );
  }

  return (
    <Sheet open={!!cita} onClose={onClose} tall={mode === "move"}
      title={mode === "pay" ? "Cerrar servicio" : mode === "move" ? "Mover cita" : mode === "msg" ? "Mensaje privado" : c.Cliente_Nombre}
      subtitle={mode === "main" ? c.Codigo : `${c.Cliente_Nombre} · ${nice(c.Servicio_Nombre)}`} footer={footer}>
      {body}
    </Sheet>
  );
}
ApptSheet.propTypes = { cita: PropTypes.object, onClose: PropTypes.func.isRequired };
