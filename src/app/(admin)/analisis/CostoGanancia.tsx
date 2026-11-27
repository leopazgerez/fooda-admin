"use client";

import { useState } from "react";
import { Barras, ListTable, selectCls, type Columna } from "@/components/ui";
import type { PackMarginRow, PackMargins } from "@/lib/api.gen";
import { elegido } from "@/lib/analisis";
import Seccion, { pct, pesos } from "./Seccion";

/** ¿Cuánto cuesta y cuánto deja? Precio, costo y ganancia por pack, y el costo por pack de cada producción. */
export default function CostoGanancia({ data, error }: { data: PackMargins | null | undefined; error: unknown }) {
  const producciones = data?.productions ?? [];
  const packs = [...new Map(producciones.map((p) => [p.packId, p.pack])).entries()];
  const [elegidoPack, setElegido] = useState<number | null>(null);
  const pack = elegido(elegidoPack, packs.map(([id]) => id));

  const columnas: Columna<PackMarginRow>[] = [
    { key: "pack", header: "PACK", className: "font-semibold text-brand-dark", render: (p) => p.pack },
    { key: "vendidos", header: "VENDIDOS", align: "right", hideBelow: "sm", className: "font-mono text-text-secondary", render: (p) => p.sold },
    { key: "precio", header: "PRECIO PROM.", align: "right", className: "font-mono", render: (p) => pesos(p.avgPrice) },
    { key: "costo", header: "COSTO PROM.", align: "right", className: "font-mono", render: (p) => pesos(p.avgCost) },
    { key: "ganancia", header: "GANANCIA/PACK", align: "right", className: "font-mono font-bold",
      render: (p) => <span className={p.profitPerPack < 0 ? "text-danger" : "text-success"}>{pesos(p.profitPerPack)}</span> },
    { key: "margen", header: "MARGEN", align: "right", hideBelow: "sm", className: "font-mono", render: (p) => pct(p.margin) },
  ];

  return (
    <Seccion titulo="¿CUÁNTO CUESTA Y CUÁNTO DEJA?" error={error} cargando={!data && !error}
      pregunta="Ganancia real por pack vendido (descuenta costo del lote, gastos fijos, envío y descuentos)"
      vacio={!data?.packs.length && !producciones.length && "Sin ventas ni producciones cerradas en el período."}>
      {!!data?.packs.length && <>
        <Barras filas={data.packs.map((p) => ({ etiqueta: p.pack, valor: p.profitPerPack, clave: p.packId }))} formato={pesos} />
        <ListTable rows={data.packs} rowKey={(p) => p.packId} columns={columnas} empty="Sin ventas en el período." />
      </>}
      {pack !== null && <>
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-[11px] font-bold tracking-[0.275px] text-text-label">COSTO POR PACK EN CADA PRODUCCIÓN</p>
          <select value={pack} onChange={(e) => setElegido(Number(e.target.value))} className={`${selectCls} max-w-48`} aria-label="Pack">
            {packs.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        </div>
        <Barras filas={producciones.filter((p) => p.packId === pack).map((p) => ({ etiqueta: p.code, valor: p.costPerPack, clave: p.productionId }))} formato={pesos} />
      </>}
    </Seccion>
  );
}
