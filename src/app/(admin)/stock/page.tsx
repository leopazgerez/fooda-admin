"use client";

import { useState } from "react";
import { Send, SlidersHorizontal } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { ApiErrorBanner, BotonBaja, Card, CardHead, ListTable, PageHead, Segmented, Stat, Tag, btnPrimary, btnSecondary, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { BranchResponse, PackResponse as PackVista, StockResponse as StockVista, StockRow as FilaStock, TransferResponse as TrasladoVista } from "@/lib/api.gen";
import { formatDate } from "@/lib/dateUtils";
import { ALERTA_SEDE, etiqueta } from "@/lib/etiquetas";
import { useApiResource, useOptions, useReloadOnWrite } from "@/lib/useApi";
import { AjustePanel, DespachoPanel } from "./StockPanels";
import { AnimatePresence } from "motion/react";

const TODAS = "TODAS";

const colStock: Columna<FilaStock>[] = [
  { key: "lote", header: "LOTE", className: "font-mono whitespace-nowrap", render: (f) => <>
    <span className="font-bold text-brand-dark">{f.lot}</span>
    {f.lotDate && <span className="block text-[10px] text-text-muted">{formatDate(f.lotDate)}</span>}
  </> },
  { key: "sede", header: "SEDE", render: (f) => <Tag>{f.branch}</Tag> },
  { key: "pack", header: "PACK", className: "text-brand-dark", render: (f) => f.pack },
  { key: "packs", header: "PACKS", align: "right", className: "font-mono font-bold", render: (f) => f.quantity },
];

const colTraslados: Columna<TrasladoVista>[] = [
  { key: "fecha", header: "FECHA", className: "font-mono whitespace-nowrap text-text-secondary", render: (t) => formatDate(t.date) },
  { key: "ruta", header: "RUTA", className: "whitespace-nowrap text-brand-dark", render: (t) => `${t.origin} → ${t.destination}` },
  { key: "detalle", header: "DETALLE", hideBelow: "md", className: "text-text-secondary", render: (t) => <>
    <span className="line-clamp-2">{t.lines.map((l) => `${l.quantity} × ${l.pack} (${l.lot})`).join(", ")}</span>
    {t.notes && <span className="block text-[11px] text-text-muted">{t.notes}</span>}
  </> },
  { key: "packs", header: "PACKS", align: "right", className: "font-mono font-bold", render: (t) => t.packs },
  { key: "anular", header: "", align: "right", render: (t) => <BotonBaja label="Anular" title="¿Anular este traslado?" confirmLabel="Anular traslado"
    description="Los packs vuelven a la sede de origen." className={`${btnSecondary} py-0.5 px-2 text-[11px] text-danger`}
    accion={() => api.del(`/transfers/${t.id}`, { success: "Traslado anulado." })} /> },
];

export default function StockPage() {
  const [sede, setSede] = useState(TODAS);
  const [panel, setPanel] = useState<"despacho" | "ajuste" | null>(null);
  const { data, error, reload } = useApiResource(() => Promise.all([
    api.getOne<StockVista>("/stock"),
    api.getAll<TrasladoVista>("/transfers"),
    api.getOne<PackVista[]>("/packs"),
  ]), []);
  useReloadOnWrite(reload);
  const { options: sedes } = useOptions<BranchResponse>("/branches");

  const [stock, traslados, packs] = data ?? [{ rows: [], byBranch: [] }, [], []];
  const filas = sede === TODAS ? stock.rows : stock.rows.filter((f) => f.branch === sede);
  const movidos = sede === TODAS ? traslados : traslados.filter((t) => t.origin === sede || t.destination === sede);

  return (
    <>
      <Topbar section="Operación" title="Inventario y traslados" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Inventario y traslados" subtitle="Stock por sede y lote. Un despacho mueve el stock en el momento: no hay tránsito ni recepción"
          right={<div className="flex gap-2">
            <button type="button" onClick={() => setPanel("ajuste")} className={btnSecondary}><SlidersHorizontal className="w-3.5 h-3.5" /> Ajustar stock</button>
            <button type="button" onClick={() => setPanel("despacho")} className={btnPrimary}><Send className="w-3.5 h-3.5" /> Despachar</button>
          </div>} />
        <ApiErrorBanner error={error} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stock.byBranch.map((s) => (
            <Stat key={s.branchId} label={`STOCK ${s.branch.toUpperCase()}`} value={String(s.total)} unit="packs"
              tag={s.alerts.length ? <span className="flex gap-1">
                {s.alerts.map((a) => <Tag key={a} tone={a.toLowerCase() === "low_stock" ? "danger" : "warning"}>{etiqueta(ALERTA_SEDE, a.toLowerCase())}</Tag>)}
              </span> : undefined}
              foot={<span className="font-mono">capacidad {s.capacity} · {s.freeSlots} lugares libres</span>} />
          ))}
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="STOCK POR LOTE" caption="Del lote más viejo al más nuevo: vendé primero los de arriba"
            right={<Segmented options={[TODAS, ...stock.byBranch.map((s) => s.branch)]} value={sede} onChange={setSede} />} />
          <ListTable rows={filas} rowKey={(f) => `${f.branchId}|${f.productionId}|${f.packId}`} columns={colStock} empty="Sin stock."
            footer={`${filas.reduce((a, f) => a + f.quantity, 0)} packs en ${filas.length} lotes`} />
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="TRASLADOS" caption="Los del reparto se crean solos al cerrar una producción" />
          <ListTable rows={movidos} rowKey={(t) => t.id} columns={colTraslados} empty="Sin traslados." footer={`${movidos.length} traslados`} />
        </Card>
      </main>
      <AnimatePresence>{panel === "despacho" && <DespachoPanel sedes={sedes} filas={stock.rows} onClose={() => setPanel(null)} />}</AnimatePresence>
      <AnimatePresence>{panel === "ajuste" && <AjustePanel sedes={sedes} packs={packs} filas={stock.rows} onClose={() => setPanel(null)} />}</AnimatePresence>
    </>
  );
}
