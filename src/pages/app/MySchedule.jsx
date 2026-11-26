import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Save, Coffee, Copy } from "lucide-react";
import { useApp } from "../../lib/store";
import { DAYS, toMin, toHHMM, h12 } from "../../lib/time";
import { DEFAULT_LUNCH } from "../../lib/slots";
import { toast } from "../../components/ui";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TIMES = Array.from({ length: 33 }, (_, i) => toHHMM(5 * 60 + i * 30)); // 5:00 → 21:00

export function MySchedule() {
  const { me, data, mutate } = useApp();
  const nav = useNavigate();
  const shop = data?.config?.Horario_Local || {};
  const [hor, setHor] = useState(() => {
    const h = me?.Horario || shop;
    const o = {};
    ORDER.forEach((d) => { o[d] = { on: !!h[d]?.on, start: h[d]?.start || "09:00", end: h[d]?.end || "20:00" }; });
    return o;
  });
  const [lunch, setLunch] = useState(me?.Almuerzo || DEFAULT_LUNCH);
  const setDay = (d, k, v) => setHor({ ...hor, [d]: { ...hor[d], [k]: v } });

  const save = () => {
    for (const d of ORDER) if (hor[d].on && toMin(hor[d].end) <= toMin(hor[d].start)) return toast(`Revisa el ${DAYS[d]}: la salida debe ser después de la entrada.`, "error");
    if (Number(lunch.min) > 0 && toMin(lunch.hasta) - toMin(lunch.desde) < Number(lunch.min)) return toast("La ventana de almuerzo es más corta que el almuerzo.", "error");
    const profile = { Horario: hor, Almuerzo: { ...lunch, min: Number(lunch.min) } };
    mutate("profile_save", { profile }, {
      apply: (d) => ({ ...d, me: { ...d.me, ...profile }, users: d.users.map((u) => (u.User_Id === d.me.User_Id ? { ...u, ...profile } : u)) }),
      okMsg: "Horario guardado · los cupos ya se actualizaron ✦",
    }).catch(() => {});
    nav("/app/mas");
  };

  const copyMon = () => { const m = hor[1]; const o = { ...hor }; [2, 3, 4, 5, 6].forEach((d) => { o[d] = { ...m }; }); setHor(o); toast("Copiado de lunes a sábado"); };

  return (
    <div className="page form-page">
      <button className="link-back" onClick={() => nav("/app/mas")}><ChevronLeft size={16} /> Más</button>
      <div className="page-head"><div><span className="eyebrow">Tu horario base</span><h1 className="display">Horario y almuerzo</h1></div></div>
      <p className="muted" style={{ marginBottom: 12 }}>Es tu horario de siempre. Si un día tienes un inconveniente, usa <b>Ordenar mi horario</b> para congelar horas.</p>

      <div className="glass card sched">
        <div className="sched-head"><b>Días y horas</b><button className="btn btn-xs btn-soft" onClick={copyMon}><Copy size={13} /> Lunes → Sáb</button></div>
        {ORDER.map((d) => (
          <div key={d} className={`sched-row ${hor[d].on ? "" : "off"}`}>
            <label className="switch"><input type="checkbox" checked={hor[d].on} onChange={(e) => setDay(d, "on", e.target.checked)} /><span /></label>
            <b className="sched-day">{DAYS[d].slice(0, 3)}</b>
            {hor[d].on ? (
              <div className="sched-times">
                <select value={hor[d].start} onChange={(e) => setDay(d, "start", e.target.value)}>{TIMES.map((t) => <option key={t} value={t}>{h12(t)}</option>)}</select>
                <span>–</span>
                <select value={hor[d].end} onChange={(e) => setDay(d, "end", e.target.value)}>{TIMES.map((t) => <option key={t} value={t}>{h12(t)}</option>)}</select>
              </div>
            ) : <span className="muted">Descanso</span>}
          </div>
        ))}
        <p className="muted small-note">Horario del local: L–S {h12(shop?.[1]?.start || "09:00")} – {h12(shop?.[1]?.end || "20:00")} · Dom {h12(shop?.[0]?.start || "10:00")} – {h12(shop?.[0]?.end || "19:00")}</p>
      </div>

      <div className="glass card lunch-card">
        <div className="sched-head"><b><Coffee size={16} /> Almuerzo flexible</b></div>
        <p className="muted" style={{ fontSize: ".84rem", marginBottom: 12 }}>Elige entre qué horas podrías almorzar. Los clientes pueden reservar dentro de esa ventana, pero <b>siempre te dejamos libre el tiempo de tu almuerzo</b>.</p>
        <div className="grid2">
          <label className="field"><span className="field-label">Desde</span><select value={lunch.desde} onChange={(e) => setLunch({ ...lunch, desde: e.target.value })}>{TIMES.map((t) => <option key={t} value={t}>{h12(t)}</option>)}</select></label>
          <label className="field"><span className="field-label">Hasta</span><select value={lunch.hasta} onChange={(e) => setLunch({ ...lunch, hasta: e.target.value })}>{TIMES.map((t) => <option key={t} value={t}>{h12(t)}</option>)}</select></label>
        </div>
        <div className="field"><span className="field-label">Duración del almuerzo</span>
          <div className="chips">{[0, 30, 45, 60, 90].map((m) => <button key={m} type="button" className={`chip ${Number(lunch.min) === m ? "on" : ""}`} onClick={() => setLunch({ ...lunch, min: m })}>{m ? `${m} min` : "Sin almuerzo"}</button>)}</div>
        </div>
        <LunchBar lunch={lunch} />
      </div>

      <div className="sticky-cta"><button className="btn btn-primary block" onClick={save}><Save size={18} /> Guardar horario</button></div>
    </div>
  );
}

function LunchBar({ lunch }) {
  const a = 9 * 60, b = 20 * 60;
  const l = ((toMin(lunch.desde) - a) / (b - a)) * 100, w = ((toMin(lunch.hasta) - toMin(lunch.desde)) / (b - a)) * 100;
  return (
    <div className="lunchbar">
      <div className="lunchbar-track"><i style={{ left: `${l}%`, width: `${w}%` }} /></div>
      <div className="lunchbar-lbl"><span>9 am</span><span>2:30 pm</span><span>8 pm</span></div>
    </div>
  );
}
