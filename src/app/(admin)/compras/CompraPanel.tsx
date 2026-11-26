"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, btnPrimary, btnSecondary, inputCls, selectCls } from "@/components/ui";
import { api } from "@/lib/api";
import type { BoughtResponse, PurchaseResponse as CompraVista, Supplier as ProveedorOpcion, SupplyResponse as InsumoOpcion } from "@/lib/api.gen";
import { toLocalISODate } from "@/lib/dateUtils";
import { feedback } from "@/lib/feedback";
import { money } from "@/lib/format";

interface Linea { supplyId: number; quantity: number; packagePrice: number }

/**
 * Registrar lo que se compró. Con `compra` (lista por comprar de una producción) llega prellenada con cantidades y
 * precios vigentes; sin ella es una compra suelta (envases, etc.). Al guardar queda comprada y crea el gasto.
 * Montarlo solo mientras está abierto.
 */
export default function CompraPanel({ compra, proveedores, insumos, onClose }: {
  compra: CompraVista | null; proveedores: ProveedorOpcion[]; insumos: InsumoOpcion[]; onClose: () => void;
}) {
  const [proveedorSel, setProveedorId] = useState(compra?.supplierId ?? 0);
  const proveedorId = proveedorSel || proveedores[0]?.id || 0; // proveedores puede llegar después de abrir
  const [fecha, setFecha] = useState(toLocalISODate());
  const [lineas, setLineas] = useState<Linea[]>(
    compra?.lines.map((l) => ({ supplyId: l.supplyId, quantity: l.quantity, packagePrice: Math.round(l.packagePrice) })) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // contenido/unidad: los de la lista (congelados en la producción) o los del insumo
  const info = (id: number) => compra?.lines.find((l) => l.supplyId === id) ?? insumos.find((i) => i.id === id);
  const subtotal = (l: Linea) => (l.quantity / (info(l.supplyId)?.content || 1)) * l.packagePrice;
  const total = Math.round(lineas.reduce((a, l) => a + subtotal(l), 0));
  const delProveedor = insumos.filter((i) => i.active && i.supplierId === proveedorId);

  const set = (k: number, cambio: Partial<Linea>) => setLineas((ls) => ls.map((l, i) => (i === k ? { ...l, ...cambio } : l)));
  const agregar = () => {
    const i = delProveedor.find((x) => !lineas.some((l) => l.supplyId === x.id)) ?? delProveedor[0];
    if (i) setLineas([...lineas, { supplyId: i.id, quantity: i.content, packagePrice: i.packagePrice }]);
  };

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = compra
        ? await api.post<BoughtResponse>(`/purchases/${compra.id}/buy`, { date: fecha, lines: lineas }, { silent: true })
        : await api.post<BoughtResponse>("/purchases", { supplierId: proveedorId, date: fecha, lines: lineas }, { silent: true });
      feedback.success(`Compra en ${r.purchase.supplier} registrada (${money(r.purchase.total)}). Ya figura como gasto.`);
      for (const a of r.alerts)
        feedback.error(`${a.supply}: ${money(a.previous)} → ${money(a.current)} (+${Math.round(a.rise * 100)} %)`, "Subió el precio");
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel size="lg" onClose={onClose}
      title={compra ? `Registrar compra · ${compra.supplier}${compra.production ? ` · ${compra.production}` : ""}` : "Compra suelta"}
      footer={<>
        <p className="mr-auto max-md:basis-full font-mono text-sm"><span className="text-[11px] font-bold text-text-label">TOTAL PAGADO: </span>
          <span className="font-bold text-text-primary">{money(total)}</span></p>
        <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button type="submit" form="compra-form" disabled={busy || !lineas.length} className={btnPrimary}>{busy ? "Guardando…" : "Registrar compra"}</button>
      </>}>
      <form id="compra-form" onSubmit={guardar} noValidate className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="PROVEEDOR">
            <select value={proveedorId} disabled={!!compra} onChange={(e) => { setProveedorId(Number(e.target.value)); setLineas([]); }}
              className={selectCls}>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="FECHA DE COMPRA">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_110px_120px_90px_28px] gap-2 text-[10px] font-bold tracking-[0.5px] text-text-label font-mono">
            <span>INSUMO</span><span>CANTIDAD</span><span>$ POR ENVASE</span><span className="text-right">SUBTOTAL</span><span />
          </div>
          {lineas.map((l, k) => {
            const i = info(l.supplyId);
            return (
              <div key={k} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_110px_120px_90px_28px] gap-2 items-center">
                {compra ? <span className="col-span-2 sm:col-span-1 text-xs text-text-body truncate">{i && "supply" in i ? i.supply : ""}</span> : (
                  <select value={l.supplyId} onChange={(e) => {
                    const n = insumos.find((x) => x.id === Number(e.target.value));
                    set(k, { supplyId: Number(e.target.value), packagePrice: n?.packagePrice ?? 0 });
                  }} className={`${selectCls} col-span-2 sm:col-span-1`}>
                    {delProveedor.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                )}
                <div className="relative">
                  <input type="number" min={0} value={l.quantity} onChange={(e) => set(k, { quantity: Number(e.target.value) || 0 })}
                    className={`${inputCls} font-mono pr-8`} aria-label="Cantidad" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-mono">{i?.unit}</span>
                </div>
                <input type="number" min={0} value={l.packagePrice} onChange={(e) => set(k, { packagePrice: Number(e.target.value) || 0 })}
                  className={`${inputCls} font-mono`} aria-label="Precio por envase" title={`Envase de ${i?.content} ${i?.unit}`} />
                <span className="text-xs font-mono text-right text-text-primary">{money(Math.round(subtotal(l)))}</span>
                <button type="button" onClick={() => setLineas(lineas.filter((_, j) => j !== k))} aria-label="Quitar"
                  className="text-text-muted hover:text-danger p-1 cursor-pointer justify-self-end"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
          {!compra && (
            <button type="button" onClick={agregar} disabled={!delProveedor.length} className={`${btnSecondary} self-start py-1 text-[11px]`}>
              <Plus className="w-3 h-3" /> Agregar insumo
            </button>
          )}
          {!lineas.length && <p className="text-xs text-text-muted">Sin ítems.</p>}
        </div>
      </form>
    </FormPanel>
  );
}
