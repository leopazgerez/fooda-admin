"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronRight, ClipboardPlus, FileDown, PackageCheck, ShoppingCart } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { ApiErrorBanner, Card, CardHead, ListTable, PageHead, Stat, Tag, btnPrimary, btnSecondary, tdCls, thCls, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { BranchResponse, PackResponse as PackVista, ProductionResponse as ProduccionResumen, ShoppingGroupResponse } from "@/lib/api.gen";
import { formatDate, toLocalISODate } from "@/lib/dateUtils";
import { ESTADO_PRODUCCION, etiqueta } from "@/lib/etiquetas";
import { money } from "@/lib/format";
import { armarLista, nombreArchivo, pendientes } from "@/lib/listaSuper";
import { descargarPdf } from "@/lib/listaSuperSalida";
import { useApiResource, useOptions, useReloadOnWrite } from "@/lib/useApi";
import { CerrarProduccionPanel, NuevaProduccionPanel, RecetarioPanel } from "./ProduccionPanels";
import { AnimatePresence } from "motion/react";

const pct = (n: number) => `${Math.round(n * 100)} %`;

/** Costo del lote: el real (con lo pagado) cuando hay compras registradas; si no, el estimado al planificar. */
const costoLote = (p: ProduccionResumen) => p.actualCost || p.estimatedCost;

export default function ProduccionPage() {
  const [nueva, setNueva] = useState(false);
  const [cerrar, setCerrar] = useState<ProduccionResumen | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [recetario, setRecetario] = useState<ProduccionResumen | null>(null);
  const { data, error, reload } = useApiResource(
    () => Promise.all([api.getAll<ProduccionResumen>("/productions"), api.getOne<PackVista[]>("/packs")]), []);
  useReloadOnWrite(reload);
  const { options: sedes } = useOptions<BranchResponse>("/branches");

  const [producciones, packs] = data ?? [[], []];
  const lotes = producciones.filter((p) => p.packLines.length); // el lote INICIAL (ajuste de stock) no es una producción
  const mes = toLocalISODate().slice(0, 7);
  const delMes = lotes.filter((p) => p.status === "closed" && p.closedOn?.startsWith(mes));
  const enCurso = lotes.filter((p) => p.status === "planned");

  const columnas: Columna<ProduccionResumen>[] = [
    { key: "lote", header: "LOTE", className: "font-mono whitespace-nowrap", render: (p) => <span className="flex items-start gap-1.5">
      <span className="text-text-muted pt-0.5">{abierta === p.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</span>
      <span><b className="block text-brand-dark">{p.code}</b><span className="text-[11px] text-text-secondary">{formatDate(p.closedOn ?? p.start)}</span></span>
    </span> },
    { key: "estado", header: "ESTADO", render: (p) => <Tag tone={p.status === "closed" ? "solid" : "warning"}>{etiqueta(ESTADO_PRODUCCION, p.status)}</Tag> },
    { key: "packs", header: "PACKS", hideBelow: "sm", className: "font-mono font-bold", render: (p) => p.packs },
    { key: "costo", header: "COSTO DEL LOTE", align: "right", className: "font-mono whitespace-nowrap", render: (p) => <>
      <span className="font-bold text-brand-dark">{money(Math.round(costoLote(p)))}</span>
      <span className="block text-[10px] text-text-muted">{p.actualCost !== p.estimatedCost ? `estimado ${money(Math.round(p.estimatedCost))}` : "estimado"}</span>
    </> },
    { key: "cpack", header: "C / PACK", align: "right", hideBelow: "md", className: "font-mono", render: (p) => (p.packs ? money(Math.round(costoLote(p) / p.packs)) : "—") },
    { key: "vendido", header: "VENDIDO", align: "right", hideBelow: "md", className: "font-mono", render: (p) => (p.status === "closed" ? `${p.sold} · ${pct(p.soldRatio)}` : "—") },
    { key: "recupero", header: "RECUPERO", hideBelow: "md", className: "text-[11px]", render: (p) => p.status === "planned" ? "—" : p.payback.missing
      ? <span>faltan <b className="font-mono">{p.payback.missing}</b> de {p.payback.needed}</span> : <Tag tone="success">Recuperado</Tag> },
    { key: "accion", header: "", align: "right", render: (p) => p.status === "planned" && (
      <button type="button" onClick={(e) => { e.stopPropagation(); setCerrar(p); }} className={`${btnSecondary} py-1 text-[11px]`}>Cerrar</button>
    ) },
  ];

  return (
    <>
      <Topbar section="Operación" title="Producción" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Producción" subtitle="Elegís cuántos packs hacer; el costo del lote sale solo de recetas, precios y gastos del mes"
          right={<button type="button" onClick={() => setNueva(true)} className={btnPrimary}><ClipboardPlus className="w-3.5 h-3.5" /> Nueva producción</button>} />
        <ApiErrorBanner error={error} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="PLANIFICADAS" icon={<ShoppingCart className="w-3.5 h-3.5" />} value={String(enCurso.length)}
            foot={<span className="font-mono">{money(Math.round(enCurso.reduce((a, p) => a + costoLote(p), 0)))} a invertir</span>} />
          <Stat label="PACKS PRODUCIDOS EN EL MES" icon={<PackageCheck className="w-3.5 h-3.5" />} value={String(delMes.reduce((a, p) => a + p.packs, 0))}
            unit="packs" foot={`${delMes.length} producciones cerradas`} />
          <Stat label="COSTO DEL MES" value={money(Math.round(delMes.reduce((a, p) => a + p.actualCost, 0)))}
            foot="costo real de lo producido (directo + indirecto)" />
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="PRODUCCIONES" caption="Costo calculado: estimado al planificar, real con lo pagado en compras" />
          <ListTable rows={lotes} rowKey={(p) => p.id} columns={columnas} empty="Todavía no hay producciones."
            onRowClick={(p) => setAbierta(abierta === p.id ? null : p.id)} expand={(p) => (abierta === p.id ? <Detalle p={p} onRecetario={() => setRecetario(p)} /> : null)} />
        </Card>
      </main>
      <AnimatePresence>{nueva && <NuevaProduccionPanel packs={packs} onClose={() => setNueva(false)} />}</AnimatePresence>
      <AnimatePresence>{recetario && <RecetarioPanel produccion={recetario} onClose={() => setRecetario(null)} />}</AnimatePresence>
      <AnimatePresence>{cerrar && <CerrarProduccionPanel produccion={cerrar} sedes={sedes} onClose={() => setCerrar(null)} />}</AnimatePresence>
    </>
  );
}

function Detalle({ p, onRecetario }: { p: ProduccionResumen; onRecetario: () => void }) {
  const ind = p.overhead;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {p.status === "planned" && <BotonListaSuper p={p} />}
        <button type="button" onClick={onRecetario} className={`${btnSecondary} py-1 text-[11px]`}><BookOpen className="w-3 h-3" /> Ver recetario</button>
      </div>
      <table className="w-full">
        <thead><tr>
          {["PACK", "PACKS", "DIRECTO EST.", "DIRECTO REAL", "INDIRECTO", "C / PACK", "SUBTOTAL"].map((h, i) =>
            <th key={h} className={`${thCls} ${i ? "text-right" : ""}`}>{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border-faint font-mono">
          {p.packLines.map((d) => {
            const n = d.actual ?? d.planned;
            return (
              <tr key={d.packId}>
                <td className={`${tdCls} font-body`}>{d.name}</td>
                <td className={`${tdCls} text-right`}>{n}{d.actual !== null && d.actual !== d.planned && <span className="text-text-muted"> / {d.planned}</span>}</td>
                <td className={`${tdCls} text-right`}>{money(Math.round(d.directEstimated))}</td>
                <td className={`${tdCls} text-right`}>{money(Math.round(d.directActual))}</td>
                <td className={`${tdCls} text-right`}>{money(Math.round(ind.value))}</td>
                <td className={`${tdCls} text-right font-bold`}>{money(Math.round(d.costPerPack))}</td>
                <td className={`${tdCls} text-right`}>{money(Math.round(n * d.costPerPack))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] text-text-secondary">
        Directo = recetas + aceite + bandejas y sticker, con los precios congelados al planificar (real: con lo pagado en las compras).
        Indirecto = gastos fijos del mes ÷ packs producidos{ind.reference ? " — todavía sin datos del mes, se usa el valor de referencia" : ind.provisional ? " — provisorio hasta cerrar el mes" : " — mes cerrado"}.
        {p.status === "planned" && <> Las compras de este lote están en <Link href="/compras" className="underline">Compras</Link>.</>}
      </p>
    </div>
  );
}

/** PDF con las listas que faltan comprar (una página por proveedor). Sin pendientes no aparece. */
function BotonListaSuper({ p }: { p: ProduccionResumen }) {
  const { data, reload } = useApiResource(() => api.getOne<ShoppingGroupResponse[]>(`/productions/${p.id}/shopping-list`, undefined, { quiet: true }), [p.id]);
  useReloadOnWrite(reload);
  const grupos = pendientes(data ?? []);
  if (!grupos.length) return null;
  return (
    <button type="button" onClick={() => descargarPdf(grupos.map((g) => armarLista(g, p)), nombreArchivo("lista-super", p.code))}
      className={`${btnSecondary} py-1 text-[11px]`}><FileDown className="w-3 h-3" /> Lista de súper (PDF)</button>
  );
}
