"use client";

import { useState } from "react";
import { CircleDollarSign, Package, Repeat, ShoppingCart, TrendingUp } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { ApiErrorBanner, Card, CardHead, ListTable, PageHead, Segmented, Stat, Tag, btnPrimary, btnSecondary, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { BranchResponse, CustomerResponse, SaleResponse as VentaVista, SettingsResponse, StockResponse } from "@/lib/api.gen";
import { MEDIO_PAGO, TIPO_VENTA, etiqueta } from "@/lib/etiquetas";
import { formatDate, toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource, useOptions, useReloadOnWrite } from "@/lib/useApi";
import PagoPacksPanel from "./PagoPacksPanel";
import VentaPanel from "./VentaPanel";
import { AnimatePresence } from "motion/react";

const TODAS = "TODAS";
const sum = (vs: VentaVista[], k: "total" | "packs" | "profit") => vs.reduce((a, v) => a + v[k], 0);

const columnas: Columna<VentaVista>[] = [
  { key: "fecha", header: "FECHA", className: "font-mono whitespace-nowrap", render: (v) => <>
    <span className="text-text-secondary">{formatDate(v.date)}</span>
    <span className="block text-[10px] text-text-muted font-body">{v.branch}</span>
  </> },
  { key: "cliente", header: "CLIENTE", render: (v) => v.type === "paid_with_packs" || v.type === "internal_use" ? <>
    <Tag>{etiqueta(TIPO_VENTA, v.type)}</Tag>
    {v.notes && <span className="block mt-0.5 text-[11px] text-text-secondary">{v.notes}</span>}
  </> : <>
    <span className="text-brand-dark">{v.customer ?? "—"}</span>
    {v.type !== "retail" && <span className="ml-1"><Tag>{etiqueta(TIPO_VENTA, v.type)}</Tag></span>}
  </> },
  { key: "packs", header: "PACKS", hideBelow: "md", className: "text-text-secondary",
    render: (v) => <span className="line-clamp-2">{v.lines.map((l) => `${l.quantity} × ${l.pack} (${l.lot})`).join(", ")}</span> },
  { key: "total", header: "TOTAL", align: "right", className: "font-mono whitespace-nowrap", render: (v) => (v.total ? money(v.total) : "—") },
  { key: "medio", header: "MEDIO", hideBelow: "sm", className: "text-text-secondary whitespace-nowrap",
    render: (v) => etiqueta(MEDIO_PAGO, v.method) },
  { key: "ganancia", header: "GANANCIA", align: "right", render: (v) =>
    <span className={`font-mono ${v.profit < 0 ? "text-danger" : "text-success"}`}>{money(Math.round(v.profit))}</span> },
];

export default function VentasPage() {
  const [sede, setSede] = useState(TODAS);
  const [panel, setPanel] = useState<"venta" | "packs" | null>(null);
  const { data, error, reload } = useApiResource(() => Promise.all([
    api.getAll<VentaVista>("/sales"),
    api.getOne<StockResponse>("/stock"),
    api.getOne<SettingsResponse>("/settings"),
    api.getAll<CustomerResponse>("/customers"),
  ]), []);
  useReloadOnWrite(reload);
  const { options: sedes } = useOptions<BranchResponse>("/branches");

  const [ventas, stock, parametros, clientes] = data ?? [[], { rows: [], byBranch: [] }, null, []];
  const mes = toLocalISODate().slice(0, 7);
  const delMes = ventas.filter((v) => v.date.startsWith(mes));
  const rows = ventas.filter((v) => sede === TODAS || v.branch === sede);

  return (
    <>
      <Topbar section="Venta" title="Ventas" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Ventas" subtitle="Toda venta se cobra completa antes de entregarse. Los pagos con packs descuentan stock sin mover la caja"
          right={<div className="flex gap-2">
            <button type="button" onClick={() => setPanel("packs")} className={btnSecondary}><Repeat className="w-3.5 h-3.5" /> Pagar con packs</button>
            <button type="button" onClick={() => setPanel("venta")} className={btnPrimary}><ShoppingCart className="w-3.5 h-3.5" /> Nueva venta</button>
          </div>} />
        <ApiErrorBanner error={error} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="VENTAS DEL MES" icon={<CircleDollarSign className="w-3.5 h-3.5" />} value={money(sum(delMes, "total"))}
            foot={`${delMes.filter((v) => v.total > 0).length} ventas cobradas`} />
          <Stat label="PACKS DEL MES" icon={<Package className="w-3.5 h-3.5" />} value={String(sum(delMes, "packs"))} unit="packs"
            foot="incluye pagos con packs y uso interno" />
          <Stat label="GANANCIA DEL MES" icon={<TrendingUp className="w-3.5 h-3.5" />} value={money(Math.round(sum(delMes, "profit")))}
            foot="precio − descuento − costo real − envío" />
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="VENTAS" caption="Con el lote de cada pack y la ganancia real"
            right={<Segmented options={[TODAS, ...sedes.map((s) => s.name)]} value={sede} onChange={setSede} />} />
          <ListTable rows={rows} rowKey={(v) => v.id} columns={columnas} empty="Sin ventas con este filtro." footer={`${rows.length} ventas`} />
        </Card>
      </main>
      <AnimatePresence>{panel === "venta" && <VentaPanel sedes={sedes} filas={stock.rows} clientes={clientes} parametros={parametros} onClose={() => setPanel(null)} />}</AnimatePresence>
      <AnimatePresence>{panel === "packs" && <PagoPacksPanel sedes={sedes} filas={stock.rows} parametros={parametros} onClose={() => setPanel(null)} />}</AnimatePresence>
    </>
  );
}
