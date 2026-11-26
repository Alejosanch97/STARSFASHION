import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Snowflake, Sunrise, Sunset, CalendarOff, Trash2, AlertTriangle, Lock } from "lucide-react";
import { useApp, tmpId } from "../../lib/store";
import { todayStr, addDays, day3, dayNum, month3, toMin, toHHMM, h12, prettyDate, nowMin } from "../../lib/time";
import { dayHours } from "../../lib/slots";
import { Avatar, Empty, Field, toast } from "../../components/ui";

const MODES = [
  { v: "tarde", icon: <Sunrise size={18} />, t: "Llego más tarde", s: "Congelo desde que abro hasta…" },
  { v: "temprano", icon: <Sunset size={18} />, t: "Salgo temprano", s: "Congelo desde… hasta el cierre" },
  { v: "rango", icon: <Snowflake size={18} />, t: "Congelar un rango", s: "Una cita médica, una vuelta…" },
  { v: "dia", icon: <CalendarOff size={18} />, t: "Todo el día", s: "No atiendo este día" },
];

export function Blocks() {
  const { data, me, perms, mutate } = useApp();
  const nav = useNavigate();
  const t = todayStr();
  const barbers = useMemo(() => data.users.filter((u) => String(u.Rol).includes("barber") && u.Activo !== false && (perms.manage || u.User_Id === me.User_Id)), [data, perms, me]);
  const [bid, setBid] = useState(perms.barber ? me.User_Id : barbers[0]?.User_Id);
  const barber = barbers.find((b) => b.User_Id === bid) || me;
  const [fecha, setFecha] = useState(t);
  const [mode, setMode] = useState("tarde");
  const hours = dayHours(barber, fecha) || { start: 9 * 60, end: 20 * 60 };
  const [a, setA] = useState("12:00");
  const [b, setB] = useState("14:00");
  const [motivo, setMotivo] = useState("");

  const opts = useMemo(() => { const o = []; for (let m = hours.start; m <= hours.end; m += 15) o.push(toHHMM(m)); return o; }, [hours.start, hours.end]);
  const range = mode === "tarde" ? [toHHMM(hours.start), a] : mode === "temprano" ? [a, toHHMM(hours.end)] : mode === "dia" ? [toHHMM(hours.start), toHHMM(hours.end)] : [a, b];
  const valid = toMin(range[1]) > toMin(range[0]);
  const conflicts = data.citas.filter((c) => c.Barbero_Id === bid && c.Fecha === fecha && c.Estado === "reservada" && toMin(c.Hora_Inicio) < toMin(range[1]) && toMin(c.Hora_Fin) > toMin(range[0]));
  const upcoming = data.bloqueos.filter((x) => x.Fecha >= t && (perms.manage ? x.Barbero_Id === bid : x.Barbero_Id === me.User_Id)).sort((x, y) => (x.Fecha + x.Hora_Inicio).localeCompare(y.Fecha + y.Hora_Inicio));

  const save = () => {
    if (!valid) return toast("Revisa las horas.", "error");
    if (fecha === t && toMin(range[1]) <= nowMin()) return toast("Esas horas ya pasaron.", "error");
    const block = { Id: tmpId("tmpB"), Barbero_Id: bid, Fecha: fecha, Hora_Inicio: range[0], Hora_Fin: range[1], Motivo: motivo || MODES.find((m) => m.v === mode).t };
    mutate("block_save", { block }, {
      apply: (d) => ({ ...d, bloqueos: [...d.bloqueos, block] }),
      done: (res, d) => ({ ...d, bloqueos: d.bloqueos.map((x) => (x.Id === block.Id ? res.block : x)) }),
      okMsg: `Congelado ${h12(range[0])} – ${h12(range[1])} · cupos actualizados ✦`,
    }).catch(() => {});
    setMotivo("");
  };
  const del = (x) => mutate("block_delete", { id: x.Id }, { apply: (d) => ({ ...d, bloqueos: d.bloqueos.filter((y) => y.Id !== x.Id) }), okMsg: "Horas liberadas ✦" }).catch(() => {});

  return (
    <div className="page form-page">
      <button className="link-back" onClick={() => nav("/app/mas")}><ChevronLeft size={16} /> Más</button>
      <div className="page-head"><div><span className="eyebrow">Ordenar mi horario</span><h1 className="display">Congelar horas</h1></div></div>
      <p className="muted" style={{ marginBottom: 12 }}>¿Un inconveniente? Congela las horas y los cupos se abren desde donde tú digas.</p>

      {perms.manage && barbers.length > 1 && (
        <div className="barber-pick scroll">{barbers.map((x) => <button key={x.User_Id} className={bid === x.User_Id ? "on" : ""} onClick={() => setBid(x.User_Id)}><Avatar user={x} size={30} /><span>{x.User_Id === me.User_Id ? "Yo" : x.Nombre.split(" ")[0]}</span></button>)}</div>
      )}

      <div className="date-strip">
        {Array.from({ length: 21 }, (_, i) => addDays(t, i)).map((f) => (
          <button key={f} className={`date-chip ${f === fecha ? "on" : ""}`} onClick={() => setFecha(f)}><small>{f === t ? "Hoy" : day3(f)}</small><b>{dayNum(f)}</b><em>{month3(f)}</em></button>
        ))}
      </div>

      <div className="mode-grid">
        {MODES.map((m) => (
          <button key={m.v} className={`mode ${mode === m.v ? "on" : ""}`} onClick={() => setMode(m.v)}>{m.icon}<b>{m.t}</b><small>{m.s}</small></button>
        ))}
      </div>

      <div className="glass card">
        {mode !== "dia" && (
          <div className={mode === "rango" ? "grid2" : ""}>
            <label className="field">
              <span className="field-label">{mode === "tarde" ? "Atiendo desde" : mode === "temprano" ? "Atiendo hasta" : "Desde"}</span>
              <select value={a} onChange={(e) => setA(e.target.value)}>{opts.map((o) => <option key={o} value={o}>{h12(o)}</option>)}</select>
            </label>
            {mode === "rango" && (
              <label className="field"><span className="field-label">Hasta</span><select value={b} onChange={(e) => setB(e.target.value)}>{opts.map((o) => <option key={o} value={o}>{h12(o)}</option>)}</select></label>
            )}
          </div>
        )}
        <Field label="Motivo (solo lo ves tú)"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: diligencia personal" maxLength={80} /></Field>
        <div className={`block-preview ${valid ? "" : "bad"}`}>
          <Lock size={16} /><span>{prettyDate(fecha)} · <b>{h12(range[0])} – {h12(range[1])}</b> congelado</span>
        </div>
        {conflicts.length > 0 && (
          <div className="conflict">
            <AlertTriangle size={16} />
            <div><b>{conflicts.length} cita(s) en ese rango</b><small>{conflicts.map((c) => `${h12(c.Hora_Inicio)} ${c.Cliente_Nombre}`).join(" · ")}. Muévelas desde la agenda.</small></div>
          </div>
        )}
        <button className="btn btn-primary block" style={{ marginTop: 12 }} disabled={!valid} onClick={save}><Snowflake size={18} /> Congelar horas</button>
      </div>

      <div className="title-row"><h2>Próximos bloqueos</h2></div>
      <div className="glass">
        {upcoming.length === 0 ? <Empty title="Nada congelado" text="Tu horario está igual que siempre." /> : (
          <ul className="list">
            {upcoming.map((x) => (
              <li key={x.Id}>
                <span className="list-ico"><Snowflake size={16} /></span>
                <div className="grow"><b>{prettyDate(x.Fecha)} · {h12(x.Hora_Inicio)} – {h12(x.Hora_Fin)}</b><small>{x.Motivo}</small></div>
                <button className="icon-btn" onClick={() => del(x)} disabled={String(x.Id).startsWith("tmp")} aria-label="Quitar"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
