import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarHeart, MapPin, MessageCircle, Clock, Gift, CalendarCheck, ChevronDown, Crown, Camera, Sparkles, Plus, Share } from "lucide-react";
import { usePublic } from "./ClientLayout";
import { Logo, Stars, Avatar, Skeleton } from "../../components/ui";
import { nice, DAYS, dow, todayStr, nowMin, toMin, h12, money, durLabel, waLink } from "../../lib/time";
import { isIOS, isStandalone } from "../../lib/push";

export function ClientHome() {
  const { pub, loading } = usePublic();
  const [hours, setHours] = useState(false);
  const [open, setOpen] = useState(null);
  const cfg = pub?.config || {};
  const H = cfg.Horario_Local || {};
  const t = todayStr(), d = dow(t);
  const isOpen = H[d]?.on && nowMin() >= toMin(H[d].start) && nowMin() < toMin(H[d].end);
  const rating = pub?.barbers?.length ? (pub.barbers.reduce((a, b) => a + Number(b.Estrellas || 5), 0) / pub.barbers.length) : 5;

  return (
    <main className="cl-home">
      <header className="cl-hero fade-in">
        <div className="cl-logo"><span className="orbit" /><Logo size={96} /></div>
        <span className="eyebrow">{cfg.Slogan || "Barbería VIP · Bogotá"}</span>
        <h1 className="display cl-name">{(cfg.Negocio || "STARS FASHION").split(" ").map((w, i) => i === 1 ? <em key={i}> {w}</em> : <span key={i}>{w}</span>)}</h1>
        <div className="cl-rating"><Stars value={rating} size={14} /><span className="num">{rating.toFixed(1)}</span><i />
          <span className={`open-dot ${isOpen ? "on" : ""}`}>{isOpen ? `Abierto · cierra ${h12(H[d].end)}` : "Cerrado ahora"}</span></div>
      </header>

      <Link to="/clientes/reservar" className="cl-cta fade-in" style={{ animationDelay: ".06s" }}>
        <span className="cl-cta-ico"><CalendarHeart size={24} /></span>
        <span className="grow"><b>Reservar cita</b><small>Elige barbero y hora en 30 segundos</small></span>
        <Sparkles size={20} className="cta-spark" />
      </Link>

      <nav className="cl-links stagger">
        <Link className="cl-link" to="/clientes/mis-citas"><span className="li"><CalendarCheck size={19} /></span><span className="grow"><b>Cancelar o reagendar</b><small>Mis citas y mensajes de tu barbero</small></span></Link>
        <Link className="cl-link gold" to="/clientes/club"><span className="li"><Gift size={19} /></span><span className="grow"><b>Mi tarjeta Stars</b><small>Junta sellos · ¡en el 8 hay sorpresa!</small></span></Link>
        <button className={`cl-link ${hours ? "open" : ""}`} onClick={() => setHours(!hours)}>
          <span className="li"><Clock size={19} /></span><span className="grow"><b>Ver horario</b><small>{H[d]?.on ? `Hoy ${h12(H[d].start)} – ${h12(H[d].end)}` : "Hoy cerrado"}</small></span><ChevronDown size={18} className="chev" />
        </button>
        {hours && (
          <div className="cl-hours glass fade-in">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => (
              <div key={i} className={i === d ? "today" : ""}><span>{DAYS[i]}</span><b className="num">{H[i]?.on ? `${H[i].start} – ${H[i].end}` : "Cerrado"}</b></div>
            ))}
          </div>
        )}
        <a className="cl-link" href={cfg.Maps_URL} target="_blank" rel="noreferrer"><span className="li"><MapPin size={19} /></span><span className="grow"><b>¿Dónde estamos?</b><small>{cfg.Direccion || "Bogotá"}</small></span></a>
        {cfg.Instagram && <a className="cl-link" href={`https://instagram.com/${cfg.Instagram}`} target="_blank" rel="noreferrer"><span className="li"><Camera size={19} /></span><span className="grow"><b>Instagram</b><small>@{cfg.Instagram}</small></span></a>}
      </nav>

      {isIOS() && !isStandalone() && (
        <div className="install-hint glass"><Share size={16} /><span>Instala la app: toca <b>Compartir</b> → <b>Agregar a inicio</b> y recibe avisos de tu cita.</span></div>
      )}

      <section className="cl-section">
        <div className="title-row"><h2>Nuestros barberos</h2></div>
        <div className="barber-cards">
          {loading ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} h={230} w={210} r={26} style={{ flex: "0 0 210px" }} />) :
            (pub?.barbers || []).map((b) => (
              <article key={b.User_Id} className="barber-card glass">
                <Avatar user={b} size={74} ring />
                <b className="display">{b.Nombre}</b>
                <Stars value={Number(b.Estrellas) || 5} size={13} />
                {b.Especialidad && <span className="tag gold">{b.Especialidad}</span>}
                <p>{b.Descripcion}</p>
                <div className="barber-card-actions">
                  <Link to={`/clientes/reservar?barbero=${b.User_Id}`} className="btn btn-sm btn-primary">Reservar con {b.Nombre.split(" ")[0]}</Link>
                  {b.WhatsApp && <a className="icon-btn wa" href={waLink(b.WhatsApp, `Hola ${b.Nombre.split(" ")[0]} ✦ te escribo desde Stars Fashion`)} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${b.Nombre}`}><MessageCircle size={17} /></a>}
                </div>
              </article>
            ))}
        </div>
      </section>

      <section className="cl-section">
        <div className="title-row"><h2>Servicios</h2><span className="muted" style={{ fontSize: ".8rem" }}>Todos incluyen bebida ☕</span></div>
        <div className="svc-list">
          {loading ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={86} r={22} />) : (pub?.services || []).map((s) => (
            <article key={s.Id} className={`svc glass ${s.Destacado ? "vip" : ""} ${open === s.Id ? "open" : ""}`}>
              <button className="svc-top" onClick={() => setOpen(open === s.Id ? null : s.Id)}>
                <div className="grow">
                  <b>{s.Destacado && <Crown size={14} className="gold-ico" />} {nice(s.Nombre)}</b>
                  <small className="num">{durLabel(s.Duracion_Min)}</small>
                </div>
                <span className="display num price">{money(s.Precio)}</span>
              </button>
              {open === s.Id && (
                <div className="svc-more fade-in">
                  {s.Resumen && <p>{s.Resumen}</p>}
                  <ul>{s.Incluye.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}
              <div className="svc-actions">
                <button className="link" onClick={() => setOpen(open === s.Id ? null : s.Id)}>{open === s.Id ? "Menos" : "Más información"}</button>
                <Link to={`/clientes/reservar?servicio=${s.Id}`} className="btn btn-xs btn-gold"><Plus size={13} /> Agendar</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="cl-foot">
        <Logo size={34} />
        <p><b>{cfg.Negocio || "STARS FASHION"}</b><br />{cfg.Direccion}</p>
        <Link to="/" className="muted">Acceso barberos</Link>
      </footer>
    </main>
  );
}
