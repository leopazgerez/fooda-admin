"use client";

import { useState } from "react";
import { ApiErrorBanner, Field, FormPanel, btnPrimary, btnSecondary, inputCls, selectCls } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Gasto, MedioPago } from "@/lib/apiTypes";
import { toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { MEDIOS } from "../ventas/VentaPanel";

const badField = "!border-danger ring-2 ring-danger/20";

/** Alta o edición de un gasto. Los generados automáticamente (compra o pago con packs) se muestran en solo lectura. */
export default function GastoPanel({ gasto, tipos, onClose }: { gasto: Gasto | null; tipos: string[]; onClose: () => void }) {
  const auto = !!gasto?.origen;
  const [f, setF] = useState({
    fecha: gasto?.fecha ?? toLocalISODate(), tipo: gasto?.tipo ?? tipos[0] ?? "", detalle: gasto?.detalle ?? "",
    monto: gasto?.monto ?? 0, medio: gasto?.medio ?? ("transferencia" as MedioPago), pagado: gasto?.pagado ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? badField : "");

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy || auto) return;
    const body: Record<string, unknown> = gasto
      ? Object.fromEntries(Object.entries({ ...f, detalle: f.detalle.trim() }).filter(([k, v]) => v !== gasto[k as keyof Gasto]))
      : { ...f, detalle: f.detalle.trim() };
    if (gasto && !Object.keys(body).length) return onClose();
    setError(null);
    setBusy(true);
    try {
      if (gasto) await api.patch(`/gastos/${gasto.id}`, body, { silent: true, success: "Gasto actualizado." });
      else await api.post("/gastos", body, { silent: true, success: `Gasto de ${money(f.monto)} registrado.` });
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
        <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button type="submit" form="gasto-form" disabled={busy || !f.detalle.trim() || f.monto <= 0} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
      </>}>
      <form id="gasto-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        {auto && (
          <p className="p-3 bg-surface-alt border border-border-subtle rounded-xs text-xs text-text-secondary">
            Se generó automáticamente desde {gasto?.origen?.compraId ? "una compra" : "un pago con packs"}. Para cambiarlo, corregí el registro de origen.
          </p>
        )}
        <ApiErrorBanner error={error} />
        <fieldset disabled={auto} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="FECHA"><input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} className={`${inputCls} ${bad("fecha")}`} /></Field>
            <Field label="TIPO">
              <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className={selectCls}>
                {[...new Set([...tipos, f.tipo])].filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="DETALLE"><input value={f.detalle} maxLength={120} onChange={(e) => setF({ ...f, detalle: e.target.value })} placeholder="Ej: luz de la cocina" className={`${inputCls} ${bad("detalle")}`} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="MONTO ($)">
              <input type="number" min={0} value={f.monto} onChange={(e) => setF({ ...f, monto: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad("monto")}`} />
            </Field>
            <Field label="MEDIO">
              <select value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value as MedioPago })} className={`${selectCls} ${bad("medio")}`}>
                {f.medio === "packs" && <option value="packs">Packs</option>}
                {MEDIOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-body cursor-pointer">
            <input type="checkbox" checked={f.pagado} onChange={(e) => setF({ ...f, pagado: e.target.checked })} className="accent-accent" />
            Ya está pagado (si no, no cuenta en la caja del mes)
          </label>
        </fieldset>
      </form>
    </FormPanel>
  );
}
