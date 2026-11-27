"use client";

import { useState } from "react";
import { ApiErrorBanner, BotonBaja, FormPanel, btnSecondary } from "@/components/ui";
import { api } from "@/lib/api";
import type { SaleResponse as VentaVista } from "@/lib/api.gen";
import { formatDate } from "@/lib/dateUtils";
import { MEDIO_PAGO, TIPO_VENTA, etiqueta } from "@/lib/etiquetas";
import { money } from "@/lib/format";

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-border-faint text-xs">
      <span className="text-text-label font-bold tracking-[0.275px]">{label}</span>
      <span className="text-right text-text-body">{children}</span>
    </div>
  );
}

/** Venta en solo lectura, con la opción de anularla (los packs vuelven al stock). */
export default function VentaDetalle({ venta: v, onClose }: { venta: VentaVista; onClose: () => void }) {
  const [error, setError] = useState<unknown>(null);
  return (
    <FormPanel title={`Venta del ${formatDate(v.date)}`} onClose={onClose} footer={<>
      <BotonBaja label="Anular venta" title="¿Anular esta venta?" confirmLabel="Anular venta"
        description="Los packs vuelven al stock y la venta deja de contar en ventas y ganancia."
        onHecho={onClose} onError={setError}
        accion={() => api.del(`/sales/${v.id}`, { silent: true, success: "Venta anulada." })} />
      <button type="button" onClick={onClose} className={btnSecondary}>Cerrar</button>
    </>}>
      <div className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <div>
          <Dato label="SEDE">{v.branch}</Dato>
          <Dato label="CLIENTE">{v.customer ?? "—"}</Dato>
          <Dato label="TIPO">{etiqueta(TIPO_VENTA, v.type)}</Dato>
          {v.reason && <Dato label="MOTIVO">{v.reason}</Dato>}
          <Dato label="MEDIO">{etiqueta(MEDIO_PAGO, v.method)}</Dato>
        </div>
        <div>
          <p className="text-[11px] font-bold tracking-[0.275px] text-text-label mb-1">PACKS</p>
          {v.lines.map((l, i) => (
            <Dato key={i} label={`${l.quantity} × ${l.pack}`}>
              <span className="font-mono">{l.lot}{l.unitPrice ? ` · ${money(l.unitPrice)}` : ""}</span>
            </Dato>
          ))}
        </div>
        <div className="font-mono">
          {!!v.discount && <Dato label="DESCUENTO">{money(v.discount)}</Dato>}
          {!!v.shipping && <Dato label="ENVÍO">{money(v.shipping)}</Dato>}
          <Dato label="TOTAL">{v.total ? money(v.total) : "—"}</Dato>
          <Dato label="GANANCIA"><span className={v.profit < 0 ? "text-danger" : "text-success"}>{money(Math.round(v.profit))}</span></Dato>
        </div>
        {v.notes && <p className="text-xs text-text-secondary whitespace-pre-line">{v.notes}</p>}
      </div>
    </FormPanel>
  );
}
