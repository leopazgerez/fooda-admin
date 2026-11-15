"use client";

import Link from "next/link";
import { Boxes, ChefHat, Plus, ShoppingCart, Store, TrendingUp, Truck, Wallet } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { ApiErrorBanner, Card, CardHead, ListTable, PageHead, Stat, Tag, btnPrimary, btnSecondary, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { DashboardVista, ProduccionResumen, StockSede } from "@/lib/apiTypes";
import { formatDate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";

const pct = (n: number) => `${Math.round(n * 100)} %`;
type FilaVentas = DashboardVista["ventasPorPack"][number];

const colStock: Columna<StockSede>[] = [
  { key: "sede", header: "SEDE", className: "font-semibold text-brand-dark whitespace-nowrap", render: (s) => s.sede },
  { key: "total", header: "PACKS", align: "right", className: "font-mono", render: (s) => s.total },
  { key: "cap", header: "CAPACIDAD", align: "right", hideBelow: "sm", className: "font-mono text-text-secondary", render: (s) => s.capacidad },
  { key: "libres", header: "LUGARES LIBRES", align: "right", hideBelow: "sm", className: "font-mono", render: (s) => s.lugaresLibres },
  { key: "alertas", header: "", align: "right", render: (s) => <span className="inline-flex gap-1">
    {s.alertas.includes("stock_bajo") && <Tag tone="danger">Stock bajo</Tag>}
    {s.alertas.includes("lugar_libre") && <Tag tone="warning">Hay lugar</Tag>}
    {!s.alertas.length && <Tag tone="success">OK</Tag>}
  </span> },
];

const colProducciones: Columna<ProduccionResumen>[] = [
  { key: "codigo", header: "LOTE", className: "font-semibold text-brand-dark whitespace-nowrap", render: (p) => <>
    {p.codigo}{p.estado === "planificada" && <span className="ml-1"><Tag tone="warning">Planificada</Tag></span>}
  </> },
  { key: "fecha", header: "FECHA", hideBelow: "sm", className: "font-mono text-text-secondary whitespace-nowrap", render: (p) => formatDate(p.cierre ?? p.inicio) },
  { key: "packs", header: "PACKS", align: "right", className: "font-mono", render: (p) => p.packs },
  { key: "vendidos", header: "VENDIDOS", align: "right", className: "font-mono whitespace-nowrap", render: (p) => `${p.vendidos} · ${pct(p.pctVendido)}` },
  { key: "costo", header: "COSTO REAL", align: "right", hideBelow: "md", className: "font-mono", render: (p) => money(Math.round(p.costoReal)) },
];

export default function DashboardPage() {
  const { data, error, reload } = useApiResource(() => api.getOne<DashboardVista>("/dashboard"), []);
  useReloadOnWrite(reload);
  const d = data;
  const mes = d?.mes;
  const stock = d?.stockPorSede ?? [];
  const sedes = d?.ventasPorPack[0]?.porSede ?? [];
  const avisos = d?.avisos;
  const variacion = d && d.ventasMesAnteriorMismoPeriodo ? mes!.ventas / d.ventasMesAnteriorMismoPeriodo - 1 : null;

  const colVentas: Columna<FilaVentas>[] = [
    { key: "pack", header: "PACK", className: "font-semibold text-brand-dark whitespace-nowrap", render: (v) => v.pack },
    ...sedes.map((s, i): Columna<FilaVentas> => ({ key: `s${s.sedeId}`, header: s.sede.toUpperCase(), align: "right", hideBelow: "sm",
      className: "font-mono text-text-secondary", render: (v) => v.porSede[i]?.cantidad ?? 0 })),
    { key: "cant", header: "PACKS", align: "right", className: "font-mono", render: (v) => v.cantidad },
    { key: "monto", header: "FACTURADO", align: "right", className: "font-mono", render: (v) => money(v.monto) },
  ];

  const lineasAviso = avisos ? [
    // una línea por lote: "Lote 2 NOV 26 · 8 proveedores: Súper, Pollo, …"
    ...Object.entries(Object.groupBy(avisos.comprasPendientes, (c) => c.produccion ?? "")).map(([lote, cs = []]) => ({
      k: `c${lote}`, tone: "warning" as const, tag: cs.length > 1 ? `${cs.length} compras pendientes` : "Compra pendiente",
      texto: `${lote ? `Lote ${lote} · ` : ""}${cs.map((c) => c.proveedor).join(", ")}`, href: "/compras" })),
    ...avisos.envasesBajos.map((e) => ({ k: `e${e.tipo}`, tone: "danger" as const, tag: "Envases",
      texto: `${e.tipo === "bandeja" ? "Bandejas" : "Stickers"}: quedan ${e.stock}, la próxima producción usa ${e.necesidad}`, href: "/compras" })),
    ...avisos.cumpleanos.map((c) => ({ k: `b${c.clienteId}`, tone: "info" as const, tag: "Cumpleaños",
      texto: `${c.cliente}${c.telefono ? ` · ${c.telefono}` : ""}`, href: "/clientes" })),
    ...avisos.recontactos.map((r) => ({ k: `r${r.clienteId}`, tone: "neutral" as const, tag: "Recontactar",
      texto: `${r.cliente} · ${r.diasSinComprar} días sin comprar · ${r.packs.join(", ")}`, href: "/clientes" })),
  ] : [];

  return (
    <>
      <Topbar section="Visión general" title="Dashboard" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Dashboard" subtitle={d ? `Mes en curso al ${formatDate(d.hoy)}` : "Mes en curso"}
          right={<div className="flex flex-wrap gap-2">
            <Link href="/ventas" className={btnSecondary}><Store className="w-3.5 h-3.5" /> Nueva venta</Link>
            <Link href="/stock" className={btnSecondary}><Truck className="w-3.5 h-3.5" /> Despachar</Link>
            <Link href="/produccion" className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Planificar producción</Link>
          </div>} />
        <ApiErrorBanner error={error} />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Stat label="VENTAS DEL MES" icon={<ShoppingCart className="w-3.5 h-3.5" />} value={money(mes?.ventas ?? 0)}
            foot={variacion === null ? `${mes?.vendidos ?? 0} packs vendidos`
              : <span className={variacion < 0 ? "text-danger" : "text-success"}>{variacion < 0 ? "▼" : "▲"} {pct(Math.abs(variacion))} vs mismo período del mes anterior</span>} />
          <Stat label="GANANCIA DEL MES" icon={<TrendingUp className="w-3.5 h-3.5" />} value={money(Math.round(mes?.ganancia ?? 0))}
            foot={`${mes?.gananciaEnPacks ?? 0} packs · costo real descontado`} />
          <Stat label="CAJA DEL MES" icon={<Wallet className="w-3.5 h-3.5" />} value={money(mes?.resultadoCaja ?? 0)}
            foot={`cobrado − ${money(mes?.gastosPagados ?? 0)} de gastos`} />
          <Stat label="PACKS EN STOCK" icon={<Boxes className="w-3.5 h-3.5" />} value={String(stock.reduce((a, s) => a + s.total, 0))}
            foot={stock.map((s) => `${s.sede} ${s.total}`).join(" · ")} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="p-4 flex flex-col gap-3">
            <CardHead title="STOCK POR SEDE" caption="Umbrales configurables en Ajustes › Sedes" />
            <ListTable rows={stock} rowKey={(s) => s.sedeId} columns={colStock} empty="Sin sedes." />
          </Card>
          <Card className="p-4 flex flex-col gap-3">
            <CardHead title="AVISOS" caption="Lo que conviene resolver hoy" />
            {lineasAviso.length ? (
              <ul className="flex flex-col divide-y divide-border-faint">
                {lineasAviso.map((a) => (
                  <li key={a.k}><Link href={a.href} className="flex items-center gap-2 py-2 text-sm text-text-body hover:text-text-primary">
                    <Tag tone={a.tone}>{a.tag}</Tag><span className="min-w-0 truncate">{a.texto}</span>
                  </Link></li>
                ))}
              </ul>
            ) : <p className="text-xs text-text-muted">Nada pendiente.</p>}
          </Card>
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="VENTAS POR PACK" caption="Mes en curso, sin uso interno ni pagos con packs" />
          <ListTable rows={d?.ventasPorPack ?? []} rowKey={(v) => v.packId} columns={colVentas} empty="Sin ventas este mes."
            footer={`${mes?.vendidos ?? 0} packs · ${money(mes?.ventas ?? 0)}`} />
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="ÚLTIMAS PRODUCCIONES" icon={<ChefHat className="w-3.5 h-3.5" />}
            caption={d?.recupero ? (d.recupero.faltan
              ? `Lote ${d.recupero.codigo}: faltan vender ${d.recupero.faltan} de ${d.recupero.necesarios} packs para recuperar el costo`
              : `Lote ${d.recupero.codigo}: costo recuperado`) : undefined} />
          <ListTable rows={d?.producciones ?? []} rowKey={(p) => p.id} columns={colProducciones} empty="Sin producciones." />
        </Card>
      </main>
    </>
  );
}
