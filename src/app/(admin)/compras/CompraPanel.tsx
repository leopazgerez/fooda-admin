"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, btnPrimary, btnSecondary, inputCls, selectCls } from "@/components/ui";
import { api } from "@/lib/api";
import type { AlertaPrecio, CompraVista, InsumoOpcion, ProveedorOpcion } from "@/lib/apiTypes";
import { toLocalISODate } from "@/lib/dateUtils";
import { feedback } from "@/lib/feedback";
import { money } from "@/lib/format";

interface Linea { insumoId: number; cantidad: number; precioEnvase: number }

/**
 * Registrar lo que se compró. Con `compra` (lista por comprar de una producción) llega prellenada con cantidades y
 * precios vigentes; sin ella es una compra suelta (envases, etc.). Al guardar queda comprada y crea el gasto.
 * Montarlo solo mientras está abierto.
 */
export default function CompraPanel({ compra, proveedores, insumos, onClose }: {
  compra: CompraVista | null; proveedores: ProveedorOpcion[]; insumos: InsumoOpcion[]; onClose: () => void;
}) {
  const [proveedorSel, setProveedorId] = useState(compra?.proveedorId ?? 0);
  const proveedorId = proveedorSel || proveedores[0]?.id || 0; // proveedores puede llegar después de abrir
  const [fecha, setFecha] = useState(toLocalISODate());
  const [lineas, setLineas] = useState<Linea[]>(
    compra?.lineas.map((l) => ({ insumoId: l.insumoId, cantidad: l.cantidad, precioEnvase: Math.round(l.precioEnvase) })) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // contenido/unidad: los de la lista (congelados en la producción) o los del insumo
  const info = (id: number) => compra?.lineas.find((l) => l.insumoId === id) ?? insumos.find((i) => i.id === id);
  const subtotal = (l: Linea) => (l.cantidad / (info(l.insumoId)?.contenido || 1)) * l.precioEnvase;
  const total = Math.round(lineas.reduce((a, l) => a + subtotal(l), 0));
  const delProveedor = insumos.filter((i) => i.activo && i.proveedorId === proveedorId);

  const set = (k: number, cambio: Partial<Linea>) => setLineas((ls) => ls.map((l, i) => (i === k ? { ...l, ...cambio } : l)));
  const agregar = () => {
    const i = delProveedor.find((x) => !lineas.some((l) => l.insumoId === x.id)) ?? delProveedor[0];
    if (i) setLineas([...lineas, { insumoId: i.id, cantidad: i.contenido, precioEnvase: i.precioEnvase ?? 0 }]);
  };

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = compra
        ? await api.post<CompraVista & { alertas: AlertaPrecio[] }>(`/compras/${compra.id}/comprar`, { fecha, lineas }, { silent: true })
        : await api.post<CompraVista & { alertas: AlertaPrecio[] }>("/compras", { proveedorId, fecha, lineas }, { silent: true });
      feedback.success(`Compra en ${r.proveedor} registrada (${money(r.total)}). Ya figura como gasto.`);
      for (const a of r.alertas)
        feedback.error(`${a.insumo}: ${money(a.anterior)} → ${money(a.nuevo)} (+${Math.round(a.suba * 100)} %)`, "Subió el precio");
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel size="lg" onClose={onClose}
      title={compra ? `Registrar compra · ${compra.proveedor}${compra.produccion ? ` · ${compra.produccion}` : ""}` : "Compra suelta"}
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
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
            const i = info(l.insumoId);
            return (
              <div key={k} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_110px_120px_90px_28px] gap-2 items-center">
                {compra ? <span className="col-span-2 sm:col-span-1 text-xs text-text-body truncate">{i && "insumo" in i ? i.insumo : ""}</span> : (
                  <select value={l.insumoId} onChange={(e) => {
                    const n = insumos.find((x) => x.id === Number(e.target.value));
                    set(k, { insumoId: Number(e.target.value), precioEnvase: n?.precioEnvase ?? 0 });
                  }} className={`${selectCls} col-span-2 sm:col-span-1`}>
                    {delProveedor.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                  </select>
                )}
                <div className="relative">
                  <input type="number" min={0} value={l.cantidad} onChange={(e) => set(k, { cantidad: Number(e.target.value) || 0 })}
                    className={`${inputCls} font-mono pr-8`} aria-label="Cantidad" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-mono">{i?.unidad}</span>
                </div>
                <input type="number" min={0} value={l.precioEnvase} onChange={(e) => set(k, { precioEnvase: Number(e.target.value) || 0 })}
                  className={`${inputCls} font-mono`} aria-label="Precio por envase" title={`Envase de ${i?.contenido} ${i?.unidad}`} />
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
