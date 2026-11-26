"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, ListTable, btnPrimary, btnSecondary, inputCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Supplier as Proveedor } from "@/lib/api.gen";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

const columnas: Columna<Proveedor>[] = [
  { key: "orden", header: "ORDEN", className: "font-mono text-text-secondary w-16", render: (p) => p.sortOrder },
  { key: "nombre", header: "PROVEEDOR / LUGAR DE COMPRA", className: "font-semibold text-brand-dark", render: (p) => p.name },
  { key: "dia", header: "DÍA DE COMPRA", className: "text-text-secondary", render: (p) => p.purchaseDay || "—" },
];

/** Lugares de compra; el orden define en qué orden aparecen en la lista de súper. */
export default function ProveedoresTab() {
  const [edit, setEdit] = useState<Proveedor | "nuevo" | null>(null);
  const { data, error, reload } = useApiResource(() => api.getAll<Proveedor>("/suppliers"), []);
  useReloadOnWrite(reload);
  const proveedores = data ?? [];
  // el panel recibe el registro recargado (version al día), no la copia del click
  const abierto = edit && edit !== "nuevo" ? proveedores.find((p) => p.id === edit.id) ?? edit : edit;
  return (
    <div className="flex flex-col gap-3">
      <ApiErrorBanner error={error} />
      <div className="flex justify-end">
        <button type="button" onClick={() => setEdit("nuevo")} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Nuevo proveedor</button>
      </div>
      <ListTable rows={proveedores} rowKey={(p) => p.id} columns={columnas} onRowClick={setEdit} empty="Sin proveedores."
        footer="El orden es el de la lista de súper" />
      <AnimatePresence>{abierto && <ProveedorForm proveedor={abierto === "nuevo" ? null : abierto} siguiente={proveedores.reduce((a, p) => Math.max(a, p.sortOrder), 0) + 1} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

function ProveedorForm({ proveedor, siguiente, onClose }: { proveedor: Proveedor | null; siguiente: number; onClose: () => void }) {
  const [f, setF] = useState({ nombre: proveedor?.name ?? "", diaCompra: proveedor?.purchaseDay ?? "", orden: proveedor?.sortOrder ?? siguiente });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? "!border-danger ring-2 ring-danger/20" : "");
  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    const todo = { name: f.nombre.trim(), purchaseDay: f.diaCompra.trim() || null, sortOrder: f.orden };
    const cambios = proveedor ? Object.fromEntries(Object.entries(todo).filter(([k, v]) => v !== (proveedor[k as keyof Proveedor] ?? null))) : todo;
    if (proveedor && !Object.keys(cambios).length) return onClose();
    const body = proveedor ? { ...cambios, version: proveedor.version } : cambios;
    setError(null);
    setBusy(true);
    try {
      if (proveedor) await api.patch(`/suppliers/${proveedor.id}`, body, { silent: true, success: `${todo.name} actualizado.` });
      else await api.post("/suppliers", body, { silent: true, success: `${todo.name} agregado.` });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormPanel title={proveedor ? `Editar ${proveedor.name}` : "Nuevo proveedor"} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="proveedor-form" disabled={busy || !f.nombre.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="proveedor-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <Field label="NOMBRE"><input value={f.nombre} maxLength={60} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={`${inputCls} ${bad("name")}`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="DÍA DE COMPRA"><input value={f.diaCompra} maxLength={30} placeholder="Ej: martes" onChange={(e) => setF({ ...f, diaCompra: e.target.value })} className={inputCls} /></Field>
          <Field label="ORDEN"><input type="number" min={1} value={f.orden} onChange={(e) => setF({ ...f, orden: Math.max(1, Number(e.target.value) || 1) })} className={`${inputCls} font-mono`} /></Field>
        </div>
      </form>
    </FormPanel>
  );
}
