/* Selector de fecha + hora disponible (lo usan clientes, barberos y "mover cita") */
import { useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { CalendarX2, Coffee } from "lucide-react";
import { dayName, toHHMM, addDays, todayStr, day3, dayNum, month3, h12, prettyDate } from "../lib/time";
import { busyOf, slotsFor, groupSlots, lunchPlacement } from "../lib/slots";
import { Skeleton } from "./ui";

export function useSlots({ barbers, barberId, dur, src, cfg, excludeId, force, fecha }) {
  return useMemo(() => {
    if (!fecha || !dur) return { times: [], who: {} };
    const list = barberId === "any" ? barbers : barbers.filter((b) => b.User_Id === barberId);
    const who = {};
    list.forEach((b) => {
      const busy = busyOf(b.User_Id, fecha, src, excludeId);
      slotsFor(b, fecha, dur, busy, { cfg, force }).forEach((t) => { (who[t] = who[t] || []).push(b.User_Id); });
    });
    return { times: Object.keys(who).map(Number).sort((a, b) => a - b), who };
  }, [barbers, barberId, dur, src, cfg, excludeId, force, fecha]);
}

export function SlotPicker({ barbers, barberId, dur, src, cfg, excludeId, force = false, value, onChange, loading, days, showLunch = false }) {
  const t = todayStr();
  const n = days || Number(cfg?.Dias_Reserva) || 14;
  const dates = useMemo(() => Array.from({ length: n + 1 }, (_, i) => addDays(t, i)), [t, n]);
  const fecha = value?.fecha || t;
  const stripRef = useRef(null);

  const counts = useMemo(() => {
    const out = {};
    if (!dur) return out;
    const list = barberId === "any" ? barbers : barbers.filter((b) => b.User_Id === barberId);
    dates.forEach((f) => {
      const set = new Set();
      list.forEach((b) => slotsFor(b, f, dur, busyOf(b.User_Id, f, src, excludeId), { cfg, force }).forEach((x) => set.add(x)));
      out[f] = set.size;
    });
    return out;
  }, [dates, barbers, barberId, dur, src, cfg, excludeId, force]);

  const { times, who } = useSlots({ barbers, barberId, dur, src, cfg, excludeId, force, fecha });

  const lunch = useMemo(() => {
    if (barberId === "any") return null;
    const b = barbers.find((x) => x.User_Id === barberId);
    if (!b) return null;
    return lunchPlacement(b.Almuerzo, busyOf(b.User_Id, fecha, src, excludeId));
  }, [barbers, barberId, fecha, src, excludeId]);

  // si el día elegido ya no tiene cupos (ej. de noche), saltamos al primer día con horas libres
  const touched = useRef(false);
  useEffect(() => {
    if (loading || touched.current || value?.hora != null || counts[fecha] !== 0) return;
    const f = dates.find((d) => counts[d] > 0);
    if (f && f !== fecha) { touched.current = true; onChange({ fecha: f, hora: null, barberId: value?.barberId }); }
  }, [loading, counts, fecha, dates]); // eslint-disable-line

  useEffect(() => {
    const el = stripRef.current?.querySelector(".on");
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [fecha]);

  const pick = (m) => {
    let bid = barberId;
    if (barberId === "any") {
      const opts = who[m] || [];
      const load = (id) => (src.citas || []).filter((c) => c.Barbero_Id === id && c.Fecha === fecha && c.Estado !== "cancelada").length +
        (src.busy || []).filter((x) => x.b === id && x.f === fecha).length;
      bid = opts.slice().sort((a, b) => load(a) - load(b))[0];
    }
    onChange({ fecha, hora: m, barberId: bid });
  };

  return (
    <div className="slotpicker">
      <div className="date-strip" ref={stripRef}>
        {dates.map((f) => (
          <button type="button" key={f} className={`date-chip ${f === fecha ? "on" : ""} ${!loading && counts[f] === 0 ? "full" : ""}`}
            onClick={() => { touched.current = true; onChange({ fecha: f, hora: null, barberId: value?.barberId }); }}>
            <small>{f === t ? "Hoy" : day3(f)}</small>
            <b>{dayNum(f)}</b>
            <em>{month3(f)}</em>
            {!loading && <i className="dot" style={{ opacity: counts[f] ? Math.min(1, 0.35 + counts[f] / 20) : 0 }} />}
          </button>
        ))}
      </div>

      <div className="slot-head">
        <b>{prettyDate(fecha)}{fecha <= addDays(t, 1) ? ` · ${dayName(fecha).toLowerCase()} ${dayNum(fecha)}` : ""}</b>
        {!loading && <span>{times.length ? `${times.length} horas libres` : "Sin cupos"}</span>}
      </div>

      {loading ? (
        <div className="slot-grid">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} h={42} r={14} />)}</div>
      ) : times.length === 0 ? (
        <div className="slot-empty"><CalendarX2 size={20} /> No quedan horas este día. Prueba otra fecha ✦</div>
      ) : (
        groupSlots(times).map(([g, list]) => (
          <div key={g} className="slot-group">
            <span className="slot-group-t">{g}</span>
            <div className="slot-grid">
              {list.map((m) => (
                <button type="button" key={m} className={`slot ${value?.hora === m && value?.fecha === fecha ? "on" : ""}`} onClick={() => pick(m)}>
                  {h12(toHHMM(m))}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      {showLunch && lunch && !loading && (
        <p className="lunch-note"><Coffee size={14} /> Almuerzo flexible del barbero: {h12(toHHMM(lunch.s))} aprox.</p>
      )}
    </div>
  );
}
SlotPicker.propTypes = {
  barbers: PropTypes.array.isRequired, barberId: PropTypes.string, dur: PropTypes.number, src: PropTypes.object.isRequired,
  cfg: PropTypes.object, excludeId: PropTypes.string, force: PropTypes.bool, value: PropTypes.object, onChange: PropTypes.func.isRequired,
  loading: PropTypes.bool, days: PropTypes.number, showLunch: PropTypes.bool,
};
