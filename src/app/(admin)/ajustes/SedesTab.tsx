"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, ListTable, Tag, btnPrimary, btnSecondary, inputCls, selectCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { BranchResponse, SaleResponse, StockResponse } from "@/lib/api.gen";
import { toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

type Sede = BranchResponse;
type SedeNueva = Omit<Sede, "id" | "version">;
const NUEVA: SedeNueva = { name: "", address: "", capacity: 60, stockThreshold: 10, freeSlotsThreshold: 20,
  shipping: { type: "amount", value: 0 }, affectsPrice: false, kitchen: false };
type Fila = Sede & { stock: number; alertas: string[]; packsMes: number; facturado: number };

export default function SedesTab() {
  const [edit, setEdit] = useState<Sede | SedeNueva | null>(null);
  const mes = toLocalISODate().slice(0, 7);
  const { data, error, reload } = useApiResource(() => Promise.all([
    api.getAll<Sede>("/branches"), api.getOne<StockResponse>("/stock"),
    api.getAll<SaleResponse>("/sales", { params: { from: `${mes}-01` } }),
  ]), [mes]);
  useReloadOnWrite(reload);
  const [sedes, stock, ventas] = data ?? [[], { rows: [], byBranch: [] }, []];
  const filas: Fila[] = sedes.map((s) => {
    const st = stock.byBranch.find((x) => x.branchId === s.id);
    const vs = ventas.filter((v) => v.branchId === s.id);
    return { ...s, stock: st?.total ?? 0, alertas: st?.alerts ?? [], packsMes: vs.reduce((a, v) => a + v.packs, 0), facturado: vs.reduce((a, v) => a + v.total, 0) };
  });

  const columnas: Columna<Fila>[] = [
    { key: "sede", header: "SEDE", className: "font-semibold text-brand-dark whitespace-nowrap", render: (s) => s.name },
    { key: "rol", header: "ROL", hideBelow: "sm", render: (s) => (s.kitchen ? <Tag tone="solid">Cocina</Tag> : <Tag tone="info">Punto de venta</Tag>) },
    { key: "stock", header: "STOCK", align: "right", className: "font-mono whitespace-nowrap", render: (s) => `${s.stock} / ${s.capacity}` },
    { key: "alertas", header: "ALERTAS", render: (s) => <span className="flex flex-wrap gap-1">
      {s.alertas.includes("low_stock") && <Tag tone="danger">Stock bajo</Tag>}
      {s.alertas.includes("free_slots") && <Tag tone="warning">Viaje</Tag>}
      {!s.alertas.length && <span className="text-text-muted">—</span>}
    </span> },
    { key: "umbral", header: "ALERTA STOCK", align: "right", hideBelow: "md", className: "font-mono", render: (s) => `≤ ${s.stockThreshold}` },
    { key: "viaje", header: "ALERTA VIAJE", align: "right", hideBelow: "md", className: "font-mono", render: (s) => (s.kitchen ? "—" : `≥ ${s.freeSlotsThreshold}`) },
    { key: "envio", header: "ENVÍO", hideBelow: "md", className: "font-mono whitespace-nowrap", render: (s) => s.kitchen ? "—"
      : `${s.shipping.type === "amount" ? `${money(s.shipping.value)}/pack` : `${s.shipping.value} %`}${s.affectsPrice ? " (cliente)" : ""}` },
    { key: "mes", header: "VENTAS DEL MES", align: "right", hideBelow: "md", className: "font-mono whitespace-nowrap", render: (s) => <>
      {money(s.facturado)}<span className="block text-[10px] text-text-muted">{s.packsMes} packs</span>
    </> },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ApiErrorBanner error={error} />
      <div className="flex justify-end">
        <button type="button" onClick={() => setEdit(NUEVA)} className={btnSecondary}><Plus className="w-3.5 h-3.5" /> Nueva sede</button>
      </div>
      <ListTable rows={filas} rowKey={(s) => s.id} columns={columnas} onRowClick={setEdit} empty="Sin sedes."
        footer="Tocá una sede para editar capacidad, alertas y envío" />
      <AnimatePresence>{edit && <SedeForm sede={edit} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

function SedeForm({ sede, onClose }: { sede: Sede | SedeNueva; onClose: () => void }) {
  const [f, setF] = useState(sede);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? "!border-danger ring-2 ring-danger/20" : "");
  const n = (k: "capacity" | "stockThreshold" | "freeSlotsThreshold") => (
    <input type="number" min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad(k)}`} />
  );

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    const { name, address, capacity, stockThreshold, freeSlotsThreshold, shipping, affectsPrice } = f;
    const todo = { name: name.trim(), address: address.trim(), capacity, stockThreshold, freeSlotsThreshold, shipping, affectsPrice };
    const cambios = "id" in sede
      ? Object.fromEntries(Object.entries(todo).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(sede[k as keyof Sede])))
      : todo;
    if ("id" in sede && !Object.keys(cambios).length) return onClose();
    const body = "id" in sede ? { ...cambios, version: sede.version } : cambios;
    setError(null);
    setBusy(true);
    try {
      if ("id" in sede) await api.patch(`/branches/${sede.id}`, body, { silent: true, success: `${todo.name} actualizada.` });
      else await api.post("/branches", body, { silent: true, success: `${todo.name} creada.` });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={"id" in sede ? `Editar ${sede.name}` : "Nueva sede"} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="sede-form" disabled={busy || !f.name.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="sede-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="NOMBRE"><input value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} className={`${inputCls} ${bad("name")}`} /></Field>
          <Field label="CAPACIDAD (PACKS)">{n("capacity")}</Field>
        </div>
        <Field label="DIRECCIÓN"><input value={f.address} maxLength={120} onChange={(e) => setF({ ...f, address: e.target.value })} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ALERTA DE STOCK BAJO" hint="Avisa cuando quedan esta cantidad o menos">{n("stockThreshold")}</Field>
          {!f.kitchen && <Field label="ALERTA DE VIAJE" hint="Avisa cuando hay esta cantidad de lugares libres">{n("freeSlotsThreshold")}</Field>}
        </div>
        {!f.kitchen && <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ENVÍO POR PACK">
              <select value={f.shipping.type} onChange={(e) => setF({ ...f, shipping: { ...f.shipping, type: e.target.value } })} className={selectCls}>
                <option value="amount">Monto fijo ($)</option>
                <option value="percentage">% del precio</option>
              </select>
            </Field>
            <Field label={f.shipping.type === "amount" ? "MONTO ($)" : "PORCENTAJE"}>
              <input type="number" min={0} value={f.shipping.value} onChange={(e) => setF({ ...f, shipping: { ...f.shipping, value: Math.max(0, Number(e.target.value) || 0) } })}
                className={`${inputCls} font-mono ${bad("shipping")}`} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-body cursor-pointer">
            <input type="checkbox" checked={f.affectsPrice} onChange={(e) => setF({ ...f, affectsPrice: e.target.checked })} className="accent-accent" />
            El envío lo paga el cliente (si no, se descuenta de la ganancia)
          </label>
        </>}
      </form>
    </FormPanel>
  );
}
