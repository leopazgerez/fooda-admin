"use client";

import { useState } from "react";
import { Box, Copy, FileDown, ListChecks, ShoppingCart, Wallet } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { ApiErrorBanner, BotonBaja, Card, CardHead, ListTable, PageHead, Segmented, Stat, Tag, btnPrimary, btnSecondary, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { DetailResponse, PackagingStatus as Envases, PurchaseResponse as CompraVista, ShoppingGroupResponse, Supplier, SupplyResponse } from "@/lib/api.gen";
import { formatDate, toLocalISODate } from "@/lib/dateUtils";
import { ESTADO_COMPRA, etiqueta } from "@/lib/etiquetas";
import { feedback } from "@/lib/feedback";
import { money } from "@/lib/format";
import { armarLista, cargarPorId, grupoDeCompra, nombreArchivo, type ListaSuper } from "@/lib/listaSuper";
import { copiarLista, descargarPdf } from "@/lib/listaSuperSalida";
import { useApiResource, useOptions, useReloadOnWrite } from "@/lib/useApi";
import CompraPanel from "./CompraPanel";
import { AnimatePresence } from "motion/react";

const FILTROS = ["POR COMPRAR", "COMPRADAS", "TODAS"] as const;

export default function ComprasPage() {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("POR COMPRAR");
  // undefined = cerrado; null = compra suelta; compra = registrar esa lista
  const [abierta, setAbierta] = useState<CompraVista | null | undefined>(undefined);
  const { data, error, reload } = useApiResource(
    () => Promise.all([api.getAll<CompraVista>("/purchases"), api.getOne<Envases>("/packaging")]), []);
  useReloadOnWrite(reload);
  const { options: proveedores } = useOptions<Supplier>("/suppliers");
  const { options: insumos } = useOptions<SupplyResponse>("/supplies");

  const [compras, envases] = data ?? [[], null];
  const mes = toLocalISODate().slice(0, 7);
  const porComprar = compras.filter((c) => c.status === "pending");
  // listas precargadas: copiar en iOS tiene que correr en el mismo toque, sin esperar la red
  const ids = [...new Set(porComprar.flatMap((c) => (c.productionId === null ? [] : [c.productionId])))].sort((a, b) => a - b);
  // solo las producciones con compras pendientes (código y fecha para el encabezado + su lista)
  const { data: listas, reload: recargarListas } = useApiResource(() => cargarPorId(ids, (id) => Promise.all([
    api.getOne<DetailResponse>(`/productions/${id}`, undefined, { quiet: true }),
    api.getOne<ShoppingGroupResponse[]>(`/productions/${id}/shopping-list`, undefined, { quiet: true }),
  ])), [ids]);
  useReloadOnWrite(recargarListas);
  const listaDe = (c: CompraVista): EstadoLista => {
    const cargada = c.productionId === null ? undefined : listas?.get(c.productionId);
    if (cargada === undefined) return "cargando";
    if (cargada === null) return "error";
    const [prod, grupos] = cargada;
    const grupo = grupoDeCompra(grupos, c);
    return grupo ? { lista: armarLista(grupo, prod), archivo: nombreArchivo(grupo.supplier, prod.code) } : "sin-lista";
  };
  const delMes = compras.filter((c) => c.status === "bought" && c.date?.startsWith(mes));
  const rows = filtro === "TODAS" ? compras : compras.filter((c) => (c.status === "pending") === (filtro === "POR COMPRAR"));

  const columnas: Columna<CompraVista>[] = [
    { key: "proveedor", header: "PROVEEDOR", className: "font-bold text-brand-dark", render: (c) => c.supplier },
    { key: "produccion", header: "PRODUCCIÓN", className: "font-mono text-text-secondary whitespace-nowrap", render: (c) => c.production ?? "Suelta" },
    { key: "items", header: "ÍTEMS", hideBelow: "md", className: "text-text-secondary",
      render: (c) => <span className="line-clamp-2">{c.lines.map((l) => l.supply).join(", ")}</span> },
    { key: "total", header: "TOTAL", align: "right", className: "font-mono font-bold text-brand-dark whitespace-nowrap",
      render: (c) => <>{money(c.total)}{c.status === "pending" && <span className="block text-[10px] font-normal text-text-muted">estimado</span>}</> },
    { key: "estado", header: "ESTADO", align: "center", className: "whitespace-nowrap", render: (c) => c.status === "bought" ? (
      <span className="inline-flex flex-col items-center gap-0.5">
        <Tag tone="solid">{etiqueta(ESTADO_COMPRA, c.status)}</Tag>
        {c.date && <span className="text-[10px] text-text-muted font-mono">{formatDate(c.date)}</span>}
        <BotonBaja label="Anular" title="¿Anular esta compra?" confirmLabel="Anular compra" className={`${btnSecondary} py-0.5 px-2 text-[11px] text-danger`}
          description={c.productionId === null ? "Se borra la compra y su gasto." : "Se borra su gasto y la lista vuelve a Por comprar."}
          accion={() => api.del(`/purchases/${c.id}`, { success: "Compra anulada." })} />
      </span>
    ) : (
      <span className="inline-flex flex-nowrap items-center justify-center gap-1">
        {c.productionId !== null && <BotonesLista l={listaDe(c)} onReintentar={recargarListas} />}
        <button type="button" onClick={() => setAbierta(c)} className={`${btnPrimary} py-1 text-[11px]`}>
          <ShoppingCart className="w-3 h-3" /> Registrar compra
        </button>
      </span>
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
            value={envases ? `${envases.tray.stock} / ${envases.sticker.stock}` : "—"} unit="bandejas / stickers"
            foot={envases && (envases.tray.enough && envases.sticker.enough
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

type EstadoLista = "cargando" | "error" | "sin-lista" | { lista: ListaSuper; archivo: string };
const AYUDA = { cargando: "Cargando lista…", error: "No se pudo cargar la lista", "sin-lista": "Esta compra no tiene lista pendiente" };

/** Copiar o bajar la lista de un proveedor. Si la carga falló, tocar avisa y reintenta. */
function BotonesLista({ l, onReintentar }: { l: EstadoLista; onReintentar: () => void }) {
  const cls = `${btnSecondary} p-1.5`;
  const lista = typeof l === "object" ? l : null;
  const tocar = (accion: (x: { lista: ListaSuper; archivo: string }) => void) => () => {
    if (lista) return accion(lista);
    feedback.error("No se pudo cargar la lista de esta producción. Reintentando…");
    onReintentar();
  };
  const ayuda = lista ? null : AYUDA[l as keyof typeof AYUDA];
  const props = { className: cls, disabled: l === "cargando" || l === "sin-lista" };
  return <>
    <button type="button" {...props} onClick={tocar((x) => copiarLista(x.lista))} aria-label="Copiar lista" title={ayuda ?? "Copiar lista"}>
      <Copy className="w-3.5 h-3.5" />
    </button>
    <button type="button" {...props} onClick={tocar((x) => descargarPdf([x.lista], x.archivo))} aria-label="Descargar PDF" title={ayuda ?? "Descargar PDF"}>
      <FileDown className="w-3.5 h-3.5" />
    </button>
  </>;
}
