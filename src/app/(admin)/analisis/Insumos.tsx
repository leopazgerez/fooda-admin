"use client";

import { Barras, ListTable, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { PriceChanges, SupplyPriceChange } from "@/lib/api.gen";
import { useApiResource } from "@/lib/useApi";
import Seccion, { consulta, pct, pesos, type Filtros } from "./Seccion";

const TOPE = 10;

/** Insumos: los que más cambiaron de precio en el período y cuánto le suman (o restan) a cada pack. */
export default function Insumos({ filtros }: { filtros: Filtros }) {
  const { data, error } = useApiResource(() => api.getOne<PriceChanges>("/analysis/supplies/price-changes", consulta(filtros, false)), [filtros]);
  const top = (data?.supplies ?? []).slice(0, TOPE);
  const columnas: Columna<SupplyPriceChange>[] = [
    { key: "insumo", header: "INSUMO", className: "font-semibold text-brand-dark", render: (s) => s.supply },
    { key: "antes", header: "ANTES", align: "right", hideBelow: "sm", className: "font-mono text-text-secondary", render: (s) => pesos(s.firstPrice) },
    { key: "ahora", header: "AHORA", align: "right", className: "font-mono", render: (s) => pesos(s.lastPrice) },
    { key: "cambio", header: "CAMBIO", align: "right", className: "font-mono font-bold",
      render: (s) => <span className={s.changePct > 0 ? "text-danger" : s.changePct < 0 ? "text-success" : "text-text-secondary"}>{s.changePct > 0 ? "+" : ""}{pct(s.changePct)}</span> },
    { key: "impacto", header: "POR PACK", hideBelow: "md", className: "text-text-secondary text-[11px]",
      render: (s) => s.impactPerPack.length
        ? s.impactPerPack.map((i) => `${i.pack} ${i.amount > 0 ? "+" : ""}${pesos(i.amount)}`).join(" · ")
        : "No se usa en las recetas de la última producción" },
  ];

  return (
    <Seccion titulo="INSUMOS" error={error} cargando={!data && !error}
      pregunta={`Los ${TOPE} que más cambiaron de precio y cuánto mueven el costo de cada pack (según la última producción cerrada)`}
      vacio={!top.length && "Sin cambios de precio en el período."}>
      <Barras filas={top.map((s) => ({ etiqueta: s.supply, valor: Math.round(s.changePct * 1000) / 1000, clave: s.supplyId }))} formato={pct} />
      <ListTable rows={top} rowKey={(s) => s.supplyId} columns={columnas} empty="" />
    </Seccion>
  );
}
