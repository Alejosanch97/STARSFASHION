import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Pencil, Crown, Trash2 } from "lucide-react";
import { useApp } from "../../lib/store";
import { nice, money, durLabel } from "../../lib/time";
import { Sheet, Field } from "../../components/ui";

const EMPTY = { Id: "", Nombre: "", Duracion_Min: 60, Precio: 30000, Resumen: "", Incluye: [], Categoria: "Cortes", Destacado: false, Activo: true };

export function Services() {
  const { data, mutate } = useApp();
  const nav = useNavigate();
  const [edit, setEdit] = useState(null);

  const save = (s) => {
    const row = { ...s, Incluye: typeof s.Incluye === "string" ? s.Incluye.split("\n").map((x) => x.trim()).filter(Boolean) : s.Incluye };
    mutate("service_save", { service: row }, {
      apply: (d) => ({ ...d, services: row.Id ? d.services.map((x) => (x.Id === row.Id ? row : x)).filter((x) => x.Activo !== false) : [...d.services, { ...row, Id: "tmp" + Date.now() }] }),
      done: (res, d) => ({ ...d, services: res.services }),
      okMsg: "Servicio guardado ✦",
    }).catch(() => {});
    setEdit(null);
  };

  return (
    <div className="page">
      <button className="link-back" onClick={() => nav("/app/mas")}><ChevronLeft size={16} /> Más</button>
      <div className="page-head"><div><span className="eyebrow">Carta de servicios</span><h1 className="display">Servicios</h1></div>
        <button className="btn btn-sm btn-primary" onClick={() => setEdit({ ...EMPTY })}><Plus size={16} /> Nuevo</button></div>
      <div className="stagger" style={{ display: "grid", gap: 10 }}>
        {data.services.map((s) => (
          <button key={s.Id} className="glass svc-admin" onClick={() => setEdit({ ...s, Incluye: (s.Incluye || []).join("\n") })}>
            <div className="grow">
              <b>{s.Destacado && <Crown size={13} className="gold-ico" />} {nice(s.Nombre)}</b>
              <small className="muted num">{durLabel(s.Duracion_Min)} · {(s.Incluye || []).length} incluidos</small>
            </div>
            <span className="display num price">{money(s.Precio)}</span>
            <Pencil size={15} className="muted" />
          </button>
        ))}
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.Id ? "Editar servicio" : "Nuevo servicio"}
        footer={<>
          {edit?.Id && <button className="btn btn-danger" onClick={() => { if (confirm("¿Ocultar este servicio?")) save({ ...edit, Activo: false }); }}><Trash2 size={16} /></button>}
          <button className="btn btn-primary" onClick={() => save(edit)} disabled={!edit?.Nombre}>Guardar</button>
        </>}>
        {edit && (
          <>
            <Field label="Nombre"><input value={edit.Nombre} onChange={(e) => setEdit({ ...edit, Nombre: e.target.value.toUpperCase() })} /></Field>
            <div className="grid2">
              <Field label="Duración (min)"><input type="number" inputMode="numeric" value={edit.Duracion_Min} onChange={(e) => setEdit({ ...edit, Duracion_Min: Number(e.target.value) })} /></Field>
              <Field label="Precio"><input type="number" inputMode="numeric" value={edit.Precio} onChange={(e) => setEdit({ ...edit, Precio: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Frase corta"><input value={edit.Resumen} onChange={(e) => setEdit({ ...edit, Resumen: e.target.value })} /></Field>
            <Field label="Qué incluye" hint="Uno por línea"><textarea rows={5} value={edit.Incluye} onChange={(e) => setEdit({ ...edit, Incluye: e.target.value })} /></Field>
            <label className="check"><input type="checkbox" checked={!!edit.Destacado} onChange={(e) => setEdit({ ...edit, Destacado: e.target.checked })} /><span><b>Destacado VIP</b><small>Sale con corona en la carta</small></span></label>
          </>
        )}
      </Sheet>
    </div>
  );
}
