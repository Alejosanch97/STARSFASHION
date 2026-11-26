import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, UserPlus, Wand2, Save, RotateCcw, Power, Copy } from "lucide-react";
import { useApp } from "../../lib/store";
import { DEMO } from "../../lib/api";
import { Avatar, Field, Sheet, toast, Segmented } from "../../components/ui";
import { ROLE } from "./More";
import { SERIES } from "../../config";

const ROLES = ["barber", "barber,admin", "barber,owner", "owner", "superadmin"];
const pass = () => "Stars-" + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.floor(Math.random() * 90 + 10);

export function Control() {
  const { data, mutate, load } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState("equipo");
  const [f, setF] = useState({ Nombre: "", Email: "", WhatsApp: "", Password: pass(), Rol: "barber", Especialidad: "", Color: SERIES[2] });
  const [edit, setEdit] = useState(null);
  const [cfg, setCfg] = useState(() => ({ ...data.config, Horario_Local: undefined }));

  const create = () => {
    if (!f.Nombre || !f.Email) return toast("Nombre y correo.", "error");
    const tmp = { ...f, User_Id: "tmp" + Date.now(), Estrellas: 5, Activo: true, Horario: data.config.Horario_Local, Almuerzo: { desde: "12:00", hasta: "15:00", min: 60 } };
    mutate("user_save", { user: f }, {
      apply: (d) => ({ ...d, users: [...d.users, tmp] }),
      done: (res, d) => ({ ...d, users: d.users.map((u) => (u.User_Id === tmp.User_Id ? res.user : u)) }),
      okMsg: `${f.Nombre} ya puede entrar ✦`,
    }).catch(() => {});
    navigator.clipboard?.writeText(`Stars Fashion · ${location.origin}\nUsuario: ${f.Email}\nClave: ${f.Password}`);
    toast("Credenciales copiadas para enviarlas por WhatsApp", "gold");
    setF({ Nombre: "", Email: "", WhatsApp: "", Password: pass(), Rol: "barber", Especialidad: "", Color: SERIES[2] });
  };
  const saveUser = (u) => {
    mutate("user_save", { user: u }, { apply: (d) => ({ ...d, users: d.users.map((x) => (x.User_Id === u.User_Id ? { ...x, ...u } : x)) }), done: (res, d) => ({ ...d, users: d.users.map((x) => (x.User_Id === u.User_Id ? res.user : x)) }), okMsg: "Usuario actualizado" }).catch(() => {});
    setEdit(null);
  };
  const saveCfg = () => {
    const { Horario_Local: _h, ...rest } = cfg;
    mutate("config_save", { config: rest }, { apply: (d) => ({ ...d, config: { ...d.config, ...rest } }), okMsg: "Ajustes guardados ✦" }).catch(() => {});
  };
  const C = (k, label, hint, type = "text") => (
    <Field key={k} label={label} hint={hint}><input type={type} value={cfg[k] ?? ""} onChange={(e) => setCfg({ ...cfg, [k]: type === "number" ? Number(e.target.value) : e.target.value })} /></Field>
  );

  return (
    <div className="page form-page">
      <button className="link-back" onClick={() => nav("/app/mas")}><ChevronLeft size={16} /> Más</button>
      <div className="page-head"><div><span className="eyebrow">Super admin</span><h1 className="display">Control</h1></div></div>
      <Segmented value={tab} onChange={setTab} options={[{ value: "equipo", label: "Equipo" }, { value: "ajustes", label: "Ajustes" }]} />

      {tab === "equipo" ? (
        <>
          <div className="glass card" style={{ marginTop: 14 }}>
            <h3 className="card-t"><UserPlus size={18} /> Crear barbero rápido</h3>
            <Field label="Nombre"><input value={f.Nombre} onChange={(e) => setF({ ...f, Nombre: e.target.value, Email: f.Email || "" })} placeholder="Ej: Brayan" /></Field>
            <Field label="Correo"><input type="email" value={f.Email} onChange={(e) => setF({ ...f, Email: e.target.value })} placeholder={f.Nombre ? `${f.Nombre.toLowerCase().split(" ")[0]}@starsfashion.co` : "barbero@starsfashion.co"}
              onFocus={() => !f.Email && f.Nombre && setF({ ...f, Email: `${f.Nombre.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").slice(0, 14)}@starsfashion.co` })} /></Field>
            <Field label="WhatsApp del barbero" hint="Los clientes le escriben a este número"><input inputMode="tel" value={f.WhatsApp} onChange={(e) => setF({ ...f, WhatsApp: e.target.value })} placeholder="300 123 4567" /></Field>
            <Field label="Contraseña inicial"><div className="row" style={{ gap: 8 }}><input value={f.Password} onChange={(e) => setF({ ...f, Password: e.target.value })} /><button type="button" className="icon-btn" onClick={() => setF({ ...f, Password: pass() })}><Wand2 size={16} /></button></div></Field>
            <Field label="Rol"><select value={f.Rol} onChange={(e) => setF({ ...f, Rol: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r.split(",").map((x) => ROLE[x]).join(" + ")}</option>)}</select></Field>
            <div className="field"><span className="field-label">Color</span><div className="color-row">{SERIES.map((c) => <button key={c} type="button" className={f.Color === c ? "on" : ""} style={{ background: c }} onClick={() => setF({ ...f, Color: c })} />)}</div></div>
            <button className="btn btn-primary block" onClick={create}><UserPlus size={18} /> Crear y copiar acceso</button>
          </div>

          <div className="title-row"><h2>Cuentas</h2><span className="muted">{data.users.length}</span></div>
          <div className="glass">
            <ul className="list">
              {data.users.map((u) => (
                <li key={u.User_Id} className={u.Activo === false ? "dim" : ""} onClick={() => setEdit({ ...u, Password: "" })}>
                  <Avatar user={u} size={38} />
                  <div className="grow"><b>{u.Nombre}</b><small className="ellipsis">{u.Email} · {String(u.Rol).split(",").map((x) => ROLE[x.trim()]).join(" + ")}</small></div>
                  {u.Activo === false && <span className="tag">inactivo</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="glass card" style={{ marginTop: 14 }}>
          {C("Negocio", "Nombre del negocio")}
          {C("Slogan", "Slogan")}
          {C("Direccion", "Dirección")}
          {C("Maps_URL", "Link de Google Maps")}
          <div className="grid2">{C("WhatsApp_1", "WhatsApp 1", "", "tel")}{C("WhatsApp_2", "WhatsApp 2", "", "tel")}</div>
          {C("Instagram", "Instagram (sin @)")}
          {C("Llave_Pago", "Llave de pago", "Bre-B / Nequi")}
          <div className="grid2">{C("Paso_Min", "Cada cuántos min", "Horas que se ofrecen", "number")}{C("Anticipacion_Min", "Anticipación", "Minutos mínimos", "number")}</div>
          <div className="grid2">{C("Dias_Reserva", "Días de agenda", "", "number")}{C("Sellos_Tarjeta", "Sellos tarjeta", "", "number")}</div>
          <div className="grid2">{C("Sello_Premio", "Sello del regalo", "", "number")}{C("Premio_Texto", "Texto del regalo")}</div>
          {"Push_Relay_URL" in cfg && <>{C("Push_Relay_URL", "Relay web-push (privado)", "Ver carpeta push-relay/")}{C("Push_Relay_Secret", "Secreto del relay")}</>}
          <button className="btn btn-primary block" onClick={saveCfg}><Save size={18} /> Guardar ajustes</button>
          {DEMO && (
            <button className="btn btn-ghost block" style={{ marginTop: 10 }} onClick={async () => { const m = await import("../../lib/demo.js"); m.resetDemo(); await load(); toast("Datos demo reiniciados ✦", "gold"); }}>
              <RotateCcw size={16} /> Reiniciar datos demo
            </button>
          )}
        </div>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.Nombre} subtitle={edit?.Email}
        footer={<button className="btn btn-primary" onClick={() => saveUser(edit)}>Guardar</button>}>
        {edit && (
          <>
            <Field label="Nombre"><input value={edit.Nombre} onChange={(e) => setEdit({ ...edit, Nombre: e.target.value })} /></Field>
            <Field label="Correo"><input value={edit.Email} onChange={(e) => setEdit({ ...edit, Email: e.target.value })} /></Field>
            <Field label="WhatsApp"><input inputMode="tel" value={edit.WhatsApp || ""} onChange={(e) => setEdit({ ...edit, WhatsApp: e.target.value })} placeholder="300 123 4567" /></Field>
            <Field label="Rol"><select value={edit.Rol} onChange={(e) => setEdit({ ...edit, Rol: e.target.value })}>{[...new Set([edit.Rol, ...ROLES])].map((r) => <option key={r} value={r}>{String(r).split(",").map((x) => ROLE[x.trim()] || x).join(" + ")}</option>)}</select></Field>
            <Field label="Nueva contraseña" hint="Déjalo vacío para no cambiarla"><div className="row" style={{ gap: 8 }}><input value={edit.Password} onChange={(e) => setEdit({ ...edit, Password: e.target.value })} /><button type="button" className="icon-btn" onClick={() => { const p = pass(); setEdit({ ...edit, Password: p }); navigator.clipboard?.writeText(p); toast("Clave copiada"); }}><Copy size={16} /></button></div></Field>
            <label className="check"><input type="checkbox" checked={edit.Activo !== false} onChange={(e) => setEdit({ ...edit, Activo: e.target.checked })} /><span><b><Power size={13} /> Cuenta activa</b><small>Si la apagas, no entra ni aparece en reservas</small></span></label>
          </>
        )}
      </Sheet>
    </div>
  );
}
