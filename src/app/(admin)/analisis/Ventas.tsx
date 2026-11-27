"use client";

import { useState } from "react";
import { Barras, ListTable, Segmented, Tag, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { PackAnalysis as AnalisisPacks } from "@/lib/api.gen";
import { apilar, etiquetaPeriodo, nombresUnicos } from "@/lib/analisis";
import { useApiResource } from "@/lib/useApi";
import Seccion, { consulta, pesos, type Filtros } from "./Seccion";

/** ¿La fecha cae en el período? (mes "AAAA-MM" o semana que arranca el lunes "AAAA-MM-DD"). */
const enPeriodo = (dia: string, periodo: string, semana: boolean) => {
  if (!semana) return dia.startsWith(periodo);
  const fin = new Date(`${periodo}T00:00:00Z`);
  fin.setUTCDate(fin.getUTCDate() + 7);
  return dia >= periodo && dia < fin.toISOString().slice(0, 10);
};

interface Fila { k: string; periodo: string; pack: string; porSede: Record<number, number>; cantidad: number; monto: number; cambio: boolean }
const MEDIDAS = ["PACKS", "FACTURADO"] as const;

/** ¿Qué se vende? y ¿Dónde?: una sola consulta a /analysis/packs, dos tarjetas. */
export default function Ventas({ filtros }: { filtros: Filtros }) {
  const [medida, setMedida] = useState<(typeof MEDIDAS)[number]>("PACKS");
  const { data, error } = useApiResource(() => api.getOne<AnalisisPacks>("/analysis/packs", consulta(filtros)), [filtros]);
  // de la respuesta, no del filtro: mientras llega la nueva, los períodos viejos se siguen leyendo con su agrupación
  const semana = data?.groupBy === "week";
  const rows = data?.rows ?? [];
  const valor = (r: AnalisisPacks["rows"][number]) => (medida === "PACKS" ? r.quantity : r.amount);
  const formato = medida === "PACKS" ? (n: number) => String(n) : pesos;
  const cambio = (packId: number, periodo: string) => !!data?.changes.some((c) => c.packId === packId && enPeriodo(c.validFrom, periodo, semana));
  const vacio = !rows.length && "Sin ventas en el período.";
  const cargando = !data && !error;

  // por id, no por nombre: dos packs o sedes con el mismo nombre no se mezclan
  const nombrePack = nombresUnicos(rows.map((r) => [r.packId, r.pack]));
  const nombreSede = nombresUnicos(rows.map((r) => [r.branchId, r.branch]));
  const pk = (r: AnalisisPacks["rows"][number]) => nombrePack.get(r.packId) ?? r.pack;
  const packs = [...new Set(nombrePack.values())].sort();
  const porPack = apilar(rows, pk, pk, valor).sort((a, b) => b.total - a.total);
  const ordenados = [...rows].sort((a, b) => a.period.localeCompare(b.period));
  const porPeriodo = apilar(ordenados, (r) => r.period, pk, valor).map((f) => ({
    etiqueta: etiquetaPeriodo(f.etiqueta, semana), valor: f.total, segmentos: f.segmentos,
    marca: rows.some((r) => r.period === f.etiqueta && cambio(r.packId, r.period)) ? "cambió composición" : undefined,
  }));
  const porSede = apilar(rows, (r) => nombreSede.get(r.branchId) ?? r.branch, pk, (r) => r.quantity).sort((a, b) => b.total - a.total);

  const sedes = [...nombreSede.entries()];
  const filas = [...rows.reduce((m, f) => {
    const k = `${f.period}|${f.packId}`;
    const x = m.get(k) ?? { k, periodo: f.period, pack: pk(f), porSede: {}, cantidad: 0, monto: 0, cambio: cambio(f.packId, f.period) };
    x.porSede[f.branchId] = (x.porSede[f.branchId] ?? 0) + f.quantity;
    x.cantidad += f.quantity;
    x.monto += f.amount;
    return m.set(k, x);
  }, new Map<string, Fila>()).values()].sort((a, b) => b.periodo.localeCompare(a.periodo) || a.pack.localeCompare(b.pack));
  const columnas: Columna<Fila>[] = [
    { key: "periodo", header: "PERÍODO", className: "font-mono whitespace-nowrap text-text-secondary capitalize", render: (f) => etiquetaPeriodo(f.periodo, semana) },
    { key: "pack", header: "PACK", className: "font-semibold text-brand-dark whitespace-nowrap", render: (f) => <>
      {f.pack}{f.cambio && <span className="ml-1"><Tag tone="info">Cambió composición</Tag></span>}
    </> },
    ...sedes.map(([id, nombre]): Columna<Fila> => ({ key: `s${id}`, header: nombre.toUpperCase(), align: "right", hideBelow: "sm",
      className: "font-mono text-text-secondary", render: (f) => f.porSede[id] ?? 0 })),
    { key: "cant", header: "PACKS", align: "right", className: "font-mono", render: (f) => f.cantidad },
    { key: "monto", header: "FACTURADO", align: "right", hideBelow: "sm", className: "font-mono", render: (f) => pesos(f.monto) },
  ];

  const porSedeFilas = porSede.map((s) => ({ k: s.etiqueta, ...s }));
  const colSedes: Columna<(typeof porSedeFilas)[number]>[] = [
    { key: "sede", header: "SEDE", className: "font-semibold text-brand-dark", render: (s) => s.etiqueta },
    ...packs.map((p): Columna<(typeof porSedeFilas)[number]> => ({ key: p, header: p.toUpperCase(), align: "right", hideBelow: "sm",
      className: "font-mono text-text-secondary", render: (s) => s.segmentos.find((x) => x.clave === p)?.valor ?? 0 })),
    { key: "total", header: "PACKS", align: "right", className: "font-mono", render: (s) => s.total },
  ];

  return <>
    <Seccion titulo="¿QUÉ SE VENDE?" pregunta="Packs vendidos por pack y su evolución en el tiempo" error={error} cargando={cargando} vacio={vacio}
      derecha={<Segmented options={MEDIDAS} value={medida} onChange={setMedida} />}>
      <Barras filas={porPack.map((p) => ({ etiqueta: p.etiqueta, valor: p.total }))} formato={formato} />
      <p className="text-[11px] font-bold tracking-[0.275px] text-text-label pt-2">{semana ? "POR SEMANA (LUNES A DOMINGO)" : "POR MES"}</p>
      <Barras filas={porPeriodo} formato={formato} claves={packs} />
      <ListTable rows={filas} rowKey={(f) => f.k} columns={columnas} empty="Sin ventas en el período."
        footer={`${filas.reduce((a, f) => a + f.cantidad, 0)} packs · ${pesos(filas.reduce((a, f) => a + f.monto, 0))}`} />
    </Seccion>
    <Seccion titulo="¿DÓNDE?" pregunta="Packs vendidos por sede y qué pack sale en cada una" error={error} cargando={cargando} vacio={vacio}>
      <Barras filas={porSede.map((s) => ({ etiqueta: s.etiqueta, valor: s.total, segmentos: s.segmentos }))} formato={String} claves={packs} />
      <ListTable rows={porSedeFilas} rowKey={(s) => s.k} columns={colSedes} empty="Sin ventas en el período." />
    </Seccion>
  </>;
}
