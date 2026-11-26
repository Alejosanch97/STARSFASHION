import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Crown, Trophy, Medal, KeyRound, Banknote, TrendingUp, Clock3 } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { useApp } from "../../lib/store";
import { nice, money, kMoney, durLabel, todayStr, weekStart, addDays, dayNum, month3 } from "../../lib/time";
import { range, inRange, summary, perDay, perService, perHour, perBarber } from "../../lib/stats";
import { Segmented, Avatar, Empty } from "../../components/ui";
import { axis, grid, ChartTip, Legend } from "../../components/charts";
import { SERIES } from "../../config";

const PERIODS = [{ value: "hoy", label: "Hoy" }, { value: "semana", label: "Semana" }, { value: "mes", label: "Mes" }, { value: "30", label: "30 días" }];

export function Analytics() {
  const { data, me, perms } = useApp();
  const [q] = useSearchParams();
  const [period, setPeriod] = useState("semana");
  const [scope, setScope] = useState(q.get("vista") === "barberia" || !perms.barber ? "shop" : "me");
  const shop = perms.owner && scope === "shop";

  const base = useMemo(() => (shop || !perms.barber ? data.citas : data.citas.filter((c) => c.Barbero_Id === me.User_Id)), [data, shop, me, perms]);
  const r = range(period);
  const list = inRange(base, r);
  const s = summary(list);
  const daily = period === "hoy" ? perHour(list).map((x) => ({ ...x, label: x.label })) : perDay(list, r.days);
  const services = perService(list).slice(0, 5);
  const hours = perHour(list);
  const peak = hours.reduce((a, b) => (b.citas > a.citas ? b : a), hours[0]);
  const payData = [{ name: "Llave", value: s.llave, color: SERIES[0] }, { name: "Efectivo", value: s.efectivo, color: SERIES[1] }];

  return (
    <div className="page">
      <div className="page-head"><div><span className="eyebrow">Números</span><h1 className="display">{shop ? "La barbería" : "Mi rendimiento"}</h1></div></div>
      {perms.owner && perms.barber && (
        <Segmented value={scope} onChange={setScope} options={[{ value: "me", label: "Yo" }, { value: "shop", label: "Barbería", icon: <Crown size={14} /> }]} />
      )}
      <div style={{ height: 10 }} />
      <Segmented small value={period} onChange={setPeriod} options={PERIODS} />

      <div className="big-kpi glass strong fade-in" key={period + scope}>
        <small>Ingresos · {period === "hoy" ? "hoy" : period === "semana" ? "esta semana" : period === "mes" ? "este mes" : "últimos 30 días"}</small>
        <b className="display num">{money(s.revenue)}</b>
        <div className="big-kpi-row">
          <span><em className="num">{s.done}</em> servicios</span>
          <span><em className="num">{kMoney(s.avg)}</em> ticket</span>
          <span><em className="num">{kMoney(s.tips)}</em> propinas</span>
        </div>
        {s.projected > 0 && <p className="proj"><TrendingUp size={14} /> {money(s.projected)} agendados por cobrar</p>}
      </div>

      {shop && <Podium data={data} />}

      <div className="glass card chart-card">
        <div className="chart-head"><div><small className="muted">{period === "hoy" ? "Citas por hora" : "Ingresos por día"}</small><b className="display">{period === "hoy" ? `${s.total} citas` : money(s.revenue)}</b></div></div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer>
            {period === "hoy" ? (
              <BarChart data={daily} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="label" {...axis} interval={1} /><YAxis {...axis} allowDecimals={false} width={40} />
                <Tooltip content={<ChartTip money={false} />} cursor={{ fill: "rgba(184,133,58,.08)" }} />
                <Bar dataKey="citas" name="Citas" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            ) : period === "semana" ? (
              <BarChart data={daily} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="label" {...axis} interval={0} /><YAxis {...axis} tickFormatter={kMoney} width={48} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(184,133,58,.08)" }} />
                <Bar dataKey="ingresos" name="Ingresos" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            ) : (
              <AreaChart data={daily} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={SERIES[0]} stopOpacity={0.32} /><stop offset="1" stopColor={SERIES[0]} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid {...grid} /><XAxis dataKey="label" {...axis} interval={period === "semana" ? 0 : 4} /><YAxis {...axis} tickFormatter={kMoney} width={48} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: "rgba(92,34,56,.25)", strokeDasharray: "3 3" }} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={SERIES[0]} strokeWidth={2} fill="url(#gArea)" connectNulls={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid2 an-grid">
        <div className="glass card chart-card">
          <small className="muted">Cómo pagan</small>
          {s.revenue ? (
            <>
              <div style={{ height: 130 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={payData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={56} paddingAngle={3} stroke="#fff" strokeWidth={2}>
                      {payData.map((p) => <Cell key={p.name} fill={p.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <Legend items={[{ label: "Llave", color: SERIES[0], value: ` ${pct(s.llave, s.revenue)}` }, { label: "Efectivo", color: SERIES[1], value: ` ${pct(s.efectivo, s.revenue)}` }]} />
            </>
          ) : <p className="muted mini-empty">Sin cobros aún</p>}
        </div>
        <div className="glass card mini-stats">
          <div><KeyRound size={16} /><span>Llave</span><b className="num">{kMoney(s.llave)}</b></div>
          <div><Banknote size={16} /><span>Efectivo</span><b className="num">{kMoney(s.efectivo)}</b></div>
          <div><Clock3 size={16} /><span>En silla</span><b className="num">{durLabel(s.minutes)}</b></div>
          <div><span className="dot-no" /><span>No vinieron</span><b className="num">{s.noShow}</b></div>
        </div>
      </div>

      <div className="glass card chart-card">
        <div className="chart-head"><div><small className="muted">Servicios que más venden</small><b className="display">Top {services.length || ""}</b></div></div>
        {services.length ? (
          <ul className="rank-list">
            {services.map((x, i) => (
              <li key={x.name}>
                <span className="rank-n">{i + 1}</span>
                <div className="grow">
                  <div className="rank-top"><b className="ellipsis">{nice(x.name)}</b><span className="num">{money(x.value)}</span></div>
                  <div className="rank-bar"><i style={{ width: `${(x.value / services[0].value) * 100}%`, background: SERIES[i] }} /></div>
                  <small className="muted">{x.count} servicios</small>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty title="Aún no hay servicios cerrados" text="Cuando finalices citas verás el ranking aquí." />}
      </div>

      {period !== "hoy" && (
        <div className="glass card chart-card">
          <div className="chart-head"><div><small className="muted">Horas pico</small><b className="display">{peak?.citas ? `${peak.label.replace("a", " am").replace("p", " pm")}` : "—"}</b></div></div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer>
              <BarChart data={hours} margin={{ top: 6, right: 0, left: -14, bottom: 0 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="label" {...axis} interval={1} /><YAxis {...axis} allowDecimals={false} width={40} />
                <Tooltip content={<ChartTip money={false} />} cursor={{ fill: "rgba(184,133,58,.08)" }} />
                <Bar dataKey="citas" name="Citas" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {shop && <TeamTable list={list} users={data.users.filter((u) => String(u.Rol).includes("barber"))} />}
    </div>
  );
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "0%");

function Podium({ data }) {
  const ws = weekStart(todayStr());
  const r = { from: ws, to: addDays(ws, 6) };
  const ranking = perBarber(inRange(data.citas, r), data.users.filter((u) => String(u.Rol).includes("barber") && u.Activo !== false)).slice(0, 3);
  if (!ranking.length) return null;
  const order = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  const icons = { 0: <Trophy size={16} />, 1: <Medal size={16} />, 2: <Medal size={16} /> };
  return (
    <div className="glass strong card podium-card fade-in">
      <div className="chart-head"><div><small className="muted">Top 3 de la semana · {dayNum(ws)} {month3(ws)} – {dayNum(r.to)} {month3(r.to)}</small><b className="display">Los que más atienden</b></div><span className="tag gold"><Crown size={12} /> premio</span></div>
      <div className="podium">
        {order.map((b) => {
          const place = ranking.indexOf(b);
          return (
            <div key={b.id} className={`pod p${place + 1}`}>
              <Avatar user={b.user} size={place === 0 ? 62 : 50} ring={place === 0} />
              <b>{b.name}</b>
              <small className="num">{b.done} servicios</small>
              <div className="pod-step"><span>{icons[place]}{place + 1}</span><em className="num">{kMoney(b.revenue)}</em></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamTable({ list, users }) {
  const rows = perBarber(list, users);
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <div className="glass card chart-card">
      <div className="chart-head"><div><small className="muted">Ventas por barbero</small><b className="display">Equipo</b></div></div>
      <div style={{ height: 40 + rows.length * 38 }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, max]} />
            <YAxis type="category" dataKey="name" {...axis} width={72} />
            <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(184,133,58,.08)" }} />
            <Bar dataKey="revenue" name="Ventas" radius={[0, 4, 4, 0]} barSize={18}>
              {rows.map((r) => <Cell key={r.id} fill={r.user.Color || SERIES[0]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="team-table">
        <thead><tr><th>Barbero</th><th>Serv.</th><th>Ticket</th><th>Ventas</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td><span className="row"><Avatar user={r.user} size={24} />{r.name}</span></td><td className="num">{r.done}</td><td className="num">{kMoney(r.avg)}</td><td className="num"><b>{money(r.revenue)}</b></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
