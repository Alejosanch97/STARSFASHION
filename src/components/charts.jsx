/* Piezas comunes de recharts con el estilo de la casa */
import PropTypes from "prop-types";
import { money } from "../lib/time";

export const axis = { tickLine: false, axisLine: false, tick: { fill: "#84737a", fontSize: 11, fontWeight: 600 } };
export const grid = { stroke: "rgba(60,30,42,.08)", vertical: false };

export function ChartTip({ active, payload, label, money: isMoney = true, suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label !== undefined && <b>{label}</b>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name}>
          <i style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}</span>
          <strong className="num">{isMoney && p.dataKey !== "cortes" && p.dataKey !== "citas" && p.dataKey !== "count" ? money(p.value) : p.value}{suffix}</strong>
        </div>
      ))}
    </div>
  );
}
ChartTip.propTypes = { active: PropTypes.bool, payload: PropTypes.array, label: PropTypes.any, money: PropTypes.bool, suffix: PropTypes.string };

export function Legend({ items }) {
  return (
    <div className="chart-legend">
      {items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}{i.value !== undefined && <b className="num">{i.value}</b>}</span>)}
    </div>
  );
}
Legend.propTypes = { items: PropTypes.array.isRequired };
