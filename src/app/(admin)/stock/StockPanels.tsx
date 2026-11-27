"use client";

import { useState } from "react";
import { ApiErrorBanner, BotonBaja, Field, FormPanel, btnPrimary, btnSecondary, inputCls, selectCls } from "@/components/ui";
import { api } from "@/lib/api";
import type { AdjustmentResponse, BranchResponse as SedeOpcion, PackResponse as PackVista, StockRow as FilaStock } from "@/lib/api.gen";
import { toLocalISODate } from "@/lib/dateUtils";
import { LineasStock, lineasBody, type LineaElegida } from "../ventas/VentaPanel";

function useGuardar(onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const Botones = ({ busy, onClose, texto, form }: { busy: boolean; onClose: () => void; texto: string; form: string }) => (<>
  <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
  <button type="submit" form={form} disabled={busy} className={btnPrimary}>{busy ? "Guardando…" : texto}</button>
</>);

/** Despachar packs a otra sede: queda registrado como enviado y mueve el stock en el acto. */
export function DespachoPanel({ sedes, filas, onClose }: { sedes: SedeOpcion[]; filas: FilaStock[]; onClose: () => void }) {
  // las sedes pueden llegar después de abrir el panel: se derivan, no se copian al estado
  const [origenSel, setOrigenId] = useState(0);
  const [destinoSel, setDestinoId] = useState(0);
  const origenId = origenSel || sedes.find((s) => s.kitchen)?.id || sedes[0]?.id || 0;
  const destinoId = destinoSel && destinoSel !== origenId ? destinoSel : sedes.find((s) => s.id !== origenId)?.id ?? 0;
  const [fecha, setFecha] = useState(toLocalISODate());
  const [notas, setNotas] = useState("");
  const [lineas, setLineas] = useState<LineaElegida[]>([]);
  const { busy, error, run } = useGuardar(onClose);

  return (
    <FormPanel title="Despachar a otra sede" size="lg" onClose={onClose}
      footer={<Botones busy={busy} onClose={onClose} texto="Registrar despacho" form="despacho-form" />}>
      <form id="despacho-form" noValidate className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        run(() => api.post("/transfers", {
          originBranchId: origenId, destinationBranchId: destinoId, date: fecha, ...(notas.trim() ? { notes: notas.trim() } : {}), lines: lineasBody(filas, lineas, false),
        }, { silent: true, success: "Despacho registrado: el stock ya está en la sede de destino." }));
      }}>
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="DESDE">
            <select value={origenId} onChange={(e) => { setOrigenId(Number(e.target.value)); setLineas([]); }} className={selectCls}>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="HACIA">
            <select value={destinoId} onChange={(e) => setDestinoId(Number(e.target.value))} className={selectCls}>
              {sedes.filter((s) => s.id !== origenId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="FECHA"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></Field>
        </div>

        <LineasStock filas={filas} sede={origenId} lineas={lineas} setLineas={setLineas} conPrecio={false} todo />

        <Field label="NOTAS (OPCIONAL)">
          <input value={notas} maxLength={120} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: lo llevó el remís" className={inputCls} />
        </Field>
      </form>
    </FormPanel>
  );
}

/** Corrección de stock con motivo. Sin lote: va al lote INICIAL (carga inicial). */
export function AjustePanel({ sedes, packs, filas, onClose }: { sedes: SedeOpcion[]; packs: PackVista[]; filas: FilaStock[]; onClose: () => void }) {
  const [sedeSel, setSedeId] = useState(0);
  const [packSel, setPackId] = useState(0);
  const sedeId = sedeSel || sedes[0]?.id || 0;
  const packId = packSel || packs[0]?.id || 0;
  const [produccionId, setProduccionId] = useState(0);
  const [cantidad, setCantidad] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(toLocalISODate());
  // guardado: el panel queda abierto con "Deshacer" (la API no lista ajustes: es la única chance de anularlo)
  const [hecho, setHecho] = useState<AdjustmentResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lotes = filas.filter((f) => f.branchId === sedeId && f.packId === packId);

  if (hecho) return (
    <FormPanel title="Ajustar stock" onClose={onClose} footer={<>
      <BotonBaja label="Deshacer" tone="neutral" title="¿Deshacer el ajuste?" confirmLabel="Deshacer"
        description="El stock vuelve a como estaba antes del ajuste." className={`${btnSecondary} md:mr-auto`}
        accion={() => api.del(`/stock-adjustments/${hecho.id}`, { silent: true, success: "Ajuste deshecho." })} onHecho={onClose} onError={setError} />
      <button type="button" onClick={onClose} className={btnPrimary}>Listo</button>
    </>}>
      <div className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <p className="text-sm text-text-body">
          Ajuste guardado: <b className="font-mono">{hecho.quantity > 0 ? "+" : "−"}{Math.abs(hecho.quantity)}</b> packs en {sedes.find((s) => s.id === hecho.branchId)?.name ?? "la sede"}.
        </p>
        <p className="text-xs text-text-secondary">Si te equivocaste, deshacelo ahora: después no se puede anular desde acá.</p>
      </div>
    </FormPanel>
  );

  return (
    <FormPanel title="Ajustar stock" onClose={onClose}
      footer={<Botones busy={busy} onClose={onClose} texto="Guardar ajuste" form="ajuste-form" />}>
      <form id="ajuste-form" noValidate className="flex flex-col gap-4" onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setError(null);
        setBusy(true);
        try {
          setHecho(await api.post<AdjustmentResponse>("/stock-adjustments", { branchId: sedeId, packId, quantity: cantidad, reason: motivo, date: fecha, ...(produccionId ? { productionId: produccionId } : {}) },
            { silent: true, success: "Stock ajustado." }));
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}>
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="SEDE">
            <select value={sedeId} onChange={(e) => { setSedeId(Number(e.target.value)); setProduccionId(0); }} className={selectCls}>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="PACK">
            <select value={packId} onChange={(e) => { setPackId(Number(e.target.value)); setProduccionId(0); }} className={selectCls}>
              {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="LOTE">
            <select value={produccionId} onChange={(e) => setProduccionId(Number(e.target.value))} className={selectCls}>
              <option value={0}>Carga inicial (sin lote)</option>
              {lotes.map((f) => <option key={f.productionId} value={f.productionId}>{f.lot} ({f.quantity} en stock)</option>)}
            </select>
          </Field>
          <Field label="CANTIDAD" hint="Positivo suma, negativo resta">
            <input type="number" value={cantidad} onChange={(e) => setCantidad(Math.trunc(Number(e.target.value) || 0))} className={`${inputCls} font-mono`} />
          </Field>
          <Field label="MOTIVO">
            <input value={motivo} maxLength={120} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: rotura, conteo" className={inputCls} />
          </Field>
          <Field label="FECHA"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></Field>
        </div>
      </form>
    </FormPanel>
  );
}
