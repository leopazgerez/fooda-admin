"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, ListTable, btnPrimary, btnSecondary, inputCls, selectCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { InsumoVista, PrecioInsumo, Proveedor, UnidadInsumo } from "@/lib/apiTypes";
import { formatDate, toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource } from "@/lib/useApi";

const badField = "!border-danger ring-2 ring-danger/20";
const UNIDADES: { v: UnidadInsumo; l: string }[] = [{ v: "g", l: "Gramos (g)" }, { v: "ml", l: "Mililitros (ml)" }, { v: "u", l: "Unidades (u)" }];

/** Alta o edición de insumo. El precio se carga como un precio nuevo con fecha (el historial se conserva). */
export default function InsumoPanel({ insumo, proveedores, onClose }: { insumo: InsumoVista | null; proveedores: Proveedor[]; onClose: () => void }) {
  const [f, setF] = useState({
    nombre: insumo?.nombre ?? "", unidad: insumo?.unidad ?? ("g" as UnidadInsumo), proveedorId: insumo?.proveedorId ?? proveedores[0]?.id ?? 0,
    contenido: insumo?.contenido ?? 1000, gramosPorUnidad: insumo?.gramosPorUnidad ?? 0, presentacion: insumo?.presentacion ?? "", activo: insumo?.activo ?? true,
  });
  const [precioInicial, setPrecioInicial] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? badField : "");
  const compuesto = !!insumo?.compuesto;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const todo = { ...f, nombre: f.nombre.trim(), presentacion: f.presentacion.trim(), gramosPorUnidad: f.unidad === "u" && f.gramosPorUnidad ? f.gramosPorUnidad : null };
    setError(null);
    setBusy(true);
    try {
      if (insumo) {
        const body = Object.fromEntries(Object.entries(todo).filter(([k, v]) => v !== ((insumo as unknown as Record<string, unknown>)[k] ?? (k === "presentacion" ? "" : null))));
        if (Object.keys(body).length) await api.patch(`/insumos/${insumo.id}`, body, { silent: true, success: `${todo.nombre} actualizado.` });
      } else {
        await api.post("/insumos", { ...todo, ...(precioInicial > 0 ? { precioEnvase: precioInicial } : {}) }, { silent: true, success: `${todo.nombre} agregado.` });
      }
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={insumo ? insumo.nombre : "Nuevo insumo"} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="insumo-form" disabled={busy || !f.nombre.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="insumo-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        {compuesto && <p className="p-3 bg-surface-alt border border-border-subtle rounded-xs text-xs text-text-secondary">
          Insumo compuesto: su costo sale del {insumo?.compuesto?.regla === "maximo" ? "más caro" : "promedio"} de sus partes. No lleva precio propio.
        </p>}
        <Field label="NOMBRE"><input value={f.nombre} maxLength={80} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={`${inputCls} ${bad("nombre")}`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="PROVEEDOR">
            <select value={f.proveedorId} onChange={(e) => setF({ ...f, proveedorId: Number(e.target.value) })} className={`${selectCls} ${bad("proveedorId")}`}>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Field>
          <Field label="UNIDAD">
            <select value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value as UnidadInsumo })} className={selectCls}>
              {UNIDADES.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
            </select>
          </Field>
          <Field label={`CONTENIDO DEL ENVASE (${f.unidad})`} hint="Cuánto trae lo que comprás: el costo por unidad sale de acá">
            <input type="number" min={0} value={f.contenido} onChange={(e) => setF({ ...f, contenido: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad("contenido")}`} />
          </Field>
          <Field label="PRESENTACIÓN"><input value={f.presentacion} maxLength={60} placeholder="Ej: paquete 1 kg" onChange={(e) => setF({ ...f, presentacion: e.target.value })} className={inputCls} /></Field>
        </div>
        {f.unidad === "u" && (
          <Field label="GRAMOS POR UNIDAD (OPCIONAL)" hint="Para recetas que lo usan en gramos">
            <input type="number" min={0} value={f.gramosPorUnidad} onChange={(e) => setF({ ...f, gramosPorUnidad: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad("gramosPorUnidad")}`} />
          </Field>
        )}
        {!insumo && (
          <Field label="PRECIO DEL ENVASE ($)" hint="Opcional: lo podés cargar después">
            <input type="number" min={0} value={precioInicial} onChange={(e) => setPrecioInicial(Math.max(0, Number(e.target.value) || 0))} className={`${inputCls} font-mono`} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-xs text-text-body cursor-pointer">
          <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} className="accent-accent" /> Activo
        </label>
      </form>
      {insumo && !compuesto && <Precios insumo={insumo} />}
    </FormPanel>
  );
}

const colPrecios: Columna<PrecioInsumo>[] = [
  { key: "fecha", header: "DESDE", className: "font-mono text-text-secondary", render: (p) => formatDate(p.fecha) },
  { key: "precio", header: "PRECIO DEL ENVASE", align: "right", className: "font-mono", render: (p) => money(p.precioEnvase) },
];

function Precios({ insumo }: { insumo: InsumoVista }) {
  const [tick, setTick] = useState(0);
  const { data } = useApiResource(() => api.getOne<PrecioInsumo[]>(`/insumos/${insumo.id}/precios`), [insumo.id, tick]);
  const [nuevo, setNuevo] = useState({ fecha: toLocalISODate(), precio: insumo.precioEnvase ?? 0 });
  const [error, setError] = useState<string | null>(null);
  const agregar = async () => {
    setError(null);
    try {
      await api.post(`/insumos/${insumo.id}/precios`, { fecha: nuevo.fecha, precioEnvase: nuevo.precio }, { silent: true, success: "Precio nuevo registrado." });
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
