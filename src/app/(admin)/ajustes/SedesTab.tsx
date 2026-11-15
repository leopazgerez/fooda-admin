"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, ListTable, Tag, btnPrimary, btnSecondary, inputCls, selectCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Sede, StockVista, VentaVista } from "@/lib/apiTypes";
import { toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

const NUEVA: Omit<Sede, "id"> = { nombre: "", direccion: "", capacidad: 60, umbralStock: 10, umbralLugaresLibres: 20,
  envio: { tipo: "monto", valor: 0 }, afectaPrecio: false, esCocina: false };
type Fila = Sede & { stock: number; alertas: string[]; packsMes: number; facturado: number };

export default function SedesTab() {
  const [edit, setEdit] = useState<Sede | Omit<Sede, "id"> | null>(null);
  const mes = toLocalISODate().slice(0, 7);
  const { data, error, reload } = useApiResource(() => Promise.all([
    api.getAll<Sede>("/sedes"), api.getOne<StockVista>("/stock"),
    api.getAll<VentaVista>("/ventas", { filters: [{ field: "fecha", operator: "GREATER_OR_EQUAL", value: `${mes}-01` }] }),
  ]), [mes]);
  useReloadOnWrite(reload);
  const [sedes, stock, ventas] = data ?? [[], { filas: [], porSede: [] }, []];
  const filas: Fila[] = sedes.map((s) => {
    const st = stock.porSede.find((x) => x.sedeId === s.id);
    const vs = ventas.filter((v) => v.sedeId === s.id);
    return { ...s, stock: st?.total ?? 0, alertas: st?.alertas ?? [], packsMes: vs.reduce((a, v) => a + v.packs, 0), facturado: vs.reduce((a, v) => a + v.total, 0) };
  });

  const columnas: Columna<Fila>[] = [
    { key: "sede", header: "SEDE", className: "font-semibold text-brand-dark whitespace-nowrap", render: (s) => s.nombre },
    { key: "rol", header: "ROL", hideBelow: "sm", render: (s) => (s.esCocina ? <Tag tone="solid">Cocina</Tag> : <Tag tone="info">Punto de venta</Tag>) },
    { key: "stock", header: "STOCK", align: "right", className: "font-mono whitespace-nowrap", render: (s) => `${s.stock} / ${s.capacidad}` },
    { key: "alertas", header: "ALERTAS", render: (s) => <span className="flex flex-wrap gap-1">
      {s.alertas.includes("stock_bajo") && <Tag tone="danger">Stock bajo</Tag>}
      {s.alertas.includes("lugar_libre") && <Tag tone="warning">Viaje</Tag>}
      {!s.alertas.length && <span className="text-text-muted">—</span>}
    </span> },
    { key: "umbral", header: "ALERTA STOCK", align: "right", hideBelow: "md", className: "font-mono", render: (s) => `≤ ${s.umbralStock}` },
    { key: "viaje", header: "ALERTA VIAJE", align: "right", hideBelow: "md", className: "font-mono", render: (s) => (s.esCocina ? "—" : `≥ ${s.umbralLugaresLibres}`) },
    { key: "envio", header: "ENVÍO", hideBelow: "md", className: "font-mono whitespace-nowrap", render: (s) => s.esCocina ? "—"
      : `${s.envio.tipo === "monto" ? `${money(s.envio.valor)}/pack` : `${s.envio.valor} %`}${s.afectaPrecio ? " (cliente)" : ""}` },
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

function SedeForm({ sede, onClose }: { sede: Sede | Omit<Sede, "id">; onClose: () => void }) {
  const [f, setF] = useState(sede);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? "!border-danger ring-2 ring-danger/20" : "");
  const n = (k: "capacidad" | "umbralStock" | "umbralLugaresLibres") => (
    <input type="number" min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad(k)}`} />
  );

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    const { nombre, direccion, capacidad, umbralStock, umbralLugaresLibres, envio, afectaPrecio } = f;
    const todo = { nombre: nombre.trim(), direccion: direccion.trim(), capacidad, umbralStock, umbralLugaresLibres, envio, afectaPrecio };
    const body = "id" in sede
      ? Object.fromEntries(Object.entries(todo).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(sede[k as keyof Sede])))
      : todo;
    if ("id" in sede && !Object.keys(body).length) return onClose();
    setError(null);
    setBusy(true);
    try {
      if ("id" in sede) await api.patch(`/sedes/${sede.id}`, body, { silent: true, success: `${todo.nombre} actualizada.` });
      else await api.post("/sedes", body, { silent: true, success: `${todo.nombre} creada.` });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={"id" in sede ? `Editar ${sede.nombre}` : "Nueva sede"} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="sede-form" disabled={busy || !f.nombre.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="sede-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="NOMBRE"><input value={f.nombre} maxLength={60} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={`${inputCls} ${bad("nombre")}`} /></Field>
          <Field label="CAPACIDAD (PACKS)">{n("capacidad")}</Field>
        </div>
        <Field label="DIRECCIÓN"><input value={f.direccion} maxLength={120} onChange={(e) => setF({ ...f, direccion: e.target.value })} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ALERTA DE STOCK BAJO" hint="Avisa cuando quedan esta cantidad o menos">{n("umbralStock")}</Field>
          {!f.esCocina && <Field label="ALERTA DE VIAJE" hint="Avisa cuando hay esta cantidad de lugares libres">{n("umbralLugaresLibres")}</Field>}
        </div>
        {!f.esCocina && <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ENVÍO POR PACK">
              <select value={f.envio.tipo} onChange={(e) => setF({ ...f, envio: { ...f.envio, tipo: e.target.value as "monto" | "porcentaje" } })} className={selectCls}>
                <option value="monto">Monto fijo ($)</option>
                <option value="porcentaje">% del precio</option>
              </select>
            </Field>
            <Field label={f.envio.tipo === "monto" ? "MONTO ($)" : "PORCENTAJE"}>
              <input type="number" min={0} value={f.envio.valor} onChange={(e) => setF({ ...f, envio: { ...f.envio, valor: Math.max(0, Number(e.target.value) || 0) } })}
                className={`${inputCls} font-mono ${bad("envio")}`} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-body cursor-pointer">
            <input type="checkbox" checked={f.afectaPrecio} onChange={(e) => setF({ ...f, afectaPrecio: e.target.checked })} className="accent-accent" />
            El envío lo paga el cliente (si no, se descuenta de la ganancia)
          </label>
        </>}
      </form>
    </FormPanel>
  );
}
