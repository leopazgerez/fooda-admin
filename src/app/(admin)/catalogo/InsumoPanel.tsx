"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, BotonBaja, Field, FormPanel, ListTable, btnPrimary, btnSecondary, inputCls, selectCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { PriceResponse as PrecioInsumo, Supplier as Proveedor, SupplyResponse as InsumoVista } from "@/lib/api.gen";
import { formatDate, toLocalISODate } from "@/lib/dateUtils";
import { REGLA_COMPUESTO, UNIDAD, etiqueta, opciones } from "@/lib/etiquetas";
import { money } from "@/lib/format";
import { useApiResource } from "@/lib/useApi";

const badField = "!border-danger ring-2 ring-danger/20";
type UnidadInsumo = "g" | "ml" | "u";

/** Alta o edición de insumo. El precio se carga como un precio nuevo con fecha (el historial se conserva). */
export default function InsumoPanel({ insumo, proveedores, onClose }: { insumo: InsumoVista | null; proveedores: Proveedor[]; onClose: () => void }) {
  const [f, setF] = useState({
    name: insumo?.name ?? "", unit: insumo?.unit ?? "g", supplierId: insumo?.supplierId ?? proveedores[0]?.id ?? 0,
    content: insumo?.content ?? 1000, gramsPerUnit: insumo?.gramsPerUnit ?? 0, presentation: insumo?.presentation ?? "", active: insumo?.active ?? true,
  });
  const [precioInicial, setPrecioInicial] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? badField : "");
  const compuesto = !!insumo?.composite;

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    const todo = { ...f, name: f.name.trim(), presentation: f.presentation.trim() || null, gramsPerUnit: f.unit === "u" && f.gramsPerUnit ? f.gramsPerUnit : null };
    setError(null);
    setBusy(true);
    try {
      if (insumo) {
        const cambios = Object.fromEntries(Object.entries(todo).filter(([k, v]) => v !== ((insumo as unknown as Record<string, unknown>)[k] ?? null)));
        if (Object.keys(cambios).length) await api.patch(`/supplies/${insumo.id}`, { ...cambios, version: insumo.version }, { silent: true, success: `${todo.name} actualizado.` });
      } else {
        await api.post("/supplies", { ...todo, ...(precioInicial > 0 ? { packagePrice: precioInicial } : {}) }, { silent: true, success: `${todo.name} agregado.` });
      }
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={insumo ? insumo.name : "Nuevo insumo"} onClose={onClose} footer={<>
      {insumo && <BotonBaja label="Eliminar" itemName={insumo.name} description="Si está en uso, la API no lo deja eliminar y te dice por qué." className={`${btnSecondary} md:mr-auto text-danger`}
        accion={() => api.del(`/supplies/${insumo.id}`, { silent: true, success: `${insumo.name} eliminado.` })} onHecho={onClose} onError={setError} />}
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="insumo-form" disabled={busy || !f.name.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="insumo-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        {compuesto && <p className="p-3 bg-surface-alt border border-border-subtle rounded-xs text-xs text-text-secondary">
          Insumo compuesto: su costo sale del {etiqueta(REGLA_COMPUESTO, insumo?.composite?.rule ?? "average")} de sus partes. No lleva precio propio.
        </p>}
        <Field label="NOMBRE"><input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} className={`${inputCls} ${bad("name")}`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="PROVEEDOR">
            <select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: Number(e.target.value) })} className={`${selectCls} ${bad("supplierId")}`}>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="UNIDAD">
            <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as UnidadInsumo })} className={`${selectCls} ${bad("unit")}`}>
              {opciones(UNIDAD).map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
          <Field label={`CONTENIDO DEL ENVASE (${f.unit})`} hint="Cuánto trae lo que comprás: el costo por unidad sale de acá">
            <input type="number" min={0} value={f.content} onChange={(e) => setF({ ...f, content: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad("content")}`} />
          </Field>
          <Field label="PRESENTACIÓN"><input value={f.presentation} maxLength={60} placeholder="Ej: paquete 1 kg" onChange={(e) => setF({ ...f, presentation: e.target.value })} className={inputCls} /></Field>
        </div>
        {f.unit === "u" && (
          <Field label="GRAMOS POR UNIDAD (OPCIONAL)" hint="Para recetas que lo usan en gramos">
            <input type="number" min={0} value={f.gramsPerUnit} onChange={(e) => setF({ ...f, gramsPerUnit: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad("gramsPerUnit")}`} />
          </Field>
        )}
        {!insumo && (
          <Field label="PRECIO DEL ENVASE ($)" hint="Opcional: lo podés cargar después">
            <input type="number" min={0} value={precioInicial} onChange={(e) => setPrecioInicial(Math.max(0, Number(e.target.value) || 0))} className={`${inputCls} font-mono`} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-xs text-text-body cursor-pointer">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="accent-accent" /> Activo
        </label>
      </form>
      {insumo && !compuesto && <Precios insumo={insumo} />}
    </FormPanel>
  );
}

function Precios({ insumo }: { insumo: InsumoVista }) {
  const [tick, setTick] = useState(0);
  const { data } = useApiResource(() => api.getOne<PrecioInsumo[]>(`/supplies/${insumo.id}/prices`), [insumo.id, tick]);
  const [nuevo, setNuevo] = useState({ fecha: toLocalISODate(), precio: insumo.packagePrice ?? 0 }); // null: todavía sin precio
  const [error, setError] = useState<string | null>(null);
  const colPrecios: Columna<PrecioInsumo>[] = [
    { key: "fecha", header: "DESDE", className: "font-mono text-text-secondary", render: (p) => formatDate(p.date) },
    { key: "precio", header: "PRECIO DEL ENVASE", align: "right", className: "font-mono", render: (p) => money(p.packagePrice) },
    { key: "borrar", header: "", align: "right", render: (p) => <BotonBaja label="Eliminar" itemName={`el precio del ${formatDate(p.date)}`}
      className={`${btnSecondary} py-0.5 px-2 text-[11px] text-danger`} onHecho={() => setTick((t) => t + 1)}
      onError={(e) => setError(e instanceof ApiError ? e.message : "No se pudo eliminar el precio")}
      accion={() => api.del(`/supplies/${insumo.id}/prices/${p.id}`, { silent: true, success: "Precio eliminado." })} /> },
  ];
  const agregar = async () => {
    setError(null);
    try {
      await api.post(`/supplies/${insumo.id}/prices`, { date: nuevo.fecha, packagePrice: nuevo.precio }, { silent: true, success: "Precio nuevo registrado." });
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar el precio");
    }
  };
  return (
    <div className="mt-6 pt-4 border-t border-border-subtle flex flex-col gap-3">
      <p className="text-[11px] font-bold tracking-[0.275px] text-text-label">PRECIOS</p>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end">
        <Field label="DESDE"><input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} className={inputCls} /></Field>
        <Field label="PRECIO ($)"><input type="number" min={0} value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono`} /></Field>
        <button type="button" onClick={agregar} className={`${btnSecondary} py-2`}><Plus className="w-3.5 h-3.5" /> Agregar</button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <ListTable rows={[...(data ?? [])].reverse()} rowKey={(p) => p.id} columns={colPrecios} empty="Sin precios cargados." />
    </div>
  );
}
