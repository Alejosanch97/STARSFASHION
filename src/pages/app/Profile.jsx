import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Save } from "lucide-react";
import { useApp } from "../../lib/store";
import { Avatar, Stars, Field } from "../../components/ui";
import { SERIES } from "../../config";

const COLORS = [...SERIES, "#231a20", "#6b5a3a"];

export function Profile() {
  const { me, mutate } = useApp();
  const nav = useNavigate();
  const [f, setF] = useState({
    Nombre: me?.Nombre || "", Estrellas: Number(me?.Estrellas) || 5, Especialidad: me?.Especialidad || "",
    Descripcion: me?.Descripcion || "", Foto_URL: me?.Foto_URL || "", Color: me?.Color || SERIES[0],
  });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });

  const save = () => {
    mutate("profile_save", { profile: f }, {
      apply: (d) => ({ ...d, me: { ...d.me, ...f }, users: d.users.map((u) => (u.User_Id === d.me.User_Id ? { ...u, ...f } : u)) }),
      okMsg: "Perfil guardado ✦",
    }).catch(() => {});
    nav("/app/mas");
  };

  return (
    <div className="page form-page">
      <button className="link-back" onClick={() => nav("/app/mas")}><ChevronLeft size={16} /> Más</button>
      <div className="page-head"><div><span className="eyebrow">Así te ven los clientes</span><h1 className="display">Mi perfil</h1></div></div>

      <div className="profile-preview glass strong">
        <Avatar user={{ ...me, ...f }} size={78} ring />
        <h3 className="display">{f.Nombre || "Tu nombre"}</h3>
        <Stars value={f.Estrellas} size={15} />
        <span className="tag gold">{f.Especialidad || "Especialidad"}</span>
        <p className="muted">{f.Descripcion || "Una frase que te describa como barbero."}</p>
      </div>

      <div className="glass card">
        <Field label="Nombre"><input value={f.Nombre} maxLength={60} onChange={set("Nombre")} /></Field>
        <div className="field"><span className="field-label">Estrellas</span><Stars value={f.Estrellas} onChange={(v) => setF({ ...f, Estrellas: v })} /></div>
        <Field label="Especialidad"><input value={f.Especialidad} maxLength={60} onChange={set("Especialidad")} placeholder="Fade, freestyle, barba…" /></Field>
        <Field label="Descripción" hint={`${f.Descripcion.length}/280`}><textarea value={f.Descripcion} maxLength={280} onChange={set("Descripcion")} /></Field>
        <Field label="Foto (URL)" hint="Pega el link de una foto (Instagram, Drive público, etc.)"><input value={f.Foto_URL} onChange={set("Foto_URL")} placeholder="https://…" /></Field>
        <div className="field">
          <span className="field-label">Tu color</span>
          <div className="color-row">{COLORS.map((c) => <button key={c} type="button" className={f.Color === c ? "on" : ""} style={{ background: c }} onClick={() => setF({ ...f, Color: c })} aria-label={c} />)}</div>
        </div>
      </div>

      <div className="sticky-cta"><button className="btn btn-primary block" onClick={save}><Save size={18} /> Guardar perfil</button></div>
    </div>
  );
}
