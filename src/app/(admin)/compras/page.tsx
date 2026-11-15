"use client";

import { useState } from "react";
import { Box, ListChecks, ShoppingCart, Wallet } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { ApiErrorBanner, Card, CardHead, ListTable, PageHead, Segmented, Stat, Tag, btnPrimary, btnSecondary, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { CompraVista, Envases, InsumoOpcion, ProveedorOpcion } from "@/lib/apiTypes";
import { formatDate, toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource, useOptions, useReloadOnWrite } from "@/lib/useApi";
import CompraPanel from "./CompraPanel";
import { AnimatePresence } from "motion/react";

const FILTROS = ["POR COMPRAR", "COMPRADAS", "TODAS"] as const;

export default function ComprasPage() {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("POR COMPRAR");
  // undefined = cerrado; null = compra suelta; compra = registrar esa lista
  const [abierta, setAbierta] = useState<CompraVista | null | undefined>(undefined);
  const { data, error, reload } = useApiResource(
    () => Promise.all([api.getAll<CompraVista>("/compras", { sortBy: "id", sortDir: "desc" }), api.getOne<Envases>("/envases")]), []);
  useReloadOnWrite(reload);
  const { options: proveedores } = useOptions<ProveedorOpcion>("/proveedores");
  const { options: insumos } = useOptions<InsumoOpcion>("/insumos");

  const [compras, envases] = data ?? [[], null];
  const mes = toLocalISODate().slice(0, 7);
  const porComprar = compras.filter((c) => c.estado === "pendiente");
  const delMes = compras.filter((c) => c.estado === "comprada" && c.fecha?.startsWith(mes));
  const rows = filtro === "TODAS" ? compras : compras.filter((c) => (c.estado === "pendiente") === (filtro === "POR COMPRAR"));

  const columnas: Columna<CompraVista>[] = [
    { key: "proveedor", header: "PROVEEDOR", className: "font-bold text-brand-dark", render: (c) => c.proveedor },
    { key: "produccion", header: "PRODUCCIÓN", className: "font-mono text-text-secondary whitespace-nowrap", render: (c) => c.produccion ?? "Suelta" },
    { key: "items", header: "ÍTEMS", hideBelow: "md", className: "text-text-secondary",
      render: (c) => <span className="line-clamp-2">{c.lineas.map((l) => l.insumo).join(", ")}</span> },
    { key: "total", header: "TOTAL", align: "right", className: "font-mono font-bold text-brand-dark whitespace-nowrap",
      render: (c) => <>{money(c.total)}{c.estado === "pendiente" && <span className="block text-[10px] font-normal text-text-muted">estimado</span>}</> },
    { key: "estado", header: "ESTADO", align: "center", className: "whitespace-nowrap", render: (c) => c.estado === "comprada" ? (
      <span className="inline-flex flex-col items-center gap-0.5">
        <Tag tone="solid">Comprada</Tag>
        {c.fecha && <span className="text-[10px] text-text-muted font-mono">{formatDate(c.fecha)}</span>}
      </span>
    ) : (
      <button type="button" onClick={() => setAbierta(c)} className={`${btnPrimary} py-1 text-[11px]`}>
        <ShoppingCart className="w-3 h-3" /> Registrar compra
      </button>
    ) },
  ];

  return (
    <>
      <Topbar section="Operaciones" title="Compras" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Compras" subtitle="Listas por proveedor para salir a comprar: al cargar lo pagado queda registrada y pasa a gastos"
          right={<button type="button" onClick={() => setAbierta(null)} className={btnSecondary}><ShoppingCart className="w-3.5 h-3.5" /> Compra suelta</button>} />
        <ApiErrorBanner error={error} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="POR COMPRAR" icon={<ListChecks className="w-3.5 h-3.5" />} value={String(porComprar.length)} unit="listas"
            foot={<span className="font-mono">{money(porComprar.reduce((a, c) => a + c.total, 0))} estimado</span>} />
          <Stat label="COMPRADO EN EL MES" icon={<Wallet className="w-3.5 h-3.5" />} value={money(delMes.reduce((a, c) => a + c.total, 0))}
            foot={`${delMes.length} compras registradas`} />
          <Stat label="ENVASES" icon={<Box className="w-3.5 h-3.5" />}
            value={envases ? `${envases.bandeja.stock} / ${envases.sticker.stock}` : "—"} unit="bandejas / stickers"
            foot={envases && (envases.bandeja.alcanza && envases.sticker.alcanza
              ? "Alcanzan para la próxima producción"
              : <span className="text-danger">No alcanzan para la próxima producción</span>)} />
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="LISTAS DE COMPRA" caption="Se generan al planificar una producción, una por proveedor"
            right={<Segmented options={FILTROS} value={filtro} onChange={setFiltro} />} />
          <ListTable rows={rows} rowKey={(c) => c.id} columns={columnas}
            empty={filtro === "POR COMPRAR" ? "No hay nada por comprar. Las listas aparecen al planificar una producción." : "Sin compras con este filtro."}
            footer={`${rows.length} listas · al registrar se actualizan los precios, el costo real de la producción y los gastos`} />
        </Card>
      </main>
      <AnimatePresence>{abierta !== undefined && <CompraPanel compra={abierta} proveedores={proveedores} insumos={insumos} onClose={() => setAbierta(undefined)} />}</AnimatePresence>
    </>
  );
}
