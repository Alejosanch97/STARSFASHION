import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Coffee, Ban, CalendarDays, Rows3 } from "lucide-react";
import { useApp } from "../../lib/store";
import { durLabel, nice, todayStr, addDays, toMin, toHHMM, h12, prettyDate, nowMin, dayNum, day3, month3, dow, monthName, money } from "../../lib/time";
import { busyOf, dayHours, lunchPlacement } from "../../lib/slots";
import { summary } from "../../lib/stats";
import { Avatar, Segmented, StatusPill } from "../../components/ui";
import { ApptSheet } from "../../components/ApptSheet";

const PX = 1.55; // px por minuto

export function Agenda() {
  const { data, me, perms } = useApp();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const t = todayStr();
  const barbers = useMemo(() => (data?.users || []).filter((u) => String(u.Rol).includes("barber") && u.Activo !== false), [data]);
  const [who, setWho] = useState(() => q.get("barbero") || (perms.barber ? me?.User_Id : barbers[0]?.User_Id));
  const [fecha, setFecha] = useState(q.get("fecha") || t);
  const [view, setView] = useState("dia");
  const [sel, setSel] = useState(null);
  const barber = barbers.find((b) => b.User_Id === who) || barbers[0];

  return (
    <div className="page">
      <div className="page-head">
        <div><span className="eyebrow">Agenda</span><h1 className="display">{view === "dia" ? prettyDate(fecha) : `${monthName(fecha)[0].toUpperCase()}${monthName(fecha).slice(1)}`}</h1></div>
        <Segmented small value={view} onChange={setView} options={[{ value: "dia", label: "Día", icon: <Rows3 size={14} /> }, { value: "mes", label: "Mes", icon: <CalendarDays size={14} /> }]} />
      </div>

      {perms.manage && barbers.length > 1 && (
        <div className="barber-pick scroll">
          {barbers.map((b) => (
            <button key={b.User_Id} className={who === b.User_Id ? "on" : ""} onClick={() => setWho(b.User_Id)}>
              <Avatar user={b} size={30} /><span>{b.User_Id === me?.User_Id ? "Yo" : b.Nombre.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      )}

      {barber && (view === "mes"
        ? <MonthView data={data} barber={barber} fecha={fecha} onPick={(f) => { setFecha(f); setView("dia"); }} setFecha={setFecha} />
        : <DayView data={data} barber={barber} fecha={fecha} setFecha={setFecha} onOpen={setSel}
            onEmpty={(m) => nav(`/app/nueva?fecha=${fecha}&hora=${toHHMM(m)}&barbero=${barber.User_Id}`)} />)}

      {sel && <ApptSheet key={sel.Id} cita={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function Strip({ fecha, setFecha, data, barber }) {
  const t = todayStr();
  const ref = useRef(null);
  const dates = useMemo(() => Array.from({ length: 36 }, (_, i) => addDays(t, i - 7)), [t]);
  useEffect(() => { ref.current?.querySelector(".on")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [fecha]);
  const count = (f) => data.citas.filter((c) => c.Fecha === f && c.Barbero_Id === barber.User_Id && c.Estado !== "cancelada").length;
  return (
    <div className="date-strip agenda-strip" ref={ref}>
      {dates.map((f) => {
        const n = count(f);
        return (
          <button key={f} className={`date-chip ${f === fecha ? "on" : ""} ${f < t ? "past" : ""}`} onClick={() => setFecha(f)}>
            <small>{f === t ? "Hoy" : day3(f)}</small><b>{dayNum(f)}</b><em>{n ? `${n} citas` : month3(f)}</em>
          </button>
        );
      })}
    </div>
  );
}

function DayView({ data, barber, fecha, setFecha, onOpen, onEmpty }) {
  const t = todayStr();
  const hours = dayHours(barber, fecha);
  const citas = data.citas.filter((c) => c.Barbero_Id === barber.User_Id && c.Fecha === fecha && c.Estado !== "cancelada").sort((a, b) => a.Hora_Inicio.localeCompare(b.Hora_Inicio));
  const canceled = data.citas.filter((c) => c.Barbero_Id === barber.User_Id && c.Fecha === fecha && c.Estado === "cancelada");
  const blocks = data.bloqueos.filter((b) => b.Barbero_Id === barber.User_Id && b.Fecha === fecha);
  const lunch = lunchPlacement(barber.Almuerzo, busyOf(barber.User_Id, fecha, data));
  const s = summary(citas);

  const minStart = Math.min(hours ? hours.start : 9 * 60, ...citas.map((c) => toMin(c.Hora_Inicio)));
  const maxEnd = Math.max(hours ? hours.end : 20 * 60, ...citas.map((c) => toMin(c.Hora_Fin)));
  const start = Math.floor(minStart / 60) * 60, end = Math.ceil(maxEnd / 60) * 60;
  const H = (end - start) * PX;
  const y = (m) => (m - start) * PX;
  const now = nowMin();

  const tapEmpty = (e) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = start + Math.floor((e.clientY - r.top) / PX / 15) * 15;
    onEmpty(m);
  };

  return (
    <>
      <div className="day-nav">
        <button className="icon-btn" onClick={() => setFecha(addDays(fecha, -1))} aria-label="Día anterior"><ChevronLeft size={18} /></button>
        <Strip fecha={fecha} setFecha={setFecha} data={data} barber={barber} />
        <button className="icon-btn" onClick={() => setFecha(addDays(fecha, 1))} aria-label="Día siguiente"><ChevronRight size={18} /></button>
      </div>

      <div className="day-sum">
        <span className="tag">{citas.length} citas</span>
        <span className="tag gold num">{money(s.revenue + s.projected)}</span>
        {hours ? <span className="tag">{h12(toHHMM(hours.start))} – {h12(toHHMM(hours.end))}</span> : <span className="tag bord">Día libre</span>}
        {canceled.length > 0 && <span className="tag">{canceled.length} canceladas</span>}
      </div>

      <div className="glass timeline-wrap">
        <div className="timeline" style={{ height: H }} onClick={tapEmpty}>
          {Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60).map((m) => (
            <div key={m} className="tl-hour" style={{ top: y(m) }}><span>{h12(toHHMM(m)).replace(":00", "")}</span></div>
          ))}
          {hours && <div className="tl-off" style={{ top: 0, height: Math.max(0, y(hours.start)) }} />}
          {hours && <div className="tl-off" style={{ top: y(hours.end), height: Math.max(0, H - y(hours.end)) }} />}
          {!hours && <div className="tl-off" style={{ top: 0, height: H }} />}
          {lunch && hours && (
            <div className="tl-ev lunch" style={{ top: y(lunch.s), height: (lunch.e - lunch.s) * PX }}>
              <b><Coffee size={13} /> Almuerzo</b><small>flexible · {h12(toHHMM(lunch.s))}</small>
            </div>
          )}
          {blocks.map((b) => (
            <div key={b.Id} className="tl-ev block" style={{ top: y(toMin(b.Hora_Inicio)), height: (toMin(b.Hora_Fin) - toMin(b.Hora_Inicio)) * PX }}>
              <b><Ban size={13} /> {b.Motivo || "Bloqueado"}</b><small>{h12(b.Hora_Inicio)} – {h12(b.Hora_Fin)}</small>
            </div>
          ))}
          {citas.map((c) => {
            const h = (toMin(c.Hora_Fin) - toMin(c.Hora_Inicio)) * PX;
            return (
              <button key={c.Id} className={`tl-ev appt ${c.Estado} ${h < 56 ? "tight" : ""}`} style={{ top: y(toMin(c.Hora_Inicio)), height: h - 3 }} onClick={() => onOpen(c)}>
                <div className="tl-ev-top"><b className="ellipsis">{c.Cliente_Nombre}</b><span className="num">{h12(c.Hora_Inicio)}</span></div>
                <small className="ellipsis">{nice(c.Servicio_Nombre)}{h < 56 ? ` · ${durLabel(c.Duracion_Min)}` : ""}</small>
                {h >= 84 && <StatusPill estado={c.Estado} />}
                {String(c.Id).startsWith("tmp") && <i className="tl-sync" />}
              </button>
            );
          })}
          {fecha === t && now >= start && now <= end && <div className="tl-now" style={{ top: y(now) }}><i /></div>}
        </div>
      </div>
      <p className="muted tl-help">Toca un espacio vacío para agendar ahí ✦</p>
    </>
  );
}

function MonthView({ data, barber, fecha, onPick, setFecha }) {
  const t = todayStr();
  const first = fecha.slice(0, 8) + "01";
  const lead = (dow(first) + 6) % 7;
  const days = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) days.push(d);
  const max = Math.max(1, ...days.map((d) => data.citas.filter((c) => c.Fecha === d && c.Barbero_Id === barber.User_Id && c.Estado !== "cancelada").length));
  return (
    <div className="glass card month fade-in">
      <div className="month-nav">
        <button className="icon-btn" onClick={() => setFecha(addDays(first, -1).slice(0, 8) + "01")}><ChevronLeft size={18} /></button>
        <b className="display">{monthName(first)} {first.slice(0, 4)}</b>
        <button className="icon-btn" onClick={() => setFecha(addDays(days[days.length - 1], 1))}><ChevronRight size={18} /></button>
      </div>
      <div className="month-grid">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} className="month-dow">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={"x" + i} />)}
        {days.map((d) => {
          const n = data.citas.filter((c) => c.Fecha === d && c.Barbero_Id === barber.User_Id && c.Estado !== "cancelada").length;
          return (
            <button key={d} className={`month-day ${d === t ? "today" : ""} ${d === fecha ? "on" : ""}`} onClick={() => onPick(d)}
              style={{ "--heat": n / max }}>
              <b>{dayNum(d)}</b>{n > 0 && <small>{n}</small>}
            </button>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: ".78rem", marginTop: 10 }}>Más intenso = más citas ese día.</p>
    </div>
  );
}
