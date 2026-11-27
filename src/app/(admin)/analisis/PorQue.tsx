"use client";

import { useState } from "react";
import { ApiErrorBanner, Barras, ListTable, Tag, selectCls, type Columna, type Tone } from "@/components/ui";
import { api } from "@/lib/api";
import type { AnalysisEvent, AnalysisEvents, AnalysisProductionCost, CostDriver, CostDrivers, VersionAt as VersionEn } from "@/lib/api.gen";
import { formatDate } from "@/lib/dateUtils";
import { elegido } from "@/lib/analisis";
import { useApiResource } from "@/lib/useApi";
import Seccion, { consulta, pesos, type Filtros } from "./Seccion";

const TIPOS: Record<string, { texto: string; tono: Tone }> = {
  composition: { texto: "Composición", tono: "info" },
  recipe: { texto: "Receta", tono: "warning" },
  pack_price: { texto: "Precio del pack", tono: "neutral" },
  charged_price: { texto: "Precio cobrado", tono: "solid" },
  supply_price: { texto: "Precio de insumo", tono: "danger" },
};

function detalle(e: AnalysisEvent) {
  const precio = e.before !== null && e.after !== null ? ` · ${pesos(e.before)} → ${pesos(e.after)}` : "";
  switch (e.kind) {
    case "composition": return `${e.pack}: cambiaron los menús (tocá para ver)`;
    case "recipe": return `${e.dish} (${e.pack}): cambió la receta en la producción ${e.production}`;
    case "pack_price": return `Precio general del pack en ${e.production}${precio}`;
    case "charged_price": return `${e.pack}: precio cobrado promedio${precio}`;
    case "supply_price": return `${e.supply}${precio}`;
    default: return e.kind;
  }
}

/** ¿Por qué cambió? Lo que movió a los packs en el período y qué explica que una producción costara distinto. */
export default function PorQue({ filtros, producciones }: { filtros: Filtros; producciones: AnalysisProductionCost[] }) {
  const { data, error } = useApiResource(() => api.getOne<AnalysisEvents>("/analysis/events", consulta(filtros)), [filtros]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const eventos = (data?.events ?? []).map((e, i) => ({ ...e, i }));
  const columnas: Columna<(typeof eventos)[number]>[] = [
    { key: "fecha", header: "FECHA", className: "font-mono whitespace-nowrap text-text-secondary", render: (e) => formatDate(e.date) },
    { key: "tipo", header: "TIPO", className: "whitespace-nowrap", render: (e) => <Tag tone={TIPOS[e.kind]?.tono ?? "neutral"}>{TIPOS[e.kind]?.texto ?? e.kind}</Tag> },
    { key: "detalle", header: "QUÉ CAMBIÓ", className: "text-text-body", render: detalle },
  ];

  return (
    <Seccion titulo="¿POR QUÉ CAMBIÓ?" pregunta="Cambios de menú, recetas y precios en el período (la sede solo filtra el precio cobrado). Tocá un cambio de composición para ver los platos"
      error={error} cargando={!data && !error}>
      <ListTable rows={eventos} rowKey={(e) => e.i} columns={columnas} empty="Sin cambios en el período."
        onRowClick={(e) => e.kind === "composition" && setAbierto(abierto === e.i ? null : e.i)}
        expand={(e) => (abierto === e.i && e.packId !== null ? <DetalleCambio packId={e.packId} fecha={e.date} /> : null)} />
      <CostoDistinto producciones={producciones} />
    </Seccion>
  );
}

function DetalleCambio({ packId, fecha }: { packId: number; fecha: string }) {
  const { data, error } = useApiResource(() => api.getOne<VersionEn>(`/analysis/packs/${packId}/version-at`, { date: fecha }), [packId, fecha]);
  if (error) return <ApiErrorBanner error={error} />;
  if (!data) return <p className="text-xs text-text-muted">Cargando…</p>;
  return data.changes.length ? (
    <ul className="flex flex-col gap-1 text-xs">
      {data.changes.map((x) => (
        <li key={x.number}><span className="font-mono text-text-muted">N° {x.number}{x.newNumber !== x.number ? ` → ${x.newNumber}` : ""}</span>{" "}
          <span className="line-through text-text-secondary">{x.before}</span> → <b className="text-text-primary">{x.after}</b></li>
      ))}
    </ul>
  ) : <p className="text-xs text-text-muted">Mismos platos que la versión anterior.</p>;
}

/** Elegí producción y pack: barras por insumo con lo que sumó o restó al costo por pack contra la producción anterior. */
function CostoDistinto({ producciones }: { producciones: AnalysisProductionCost[] }) {
  const lotes = [...new Map(producciones.map((p) => [p.productionId, p.code])).entries()].reverse();
  const [lote, setLote] = useState<number | null>(null);
  const [pack, setPack] = useState<number | null>(null);
  const produccion = elegido(lote, lotes.map(([id]) => id));
  const packs = producciones.filter((p) => p.productionId === produccion);
  const packId = elegido(pack, packs.map((p) => p.packId));
  const { data, error } = useApiResource(() => produccion === null || packId === null ? Promise.resolve(null)
    : api.getOne<CostDrivers>(`/analysis/productions/${produccion}/cost-drivers`, { packId }, { quiet: true }), [produccion, packId]);
  if (!lotes.length) return null;

  const columnas: Columna<CostDriver>[] = [
    { key: "insumo", header: "INSUMO", className: "font-semibold text-brand-dark", render: (d) => d.supply },
    { key: "precio", header: "POR PRECIO", align: "right", hideBelow: "sm", className: "font-mono", render: (d) => (d.supplyId === 0 ? "—" : pesos(d.priceEffect)) },
    { key: "cantidad", header: "POR CANTIDAD", align: "right", hideBelow: "sm", className: "font-mono", render: (d) => (d.supplyId === 0 ? "—" : pesos(d.quantityEffect)) },
    { key: "total", header: "TOTAL", align: "right", className: "font-mono font-bold",
      render: (d) => <span className={d.total > 0 ? "text-danger" : "text-success"}>{d.total > 0 ? "+" : ""}{pesos(d.total)}</span> },
  ];

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border-faint">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold tracking-[0.275px] text-text-label">¿POR QUÉ ESTA PRODUCCIÓN COSTÓ DISTINTO?</p>
        <div className="flex gap-2">
          <select value={produccion ?? ""} onChange={(e) => setLote(Number(e.target.value))} className={`${selectCls} w-32`} aria-label="Producción">
            {lotes.map(([id, code]) => <option key={id} value={id}>{code}</option>)}
          </select>
          <select value={packId ?? ""} onChange={(e) => setPack(Number(e.target.value))} className={`${selectCls} w-40`} aria-label="Pack">
            {packs.map((p) => <option key={p.packId} value={p.packId}>{p.pack}</option>)}
          </select>
        </div>
      </div>
      <ApiErrorBanner error={error} />
      {!data || data.productionId !== produccion || data.packId !== packId ? (!error && <p className="text-xs text-text-muted">Cargando…</p>)
        : data.previousProductionId === null ? <p className="text-xs text-text-muted">Es la primera producción de este pack.</p>
        : <>
          <p className="text-xs text-text-secondary">
            Costo por pack: <span className="font-mono">{pesos(data.totalBefore ?? 0)}</span> en {data.previousCode} →{" "}
            <b className="font-mono text-text-primary">{pesos(data.totalAfter)}</b> en {data.code}
          </p>
          {data.drivers.length ? <>
            <Barras filas={data.drivers.map((d) => ({ etiqueta: d.supply, valor: d.total, clave: d.supplyId }))} formato={pesos} />
            <ListTable rows={data.drivers} rowKey={(d) => d.supplyId} columns={columnas} empty="" />
          </> : <p className="text-xs text-text-muted">Costó lo mismo que la anterior.</p>}
        </>}
    </div>
  );
}
