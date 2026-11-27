"use client";

import { useState } from "react";
import { Boxes, Percent, TrendingUp, Wallet } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { Field, PageHead, Stat, inputCls, selectCls } from "@/components/ui";
import { api } from "@/lib/api";
import type { AnalysisSummary, BranchResponse, PackMargins } from "@/lib/api.gen";
import { variacion } from "@/lib/analisis";
import { useApiResource, useOptions } from "@/lib/useApi";
import CostoGanancia from "./CostoGanancia";
import Insumos from "./Insumos";
import PorQue from "./PorQue";
import Seccion, { consulta, pct, pesos, type Filtros } from "./Seccion";
import Ventas from "./Ventas";

/** Contra el período anterior: ▲ verde si subió, ▼ rojo si bajó. */
function Variacion({ actual, anterior }: { actual: number; anterior: number }) {
  const v = variacion(actual, anterior);
  if (v === null) return <span>— sin datos del período anterior</span>;
  return <span className={v >= 0 ? "text-success" : "text-danger"}>{v >= 0 ? "▲" : "▼"} {pct(Math.abs(v))} vs. período anterior</span>;
}

/** Margen contra el período anterior, en puntos porcentuales (un % de un % confunde). */
function Puntos({ actual, anterior }: { actual: number; anterior: number }) {
  const d = Math.round((actual - anterior) * 100);
  if (!anterior) return <span>— sin datos del período anterior</span>;
  return <span className={d >= 0 ? "text-success" : "text-danger"}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)} pts vs. período anterior ({pct(anterior)})</span>;
}

/** Tablero de análisis: cada sección contesta una pregunta y carga por separado. */
export default function AnalisisPage() {
  const [filtros, setFiltros] = useState<Filtros>({ desde: "", hasta: "", agrupar: "month", sede: null });
  const set = (cambio: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...cambio }));
  const { options: sedes } = useOptions<BranchResponse>("/branches");
  const resumen = useApiResource(() => api.getOne<AnalysisSummary>("/analysis/summary", consulta(filtros)), [filtros]);
  const margen = useApiResource(() => api.getOne<PackMargins>("/analysis/packs/margin", consulta(filtros)), [filtros]);
  const r = resumen.data;

  return (
    <>
      <Topbar section="Gestión" title="Análisis" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Análisis de packs" subtitle="Qué se vende, dónde, cuánto deja y por qué cambió. Sin uso interno ni pagos con packs" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
          <Field label="DESDE"><input type="date" value={filtros.desde || r?.from || ""} onChange={(e) => set({ desde: e.target.value })} className={inputCls} /></Field>
          <Field label="HASTA"><input type="date" value={filtros.hasta || r?.to || ""} onChange={(e) => set({ hasta: e.target.value })} className={inputCls} /></Field>
          <Field label="AGRUPAR POR">
            <select value={filtros.agrupar} onChange={(e) => set({ agrupar: e.target.value as Filtros["agrupar"] })} className={selectCls}>
              <option value="month">Mes</option><option value="week">Semana</option>
            </select>
          </Field>
          <Field label="SEDE">
            <select value={filtros.sede ?? ""} onChange={(e) => set({ sede: e.target.value ? Number(e.target.value) : null })} className={selectCls}>
              <option value="">Todas</option>
              {sedes.filter((s) => !s.kitchen).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>

        <Seccion titulo="RESUMEN" pregunta={r ? `Comparado con el ${r.previousFrom.split("-").reverse().join("/")} al ${r.previousTo.split("-").reverse().join("/")}` : "Comparado con el período anterior de igual duración"}
          error={resumen.error} cargando={!r && !resumen.error}
          vacio={!!r && !r.current.packs && !r.previous.packs && "Sin ventas en el período ni en el anterior."}>
          {r && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="PACKS VENDIDOS" icon={<Boxes className="w-3.5 h-3.5" />} value={String(r.current.packs)}
                foot={<Variacion actual={r.current.packs} anterior={r.previous.packs} />} />
              <Stat label="FACTURADO" icon={<Wallet className="w-3.5 h-3.5" />} value={pesos(r.current.amount)}
                foot={<Variacion actual={r.current.amount} anterior={r.previous.amount} />} />
              <Stat label="GANANCIA" icon={<TrendingUp className="w-3.5 h-3.5" />} value={pesos(r.current.profit)}
                foot={<Variacion actual={r.current.profit} anterior={r.previous.profit} />} />
              <Stat label="MARGEN" icon={<Percent className="w-3.5 h-3.5" />} value={pct(r.current.margin)}
                foot={<Puntos actual={r.current.margin} anterior={r.previous.margin} />} />
            </div>
          )}
        </Seccion>

        <Ventas filtros={filtros} />
        <CostoGanancia data={margen.data} error={margen.error} />
        <PorQue filtros={filtros} producciones={margen.data?.productions ?? []} />
        <Insumos filtros={filtros} />
      </main>
    </>
  );
}
