"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, ListTable, btnPrimary, btnSecondary, inputCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Proveedor } from "@/lib/apiTypes";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

const columnas: Columna<Proveedor>[] = [
  { key: "orden", header: "ORDEN", className: "font-mono text-text-secondary w-16", render: (p) => p.orden },
  { key: "nombre", header: "PROVEEDOR / LUGAR DE COMPRA", className: "font-semibold text-brand-dark", render: (p) => p.nombre },
  { key: "dia", header: "DÍA DE COMPRA", className: "text-text-secondary", render: (p) => p.diaCompra || "—" },
];

/** Lugares de compra; el orden define en qué orden aparecen en la lista de súper. */
export default function ProveedoresTab() {
  const [edit, setEdit] = useState<Proveedor | "nuevo" | null>(null);
  const { data, error, reload } = useApiResource(() => api.getAll<Proveedor>("/proveedores", { sortBy: "orden" }), []);
  useReloadOnWrite(reload);
  const proveedores = data ?? [];
  return (
    <div className="flex flex-col gap-3">
      <ApiErrorBanner error={error} />
      <div className="flex justify-end">
        <button type="button" onClick={() => setEdit("nuevo")} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Nuevo proveedor</button>
      </div>
      <ListTable rows={proveedores} rowKey={(p) => p.id} columns={columnas} onRowClick={setEdit} empty="Sin proveedores."
        footer="El orden es el de la lista de súper" />
      <AnimatePresence>{edit && <ProveedorForm proveedor={edit === "nuevo" ? null : edit} siguiente={proveedores.reduce((a, p) => Math.max(a, p.orden), 0) + 1} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

function ProveedorForm({ proveedor, siguiente, onClose }: { proveedor: Proveedor | null; siguiente: number; onClose: () => void }) {
  const [f, setF] = useState({ nombre: proveedor?.nombre ?? "", diaCompra: proveedor?.diaCompra ?? "", orden: proveedor?.orden ?? siguiente });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? "!border-danger ring-2 ring-danger/20" : "");
  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    const todo = { nombre: f.nombre.trim(), diaCompra: f.diaCompra.trim() || null, orden: f.orden };
    const body = proveedor ? Object.fromEntries(Object.entries(todo).filter(([k, v]) => v !== (proveedor[k as keyof Proveedor] ?? null))) : todo;
    if (proveedor && !Object.keys(body).length) return onClose();
    setError(null);
    setBusy(true);
    try {
      if (proveedor) await api.patch(`/proveedores/${proveedor.id}`, body, { silent: true, success: `${todo.nombre} actualizado.` });
      else await api.post("/proveedores", body, { silent: true, success: `${todo.nombre} agregado.` });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormPanel title={proveedor ? `Editar ${proveedor.nombre}` : "Nuevo proveedor"} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="proveedor-form" disabled={busy || !f.nombre.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="proveedor-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <Field label="NOMBRE"><input value={f.nombre} maxLength={60} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={`${inputCls} ${bad("nombre")}`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="DÍA DE COMPRA"><input value={f.diaCompra} maxLength={30} placeholder="Ej: martes" onChange={(e) => setF({ ...f, diaCompra: e.target.value })} className={inputCls} /></Field>
          <Field label="ORDEN"><input type="number" min={1} value={f.orden} onChange={(e) => setF({ ...f, orden: Math.max(1, Number(e.target.value) || 1) })} className={`${inputCls} font-mono`} /></Field>
        </div>
      </form>
    </FormPanel>
  );
}
