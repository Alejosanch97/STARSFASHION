import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Armchair, Coffee } from "lucide-react";
import { useApp } from "../../lib/store";
import { todayStr, toMin, toHHMM, h12, money, nowMin } from "../../lib/time";
import { dayHours, busyOf, lunchPlacement } from "../../lib/slots";
import { summary, byTime } from "../../lib/stats";
import { Avatar, Stars } from "../../components/ui";
import { ROLE } from "./More";

export function Team() {
  const { data } = useApp();
  const nav = useNavigate();
  const t = todayStr(), n = nowMin();
  const barbers = data.users.filter((u) => String(u.Rol).includes("barber"));

  return (
    <div className="page">
      <button className="link-back" onClick={() => nav("/app/mas")}><ChevronLeft size={16} /> Más</button>
      <div className="page-head"><div><span className="eyebrow">Hoy en la barbería</span><h1 className="display">Equipo y turnos</h1></div></div>
      <div className="stagger" style={{ display: "grid", gap: 12 }}>
        {barbers.map((b) => {
          const list = data.citas.filter((c) => c.Barbero_Id === b.User_Id && c.Fecha === t).sort(byTime);
          const s = summary(list);
          const h = dayHours(b, t);
          const live = list.find((c) => c.Estado === "en_curso");
          const next = list.find((c) => c.Estado === "reservada" && toMin(c.Hora_Inicio) >= n - 10);
          const booked = list.filter((c) => c.Estado !== "cancelada").reduce((a, c) => a + Number(c.Duracion_Min), 0);
          const occ = h ? Math.min(100, Math.round((booked / (h.end - h.start)) * 100)) : 0;
          const lunch = lunchPlacement(b.Almuerzo, busyOf(b.User_Id, t, data));
          return (
            <button key={b.User_Id} className="glass team-card" onClick={() => nav(`/app/agenda?barbero=${b.User_Id}`)}>
              <div className="row">
                <Avatar user={b} size={50} ring={!!live} />
                <div className="grow">
                  <b>{b.Nombre}</b>
                  <div className="row" style={{ gap: 6 }}><Stars value={Number(b.Estrellas) || 5} size={12} /><small className="muted">{String(b.Rol).split(",").map((r) => ROLE[r.trim()]).join(" · ")}</small></div>
                </div>
                <ChevronRight size={18} className="muted" />
              </div>
              <div className="team-now">
                {live ? <span className="tag gold"><Armchair size={12} /> {live.Cliente_Nombre} · hasta {h12(live.Hora_Fin)}</span>
                  : next ? <span className="tag">Próximo: {next.Cliente_Nombre} · {h12(next.Hora_Inicio)}</span>
                  : <span className="tag">{h ? "Sin más citas hoy" : "Descansa hoy"}</span>}
                {lunch && h && <span className="tag"><Coffee size={12} /> {h12(toHHMM(lunch.s))}</span>}
              </div>
              <div className="occ"><div className="occ-bar"><i style={{ width: `${occ}%`, background: b.Color }} /></div><span className="num">{occ}% ocupado</span></div>
              <div className="team-nums">
                <span><b className="num">{s.done}/{s.total}</b> servicios</span>
                <span><b className="num">{money(s.revenue)}</b> hoy</span>
                <span>{h ? `${h12(toHHMM(h.start))}–${h12(toHHMM(h.end))}` : "Libre"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
