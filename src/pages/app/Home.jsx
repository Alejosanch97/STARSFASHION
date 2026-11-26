import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play, CheckCircle2, ChevronRight, CalendarPlus, Coffee, Ban, Crown, Sparkles, BellRing, Scissors } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid } from "recharts";
import { useApp, replaceCita } from "../../lib/store";
import { nice, todayStr, nowMin, toMin, toHHMM, h12, money, kMoney, prettyDate, durLabel } from "../../lib/time";
import { nextUp, summary, range, inRange, perDay, perBarber, byTime } from "../../lib/stats";
import { busyOf, lunchPlacement } from "../../lib/slots";
import { StatusPill, Avatar, Empty } from "../../components/ui";
import { ApptSheet } from "../../components/ApptSheet";
import { axis, grid, ChartTip } from "../../components/charts";
import { permission, enableNotifications } from "../../lib/push";
import { SERIES } from "../../config";

const hello = () => { const h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"; };

export function Home() {
  const { data, me, perms, mutate } = useApp();
  const nav = useNavigate();
  const [sel, setSel] = useState(null);
  const [, tick] = useState(0);
  const [perm, setPerm] = useState(permission());
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(id); }, []);

  const t = todayStr();
  const isBarber = perms.barber;
  const mine = useMemo(() => (data?.citas || []).filter((c) => !isBarber || c.Barbero_Id === me?.User_Id), [data, me, isBarber]);
  const { next } = nextUp(mine, t);
  const lives = mine.filter((c) => c.Estado === "en_curso").sort(byTime);   // en silla, de cualquier día
  const open = (c, mode = "main") => setSel({ c, mode });
  const today = mine.filter((c) => c.Fecha === t).sort(byTime);
  const sToday = summary(today);
  const week = range("semana");
  const sWeek = summary(inRange(mine, week));
  const weekData = perDay(inRange(mine, week), week.days);
  const lunch = isBarber && me ? lunchPlacement(me.Almuerzo, busyOf(me.User_Id, t, data)) : null;
  const blocksToday = (data?.bloqueos || []).filter((b) => b.Fecha === t && b.Barbero_Id === me?.User_Id);

  const shopToday = perms.owner ? summary((data?.citas || []).filter((c) => c.Fecha === t)) : null;
  const top = perms.owner ? perBarber(inRange(data.citas, week), data.users.filter((u) => String(u.Rol).includes("barber")))[0] : null;

  const n = nowMin();
  const startNow = (c) => mutate("appt_update", { id: c.Id, changes: { Estado: "en_curso" } }, {
    apply: (d) => replaceCita(d, c.Id, { Estado: "en_curso" }), done: (r, d) => replaceCita(d, c.Id, r.cita), okMsg: "Servicio iniciado ✦",
  });

  return (
    <div className="page stagger">
      <section className="greet">
        <span className="eyebrow">{prettyDate(t)} · {h12(toHHMM(n))}</span>
        <h1 className="display">{hello()}, <em>{me?.Nombre?.split(" ")[0]}</em></h1>
      </section>

      {perm !== "granted" && perm !== "unsupported" && isBarber && (
        <button className="notif-banner" onClick={async () => { await enableNotifications(); setPerm(permission()); }}>
          <BellRing size={18} /><span><b>Activa los avisos</b><small>Te avisamos de cada nueva cita y del próximo cliente</small></span><ChevronRight size={18} />
        </button>
      )}

      {/* ---------- en silla (puede haber varios) + próximo cliente ---------- */}
      {lives.map((lv) => (
        <article key={lv.Id} className="hero-card live" onClick={() => open(lv, "pay")}>
          <div className="hero-top"><span className="hero-chip"><i className="live-dot" /> En silla ahora</span><span className="num">{lv.Fecha === t ? `hasta ${h12(lv.Hora_Fin)}` : prettyDate(lv.Fecha, { short: true })}</span></div>
          <h2 className="display">{lv.Cliente_Nombre}</h2>
          <p>{nice(lv.Servicio_Nombre)} · {money(lv.Precio)}</p>
          {lv.Fecha === t && <Progress c={lv} />}
          <button className="btn btn-gold block" onClick={(e) => { e.stopPropagation(); open(lv, "pay"); }}><CheckCircle2 size={18} /> Terminar servicio y cobrar</button>
        </article>
      ))}

      {next && (
        <article className={`hero-card ${lives.length ? "compact" : ""}`} onClick={() => open(next)}>
          <div className="hero-top"><span className="hero-chip"><Sparkles size={13} /> Próximo cliente</span><Countdown c={next} /></div>
          <h2 className="display">{next.Cliente_Nombre}</h2>
          <p>{nice(next.Servicio_Nombre)} · {durLabel(next.Duracion_Min)}</p>
          <div className="hero-meta">
            <span><b className="num">{h12(next.Hora_Inicio)}</b>{next.Fecha !== t ? ` · ${prettyDate(next.Fecha)}` : ""}</span>
            <span className="num">{money(next.Precio)}</span>
          </div>
          <div className="hero-actions">
            <button className="btn btn-gold" onClick={(e) => { e.stopPropagation(); startNow(next); }}><Play size={18} /> Llegó · iniciar</button>
            <button className="btn btn-glass" onClick={(e) => { e.stopPropagation(); open(next); }}>Ver cita</button>
          </div>
        </article>
      )}

      {!next && !lives.length && (
        <article className="hero-card empty-hero">
          <Scissors size={26} />
          <h2 className="display">Agenda libre</h2>
          <p>No tienes clientes pendientes. ¿Alguien te escribió por WhatsApp?</p>
          <button className="btn btn-gold block" onClick={() => nav("/app/nueva")}><CalendarPlus size={18} /> Agendar cliente</button>
        </article>
      )}

      {/* ---------- KPIs ---------- */}
      <div className="kpis">
        <div className="kpi glass"><small>Hoy</small><b className="display num">{sToday.done}<em>/{sToday.total}</em></b><span>servicios</span></div>
        <div className="kpi glass"><small>Ganado hoy</small><b className="display num">{kMoney(sToday.revenue)}</b><span>+{kMoney(sToday.projected)} por venir</span></div>
        <div className="kpi glass"><small>Semana</small><b className="display num">{sWeek.done}</b><span>{kMoney(sWeek.revenue)}</span></div>
      </div>

      {/* ---------- dueño ---------- */}
      {perms.owner && shopToday && (
        <Link to="/app/analisis?vista=barberia" className="owner-strip glass">
          <Crown size={20} />
          <div className="grow"><b>Barbería hoy · {money(shopToday.revenue)}</b><small>{shopToday.done} servicios · líder de la semana: {top?.name || "—"}</small></div>
          <ChevronRight size={18} />
        </Link>
      )}

      {/* ---------- día ---------- */}
      <div className="title-row"><h2>Tu día</h2><Link to="/app/agenda">Ver agenda</Link></div>
      <div className="glass day-list">
        {today.length === 0 && !lunch && !blocksToday.length ? <Empty title="Sin citas hoy" text="Comparte tu link de reservas: /clientes" /> : (
          <ul>
            {[...today.map((c) => ({ k: "c", s: toMin(c.Hora_Inicio), c })),
              ...(lunch ? [{ k: "l", s: lunch.s, e: lunch.e }] : []),
              ...blocksToday.map((b) => ({ k: "b", s: toMin(b.Hora_Inicio), e: toMin(b.Hora_Fin), b }))]
              .sort((a, b) => a.s - b.s).map((x) => x.k === "c" ? (
                <li key={x.c.Id} className={`day-item ${x.c.Estado}`} onClick={() => open(x.c, x.c.Estado === "en_curso" ? "pay" : "main")}>
                  <span className="day-time num">{h12(x.c.Hora_Inicio)}</span>
                  <span className="day-bar" />
                  <div className="grow"><b className="ellipsis">{x.c.Cliente_Nombre}</b><small className="ellipsis">{nice(x.c.Servicio_Nombre)}</small></div>
                  <StatusPill estado={x.c.Estado} />
                </li>
              ) : x.k === "l" ? (
                <li key="lunch" className="day-item lunch"><span className="day-time num">{h12(toHHMM(x.s))}</span><span className="day-bar" /><div className="grow"><b><Coffee size={14} /> Almuerzo</b><small>Flexible · se acomoda a tus citas</small></div></li>
              ) : (
                <li key={x.b.Id} className="day-item block"><span className="day-time num">{h12(x.b.Hora_Inicio)}</span><span className="day-bar" /><div className="grow"><b><Ban size={14} /> Bloqueado</b><small>{x.b.Motivo || "Hora congelada"} · hasta {h12(x.b.Hora_Fin)}</small></div></li>
              ))}
          </ul>
        )}
      </div>

      {/* ---------- semana ---------- */}
      <div className="title-row"><h2>Tu semana</h2><Link to="/app/analisis">Ver números</Link></div>
      <div className="glass card chart-card">
        <div className="chart-head"><div><small className="muted">Ingresos lun–dom</small><b className="display num">{money(sWeek.revenue)}</b></div><span className="tag gold">{sWeek.done} servicios</span></div>
        <div style={{ height: 150 }}>
          <ResponsiveContainer>
            <BarChart data={weekData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="label" {...axis} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(184,133,58,.08)", radius: 8 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {sel && <ApptSheet key={sel.c.Id + sel.mode} cita={sel.c} initialMode={sel.mode} onClose={() => setSel(null)} />}
    </div>
  );
}

function Countdown({ c }) {
  const t = todayStr();
  if (c.Fecha !== t) return <span className="num">{prettyDate(c.Fecha, { short: true })}</span>;
  const d = toMin(c.Hora_Inicio) - nowMin();
  return <span className="num countdown">{d <= 0 ? "ya es la hora" : d < 60 ? `en ${d} min` : `en ${Math.floor(d / 60)} h ${d % 60} min`}</span>;
}

function Progress({ c }) {
  const s = toMin(c.Hora_Inicio), e = toMin(c.Hora_Fin), n = nowMin();
  const p = Math.max(0, Math.min(100, ((n - s) / Math.max(1, e - s)) * 100));
  return <div className="hero-progress"><i style={{ width: `${p}%` }} /><span className="num">{Math.max(0, e - n)} min restantes</span></div>;
}
