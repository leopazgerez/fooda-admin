"use client";

import { useState } from "react";
import { Boxes, Percent, TrendingUp, Wallet } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { Field, PageHead, Stat, campoErr, inputCls, selectCls } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import type { AnalysisSummary, BranchResponse, PackMargins } from "@/lib/api.gen";
import { fechaParaFiltro, variacion } from "@/lib/analisis";
import { formatDate } from "@/lib/dateUtils";
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
function Puntos({ actual, anterior, huboVentas }: { actual: number; anterior: number; huboVentas: boolean }) {
  const d = Math.round((actual - anterior) * 100);
  if (!huboVentas) return <span>— sin datos del período anterior</span>;
  return <span className={d >= 0 ? "text-success" : "text-danger"}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)} pts vs. período anterior ({pct(anterior)})</span>;
}

/** Tablero de análisis: cada sección contesta una pregunta y carga por separado. */
export default function AnalisisPage() {
  const [filtros, setFiltros] = useState<Filtros>({ desde: "", hasta: "", agrupar: "month", sede: null });
  const set = (cambio: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...cambio }));
  // lo que se ve en los inputs de fecha; al filtro solo llega una fecha completa o vacío (default de la API)
  const [fechas, setFechas] = useState({ desde: "", hasta: "" });
  const fecha = (k: "desde" | "hasta", v: string) => {
    setFechas((x) => ({ ...x, [k]: v }));
    const valida = fechaParaFiltro(v);
    if (valida !== null && valida !== filtros[k]) set({ [k]: valida });
  };
  const porDefecto = (iso?: string) => (iso ? `Vacío: ${formatDate(iso)}` : undefined);
  const { options: sedes } = useOptions<BranchResponse>("/branches");
  // desde > hasta: no se consulta (la API respondería 400 en `from` en cada sección)
  const invertido = !!filtros.desde && !!filtros.hasta && filtros.desde > filtros.hasta;
  const resumen = useApiResource(() => invertido ? Promise.resolve(null)
    : api.getOne<AnalysisSummary>("/analysis/summary", consulta(filtros)), [filtros]);
  // con una sola fecha puesta, el otro extremo es el default de la API: el rechazo llega por el resumen
  const rangoMal = invertido || (resumen.error instanceof ApiError && resumen.error.field === "from");
  const margen = useApiResource(() => rangoMal ? Promise.resolve(null)
    : api.getOne<PackMargins>("/analysis/packs/margin", consulta(filtros)), [filtros, rangoMal]);
  const r = rangoMal ? null : resumen.data;

  return (
    <>
      <Topbar section="Gestión" title="Análisis" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Análisis de packs" subtitle="Qué se vende, dónde, cuánto deja y por qué cambió. Sin uso interno ni pagos con packs" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
          <Field label="DESDE" hint={!fechas.desde ? porDefecto(r?.from) : undefined}><input type="date" value={fechas.desde} onChange={(e) => fecha("desde", e.target.value)} className={`${inputCls} ${rangoMal ? campoErr : ""}`} /></Field>
          <Field label="HASTA" hint={!fechas.hasta ? porDefecto(r?.to) : undefined}><input type="date" value={fechas.hasta} onChange={(e) => fecha("hasta", e.target.value)} className={inputCls} /></Field>
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

        {rangoMal ? (
          <p className="text-xs text-danger">{invertido || !(resumen.error instanceof ApiError)
            ? "La fecha desde no puede ser posterior a la fecha hasta." : resumen.error.message}</p>
        ) : <>
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
                foot={<Puntos actual={r.current.margin} anterior={r.previous.margin} huboVentas={r.previous.packs > 0} />} />
            </div>
          )}
        </Seccion>

        <Ventas filtros={filtros} />
        <CostoGanancia data={margen.data} error={margen.error} />
        <PorQue filtros={filtros} producciones={margen.data?.productions ?? []} />
        <Insumos filtros={filtros} />
        </>}
      </main>
    </>
  );
}
