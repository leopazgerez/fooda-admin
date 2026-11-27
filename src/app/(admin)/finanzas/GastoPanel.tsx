"use client";

import { useState } from "react";
import { ApiErrorBanner, BotonBaja, Field, FormPanel, btnPrimary, btnSecondary, inputCls, selectCls, campoErr } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { ExpenseResponse as Gasto } from "@/lib/api.gen";
import { toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { MEDIOS } from "../ventas/VentaPanel";


/** Alta o edición de un gasto. Los generados automáticamente (compra o pago con packs) se muestran en solo lectura. */
export default function GastoPanel({ gasto, tipos, onClose }: { gasto: Gasto | null; tipos: string[]; onClose: () => void }) {
  const auto = !!(gasto?.purchaseId || gasto?.saleId);
  const [f, setF] = useState({
    date: gasto?.date ?? toLocalISODate(), type: gasto?.type ?? tipos[0] ?? "", detail: gasto?.detail ?? "",
    amount: gasto?.amount ?? 0, method: gasto?.method ?? "transfer", paid: gasto?.paid ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? campoErr : "");

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy || auto) return;
    const body: Record<string, unknown> = gasto
      ? Object.fromEntries(Object.entries({ ...f, detail: f.detail.trim() }).filter(([k, v]) => v !== gasto[k as keyof Gasto]))
      : { ...f, detail: f.detail.trim() };
    if (gasto && !Object.keys(body).length) return onClose();
    if (gasto) body.version = gasto.version;
    setError(null);
    setBusy(true);
    try {
      if (gasto) await api.patch(`/expenses/${gasto.id}`, body, { silent: true, success: "Gasto actualizado." });
      else await api.post("/expenses", body, { silent: true, success: `Gasto de ${money(f.amount)} registrado.` });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={auto ? "Gasto automático" : gasto ? "Editar gasto" : "Registrar gasto"} onClose={onClose} footer={auto
      ? <button type="button" onClick={onClose} className={btnSecondary}>Cerrar</button>
      : <>
        {gasto && <BotonBaja itemName={gasto.detail}
          accion={() => api.del(`/expenses/${gasto.id}`, { silent: true, success: "Gasto eliminado." })} onHecho={onClose} onError={setError} />}
        <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button type="submit" form="gasto-form" disabled={busy || !f.detail.trim() || f.amount <= 0} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
      </>}>
      <form id="gasto-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        {auto && (
          <p className="p-3 bg-surface-alt border border-border-subtle rounded-xs text-xs text-text-secondary">
            Se generó automáticamente desde {gasto?.purchaseId ? "una compra" : "un pago con packs"}. Para cambiarlo, corregí el registro de origen.
          </p>
        )}
        <ApiErrorBanner error={error} />
        <fieldset disabled={auto} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="FECHA"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={`${inputCls} ${bad("date")}`} /></Field>
            <Field label="TIPO">
              <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={`${selectCls} ${bad("type")}`}>
                {[...new Set([...tipos, f.type])].filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="DETALLE"><input value={f.detail} maxLength={120} onChange={(e) => setF({ ...f, detail: e.target.value })} placeholder="Ej: luz de la cocina" className={`${inputCls} ${bad("detail")}`} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="MONTO ($)">
              <input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad("amount")}`} />
            </Field>
            <Field label="MEDIO">
              <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={`${selectCls} ${bad("method")}`}>
                {f.method === "packs" && <option value="packs">Packs</option>}
                {MEDIOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-body cursor-pointer">
            <input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} className="accent-accent" />
            Ya está pagado (si no, no cuenta en la caja del mes)
          </label>
        </fieldset>
      </form>
    </FormPanel>
  );
}
