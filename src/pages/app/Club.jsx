import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Search, Gift, Plus, Minus, MessageCircle } from "lucide-react";
import { apiGet } from "../../lib/api";
import { track } from "../../lib/sync";
import { useApp } from "../../lib/store";
import { phonePretty, waLink } from "../../lib/time";
import { Skeleton, Empty, toast } from "../../components/ui";

export function Club() {
  const { mutate } = useApp();
  const nav = useNavigate();
  const [cards, setCards] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { track(apiGet("loyalty")).then((r) => setCards(r.cards || [])).catch((e) => { toast(e.message, "error"); setCards([]); }); }, []);

  const list = useMemo(() => (cards || []).filter((c) => !q || `${c.Nombre} ${c.Telefono}`.toLowerCase().includes(q.toLowerCase().replace(/\s/g, ""))), [cards, q]);
  const pend = (cards || []).filter((c) => c.Premio_Pendiente).length;

  const act = (c, action, extra, apply) => {
    setCards((cs) => cs.map((x) => (x.Telefono === c.Telefono ? apply(x) : x)));
    mutate(action, { telefono: c.Telefono, ...extra }, { done: (res, d) => { setCards((cs) => cs.map((x) => (x.Telefono === c.Telefono ? res.card : x))); return d; } }).catch(() => {});
  };
  const plus = (c, n) => act(c, "stamp_add", { delta: n }, (x) => {
    let s = x.Sellos + n, done = x.Tarjetas_Completas, prize = x.Premio_Pendiente;
    if (n > 0 && s >= x.Premio_En && x.Sellos < x.Premio_En) prize = true;
    if (s >= x.Max) { s = 0; done++; }
    return { ...x, Sellos: Math.max(0, s), Tarjetas_Completas: done, Premio_Pendiente: prize };
  });
  const redeem = (c) => act(c, "loyalty_redeem", {}, (x) => ({ ...x, Premio_Pendiente: false, Premios_Canjeados: x.Premios_Canjeados + 1 }));

  return (
    <div className="page">
      <button className="link-back" onClick={() => nav("/app/mas")}><ChevronLeft size={16} /> Más</button>
      <div className="page-head"><div><span className="eyebrow">Club Stars</span><h1 className="display">Fidelización</h1></div></div>
      <div className="kpis two">
        <div className="kpi glass"><small>Miembros</small><b className="display num">{cards ? cards.length : "—"}</b><span>con tarjeta</span></div>
        <div className="kpi glass"><small>Sorpresas</small><b className="display num">{cards ? pend : "—"}</b><span>por entregar</span></div>
      </div>
      <div className="input-ico search"><Search size={17} /><input className="input" placeholder="Buscar por nombre o celular" value={q} onChange={(e) => setQ(e.target.value)} /></div>

      <div className="club-list stagger">
        {!cards ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={108} r={22} />) : list.length === 0 ? <Empty icon={<Gift size={22} />} title="Aún no hay miembros" text="Se unen al reservar o desde /clientes/club" /> : list.map((c) => (
          <div key={c.Telefono} className={`glass club-item ${c.Premio_Pendiente ? "prize" : ""}`}>
            <div className="row">
              <div className="grow"><b>{c.Nombre || "Cliente"}</b><small className="muted">{phonePretty(c.Telefono)} · {c.Tarjetas_Completas} tarjetas · {c.Sellos_Totales} sellos</small></div>
              <a className="icon-btn wa" href={waLink(c.Telefono, `Hola ${c.Nombre?.split(" ")[0] || ""}, ¡tienes ${c.Sellos} sellos en tu tarjeta Stars! ✦`)} target="_blank" rel="noreferrer"><MessageCircle size={16} /></a>
            </div>
            <div className="mini-stamps">
              {Array.from({ length: c.Max }, (_, i) => <i key={i} className={`${i < c.Sellos ? "on" : ""} ${i + 1 === c.Premio_En ? "gift" : ""}`}>{i + 1 === c.Premio_En ? <Gift size={11} /> : null}</i>)}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-xs btn-ghost" onClick={() => plus(c, -1)} disabled={c.Sellos === 0}><Minus size={13} /></button>
              <button className="btn btn-xs btn-soft" onClick={() => plus(c, 1)}><Plus size={13} /> Sello</button>
              <span className="grow" />
              {c.Premio_Pendiente && <button className="btn btn-xs btn-gold" onClick={() => redeem(c)}><Gift size={13} /> Entregar sorpresa</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
