import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Phone, User, Mail, Gift, Sparkles, Scissors, Check } from "lucide-react";
import { usePublic } from "./ClientLayout";
import { apiPost } from "../../lib/api";
import { track } from "../../lib/sync";
import { phoneNorm, phonePretty } from "../../lib/time";
import { Logo, Field, Skeleton, toast, Spinner } from "../../components/ui";

export function Loyalty() {
  const { client, setClient } = usePublic();
  const nav = useNavigate();
  const [tel, setTel] = useState(client.telefono ? phonePretty(client.telefono) : "");
  const [card, setCard] = useState(undefined);  // undefined = sin buscar, null = no es miembro
  const [busy, setBusy] = useState(false);
  const [join, setJoin] = useState({ nombre: client.nombre || "", email: client.email || "" });

  const look = async (silent) => {
    const t = phoneNorm(tel);
    if (t.length < 12) { if (!silent) toast("Escribe tu celular de 10 dígitos.", "error"); return; }
    setBusy(true);
    try { const r = await track(apiPost("client_lookup", { telefono: t })); setCard(r.card || null); setClient({ telefono: t }); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  useEffect(() => { if (client.telefono) look(true); }, []); // eslint-disable-line

  const doJoin = async () => {
    if (!join.nombre.trim()) return toast("Escribe tu nombre.", "error");
    const t = phoneNorm(tel);
    setCard({ Telefono: t, Nombre: join.nombre, Sellos: 0, Max: 10, Premio_En: 8, Premio_Texto: "SORPRESA", Tarjetas_Completas: 0, _new: true });
    try {
      const r = await track(apiPost("loyalty_join", { telefono: t, nombre: join.nombre.trim(), email: join.email.trim() }));
      setCard({ ...r.card, _new: true }); setClient({ telefono: t, nombre: join.nombre.trim(), email: join.email.trim() });
      toast("¡Bienvenido al Club Stars! ✦", "gold");
    } catch (e) { setCard(null); toast(e.message, "error"); }
  };

  return (
    <main className="booking">
      <header className="bk-head">
        <button className="icon-btn" onClick={() => nav("/clientes")} aria-label="Atrás"><ChevronLeft size={19} /></button>
        <div className="grow"><span className="eyebrow">Club Stars</span><h1 className="display">Mi tarjeta</h1></div>
      </header>

      {card === undefined && (
        <form className="lookup glass" onSubmit={(e) => { e.preventDefault(); look(false); }}>
          <div className="input-ico grow"><Phone size={17} /><input className="input" inputMode="tel" placeholder="Tu celular" value={tel} onChange={(e) => setTel(e.target.value)} /></div>
          <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? <Spinner /> : "Ver"}</button>
        </form>
      )}

      {busy && card === undefined ? <Skeleton h={230} r={28} /> : card ? <StampCard card={card} /> : card === null ? (
        <div className="glass card fade-in join">
          <div className="join-ico"><Gift size={26} /></div>
          <h2 className="display">Aún no tienes tarjeta</h2>
          <p className="muted">Únete gratis con tu celular <b>{phonePretty(tel)}</b>. Cada servicio suma un sello y en el sello 8 te espera una <b>SORPRESA</b>.</p>
          <Field label="Tu nombre"><div className="input-ico"><User size={17} /><input value={join.nombre} onChange={(e) => setJoin({ ...join, nombre: e.target.value })} /></div></Field>
          <Field label="Correo (opcional)"><div className="input-ico"><Mail size={17} /><input type="email" value={join.email} onChange={(e) => setJoin({ ...join, email: e.target.value })} /></div></Field>
          <button className="btn btn-gold block" onClick={doJoin}><Sparkles size={18} /> Crear mi tarjeta</button>
          <button className="btn btn-ghost block" style={{ marginTop: 8 }} onClick={() => setCard(undefined)}>Usar otro celular</button>
        </div>
      ) : null}

      {card && (
        <>
          <div className="how glass fade-in">
            <h3 className="card-t">¿Cómo funciona?</h3>
            <div className="how-step"><span><Scissors size={15} /></span><p>Reserva y asiste a tu cita. Tu barbero marca que llegaste.</p></div>
            <div className="how-step"><span><Check size={15} /></span><p>Al terminar el servicio, el sello se pone <b>solo</b>.</p></div>
            <div className="how-step"><span><Gift size={15} /></span><p>En el sello {card.Premio_En || 8} ganas una <b>{card.Premio_Texto || "SORPRESA"}</b>. Al completar {card.Max || 10}, empiezas tarjeta nueva.</p></div>
          </div>
          <Link to="/clientes/reservar" className="btn btn-primary block" style={{ marginTop: 12 }}>Reservar y sumar un sello</Link>
          <button className="btn btn-ghost block" style={{ marginTop: 8 }} onClick={() => setCard(undefined)}>Ver otra tarjeta</button>
        </>
      )}
    </main>
  );
}

function StampCard({ card }) {
  const max = card.Max || 10, at = card.Premio_En || 8;
  const left = Math.max(0, at - card.Sellos);
  return (
    <div className={`stamp-card fade-in ${card._new ? "new" : ""}`}>
      <div className="sc-shine" />
      <div className="sc-top">
        <div><span className="sc-eyebrow">Club Stars · Miembro</span><b className="display sc-name">{card.Nombre || "Cliente Stars"}</b><small className="num">{phonePretty(card.Telefono)}</small></div>
        <Logo size={44} />
      </div>
      <div className="sc-grid">
        {Array.from({ length: max }, (_, i) => {
          const on = i < card.Sellos, gift = i + 1 === at;
          return (
            <span key={i} className={`sc-stamp ${on ? "on" : ""} ${gift ? "gift" : ""}`} style={{ "--d": `${i * 70}ms` }}>
              {gift ? <><Gift size={18} /><em>{card.Premio_Texto || "SORPRESA"}</em></> : on ? <Sparkles size={18} /> : <b>{i + 1}</b>}
            </span>
          );
        })}
      </div>
      <div className="sc-foot">
        {card.Premio_Pendiente ? <span className="sc-prize"><Gift size={15} /> ¡Ganaste tu SORPRESA! Reclámala en tu próxima visita</span>
          : <span>{left > 0 ? <>Te faltan <b>{left}</b> sellos para tu sorpresa</> : <>Vas por la tarjeta completa: <b>{card.Sellos}/{max}</b></>}</span>}
        {card.Tarjetas_Completas > 0 && <span className="sc-done">{card.Tarjetas_Completas} tarjeta(s) completas ✦</span>}
      </div>
    </div>
  );
}
