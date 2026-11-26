import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarPlus, User, Phone, Mail, Crown, Clock3, Pencil, UserCheck, AlertTriangle, Gift, Loader2 } from "lucide-react";
import { useApp, tmpId } from "../../lib/store";
import { nice, todayStr, toMin, toHHMM, h12, prettyDate, money, durLabel, phoneNorm, phonePretty } from "../../lib/time";
import { busyOf } from "../../lib/slots";
import { apiPost } from "../../lib/api";
import { Avatar, Field, toast } from "../../components/ui";
import { SlotPicker } from "../../components/SlotPicker";
import { sendBookingEmail } from "../../lib/email";

/** busca al cliente en las citas que ya tiene el celular (instantáneo) */
function localClient(citas, tel) {
  const list = (citas || []).filter((c) => phoneNorm(c.Cliente_Telefono) === tel).sort((a, b) => (b.Fecha + b.Hora_Inicio).localeCompare(a.Fecha + a.Hora_Inicio));
  if (!list.length) return null;
  const done = list.filter((c) => c.Estado === "completada");
  return {
    Nombre: list[0].Cliente_Nombre, Email: list.find((c) => c.Cliente_Email)?.Cliente_Email || "",
    Visitas: done.length, Ultimo_Servicio: list[0].Servicio_Nombre, Ultima_Fecha: list[0].Fecha, Ultimo_Servicio_Id: list[0].Servicio_Id,
  };
}

export function NewAppt() {
  const { data, me, perms, mutate } = useApp();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const preset = !!q.get("hora");                       // vino tocando un hueco de la agenda
  const barbers = useMemo(() => (data?.users || []).filter((u) => String(u.Rol).includes("barber") && u.Activo !== false && (perms.manage || u.User_Id === me?.User_Id)), [data, perms, me]);
  const [svc, setSvc] = useState(null);
  const [bid, setBid] = useState(q.get("barbero") || (perms.barber ? me?.User_Id : barbers[0]?.User_Id));
  const [slot, setSlot] = useState(() => ({ fecha: q.get("fecha") || todayStr(), hora: preset ? toMin(q.get("hora")) : null }));
  const [pickTime, setPickTime] = useState(!preset);
  const [force, setForce] = useState(false);
  const [cli, setCli] = useState({ nombre: "", tel: "", email: "", notas: "", club: true });
  const [known, setKnown] = useState(null);             // cliente encontrado por celular
  const [looking, setLooking] = useState(false);
  const autoFilled = useRef(false);

  const service = data.services.find((s) => s.Id === svc);
  const barber = barbers.find((b) => b.User_Id === bid);
  const tel = phoneNorm(cli.tel);

  /* ---------- autocompletar cliente por celular ---------- */
  useEffect(() => {
    if (tel.length < 12) { setKnown(null); return; }
    const local = localClient(data.citas, tel);
    if (local) apply(local);
    let alive = true;
    setLooking(true);
    const t = setTimeout(() => {
      apiPost("client_find", { telefono: tel })
        .then((r) => { if (alive && r.client) apply({ ...local, ...r.client, Visitas: Math.max(r.client.Visitas || 0, local?.Visitas || 0) }); })
        .catch(() => {})
        .finally(() => alive && setLooking(false));
    }, 350);
    return () => { alive = false; clearTimeout(t); };
    function apply(c) {
      setKnown(c);
      setCli((x) => ({ ...x, nombre: !x.nombre.trim() || autoFilled.current ? c.Nombre || x.nombre : x.nombre, email: x.email || c.Email || "" }));
      autoFilled.current = true;
      if (!svc && c.Ultimo_Servicio_Id && data.services.some((s) => s.Id === c.Ultimo_Servicio_Id)) setSvc(c.Ultimo_Servicio_Id);
    }
  }, [tel]); // eslint-disable-line

  /* ---------- ¿la hora elegida choca con algo? ---------- */
  const conflict = useMemo(() => {
    if (!service || slot.hora == null || !bid) return null;
    const s = slot.hora, e = s + service.Duracion_Min;
    return busyOf(bid, slot.fecha, { citas: data.citas, bloqueos: data.bloqueos }).find((i) => s < i.e && e > i.s) || null;
  }, [service, slot, bid, data]);

  const ready = service && bid && slot.hora !== null && cli.nombre.trim() && !conflict;

  const save = () => {
    if (!ready) return toast(conflict ? "Esa hora choca con otra cita. Cambia la hora." : "Falta servicio, hora o nombre.", "error");
    const id = tmpId();
    const cita = {
      Id: id, Fecha: slot.fecha, Hora_Inicio: toHHMM(slot.hora), Hora_Fin: toHHMM(slot.hora + service.Duracion_Min), Duracion_Min: service.Duracion_Min,
      Barbero_Id: bid, Barbero_Nombre: barber.Nombre, Servicio_Id: service.Id, Servicio_Nombre: service.Nombre, Precio: service.Precio, Propina: 0,
      Cliente_Nombre: cli.nombre.trim(), Cliente_Telefono: tel, Cliente_Email: cli.email.trim(), Estado: "reservada", Origen: "barbero",
      Notas: cli.notas, club: cli.club && tel.length >= 12,
    };
    mutate("appt_create", { cita, force: true }, {
      apply: (d) => ({ ...d, citas: [...d.citas, cita] }),
      done: (res, d) => ({ ...d, citas: d.citas.map((c) => (c.Id === id ? res.cita : c)) }),
      okMsg: `Agendado: ${cita.Cliente_Nombre} · ${h12(cita.Hora_Inicio)} ✦`,
    }).then((res) => { if (res?.cita) sendBookingEmail({ cita: res.cita, config: data.config, prettyDate: prettyDate(res.cita.Fecha), timeLabel: h12(res.cita.Hora_Inicio) }); })
      .catch(() => {});
    nav(`/app/agenda?barbero=${bid}&fecha=${slot.fecha}`);
  };

  let n = 0;
  return (
    <div className="page form-page">
      <div className="page-head"><div><span className="eyebrow">Agendar personalmente</span><h1 className="display">Nueva cita</h1></div></div>

      {/* hora ya elegida desde la agenda */}
      {slot.hora !== null && !pickTime && (
        <div className="when-card">
          <Clock3 size={20} />
          <div className="grow">
            <b>{h12(toHHMM(slot.hora))}{service ? ` – ${h12(toHHMM(slot.hora + service.Duracion_Min))}` : ""}</b>
            <small>{prettyDate(slot.fecha)} · con {barber?.User_Id === me?.User_Id ? "contigo" : barber?.Nombre}</small>
          </div>
          <button className="btn btn-xs btn-ghost" onClick={() => setPickTime(true)}><Pencil size={13} /> Cambiar</button>
        </div>
      )}
      {conflict && (
        <div className="conflict" style={{ marginBottom: 14 }}>
          <AlertTriangle size={16} />
          <div><b>Con {service ? durLabel(service.Duracion_Min) : "ese servicio"} se cruza con {conflict.kind === "cita" ? conflict.ref.Cliente_Nombre : "un bloqueo"}</b><small>Elige otro servicio u otra hora.</small></div>
        </div>
      )}

      <section className="step">
        <h3><span>{++n}</span> Cliente</h3>
        <Field label="Celular (WhatsApp)" hint={known ? null : "Si ya vino antes, lo completamos solo"}>
          <div className="input-ico"><Phone size={17} /><input inputMode="tel" autoFocus={preset} value={cli.tel} onChange={(e) => setCli({ ...cli, tel: e.target.value })} placeholder="300 123 4567" />
            {looking && <Loader2 size={16} className="spin input-spin" />}</div>
        </Field>
        {known && (
          <div className="known fade-in">
            <UserCheck size={18} />
            <div className="grow"><b>{known.Nombre} · cliente {known.Visitas ? `con ${known.Visitas} visita${known.Visitas > 1 ? "s" : ""}` : "registrado"}</b>
              <small>{known.Ultimo_Servicio ? `Último: ${nice(known.Ultimo_Servicio)}${known.Ultima_Fecha ? ` · ${prettyDate(known.Ultima_Fecha, { short: true })}` : ""}` : phonePretty(tel)}</small></div>
            {known.Sellos !== undefined && <span className="tag gold"><Gift size={12} /> {known.Sellos} sellos</span>}
          </div>
        )}
        <Field label="Nombre"><div className="input-ico"><User size={17} /><input value={cli.nombre} onChange={(e) => { autoFilled.current = false; setCli({ ...cli, nombre: e.target.value }); }} placeholder="Nombre del cliente" /></div></Field>
        <Field label="Correo (opcional)"><div className="input-ico"><Mail size={17} /><input type="email" value={cli.email} onChange={(e) => setCli({ ...cli, email: e.target.value })} placeholder="cliente@correo.com" /></div></Field>
      </section>

      <section className="step">
        <h3><span>{++n}</span> Servicio</h3>
        <div className="svc-pick">
          {data.services.map((s) => (
            <button key={s.Id} className={`svc-mini ${svc === s.Id ? "on" : ""}`} onClick={() => setSvc(s.Id)}>
              {s.Destacado && <Crown size={13} className="svc-crown" />}
              <b>{nice(s.Nombre)}</b>
              <small className="num">{durLabel(s.Duracion_Min)} · {money(s.Precio)}</small>
            </button>
          ))}
        </div>
      </section>

      {perms.manage && barbers.length > 1 && pickTime && (
        <section className="step">
          <h3><span>{++n}</span> Barbero</h3>
          <div className="barber-pick scroll">
            {barbers.map((b) => (
              <button key={b.User_Id} className={bid === b.User_Id ? "on" : ""} onClick={() => { setBid(b.User_Id); setSlot((x) => ({ ...x, hora: null })); }}>
                <Avatar user={b} size={30} /><span>{b.User_Id === me?.User_Id ? "Yo" : b.Nombre.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pickTime && (
        <section className="step">
          <h3><span>{++n}</span> Fecha y hora</h3>
          {!service ? <p className="muted">Elige el servicio para ver los huecos libres.</p> : (
            <>
              <label className="check" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={force} onChange={(e) => { setForce(e.target.checked); setSlot((x) => ({ ...x, hora: null })); }} />
                <span><b>Permitir fuera de horario</b><small>Incluye almuerzo y horas extra</small></span>
              </label>
              <SlotPicker barbers={barbers} barberId={bid} dur={service.Duracion_Min} src={{ citas: data.citas, bloqueos: data.bloqueos }} cfg={data.config} force={force}
                value={slot} onChange={(v) => setSlot({ fecha: v.fecha, hora: v.hora })} days={30} showLunch />
            </>
          )}
        </section>
      )}

      <section className="step">
        <h3><span>{++n}</span> Detalles</h3>
        <Field label="Notas (opcional)"><textarea value={cli.notas} onChange={(e) => setCli({ ...cli, notas: e.target.value })} placeholder="Ej: fade bajo, número 1 a los lados" /></Field>
        <label className="check"><input type="checkbox" checked={cli.club} onChange={(e) => setCli({ ...cli, club: e.target.checked })} /><span><b>Agregar al club de fidelización</b><small>Se crea su tarjeta de sellos con el celular</small></span></label>
      </section>

      <div className="sticky-cta">
        <div className="cta-sum">
          {service && slot.hora !== null ? <><b>{h12(toHHMM(slot.hora))} · {prettyDate(slot.fecha, { short: true })}</b><small>{nice(service.Nombre)} · {money(service.Precio)}</small></>
            : <small>{slot.hora !== null ? "Elige el servicio" : "Elige servicio y hora"}</small>}
        </div>
        <button className="btn btn-primary" disabled={!ready} onClick={save}><CalendarPlus size={18} /> Agendar</button>
      </div>
    </div>
  );
}
