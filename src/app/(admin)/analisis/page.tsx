"use client";

import { useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { ApiErrorBanner, Card, CardHead, Field, ListTable, PageHead, Tag, inputCls, selectCls, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { PackAnalysis as AnalisisPacks, VersionAt as VersionEn } from "@/lib/api.gen";
import { formatDate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource } from "@/lib/useApi";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etiqueta = (periodo: string, semana: boolean) =>
  semana ? `sem. ${formatDate(periodo).slice(0, 5)}` : `${MESES[Number(periodo.slice(5, 7)) - 1]} ${periodo.slice(0, 4)}`;
/** ¿La fecha cae en el período? (mes "AAAA-MM" o semana que arranca el lunes "AAAA-MM-DD"). */
const enPeriodo = (dia: string, periodo: string, semana: boolean) => {
  if (!semana) return dia.startsWith(periodo);
  const fin = new Date(`${periodo}T00:00:00Z`);
  fin.setUTCDate(fin.getUTCDate() + 7);
  return dia >= periodo && dia < fin.toISOString().slice(0, 10);
};

interface Fila { k: string; periodo: string; packId: number; pack: string; porSede: Record<number, number>; cantidad: number; monto: number; cambio: boolean }
type Cambio = AnalisisPacks["changes"][number];

/** Ventas por pack, sede y período, con los cambios de composición marcados para ver si movieron las ventas. */
export default function AnalisisPage() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [agrupar, setAgrupar] = useState<"month" | "week">("month");
  const [abierto, setAbierto] = useState<string | null>(null);
  const { data, error } = useApiResource(() => api.getOne<AnalisisPacks>("/analysis/packs",
    { from: desde || undefined, to: hasta || undefined, groupBy: agrupar }), [desde, hasta, agrupar]);
  const semana = agrupar === "week";
  const sedes = [...new Map((data?.rows ?? []).map((f) => [f.branchId, f.branch])).entries()];

  const filas = [...(data?.rows ?? []).reduce((m, f) => {
    const k = `${f.period}|${f.packId}`;
    const x = m.get(k) ?? { k, periodo: f.period, packId: f.packId, pack: f.pack, porSede: {}, cantidad: 0, monto: 0,
      cambio: !!data?.changes.some((c) => c.packId === f.packId && enPeriodo(c.validFrom, f.period, semana)) };
    x.porSede[f.branchId] = (x.porSede[f.branchId] ?? 0) + f.quantity;
    x.cantidad += f.quantity;
    x.monto += f.amount;
    return m.set(k, x);
  }, new Map<string, Fila>()).values()].sort((a, b) => b.periodo.localeCompare(a.periodo) || a.pack.localeCompare(b.pack));

  const columnas: Columna<Fila>[] = [
    { key: "periodo", header: "PERÍODO", className: "font-mono whitespace-nowrap text-text-secondary capitalize", render: (f) => etiqueta(f.periodo, semana) },
    { key: "pack", header: "PACK", className: "font-semibold text-brand-dark whitespace-nowrap", render: (f) => <>
      {f.pack}{f.cambio && <span className="ml-1"><Tag tone="info">Cambió composición</Tag></span>}
    </> },
    ...sedes.map(([id, nombre]): Columna<Fila> => ({ key: `s${id}`, header: nombre.toUpperCase(), align: "right", hideBelow: "sm",
      className: "font-mono text-text-secondary", render: (f) => f.porSede[id] ?? 0 })),
    { key: "cant", header: "PACKS", align: "right", className: "font-mono", render: (f) => f.cantidad },
    { key: "monto", header: "FACTURADO", align: "right", hideBelow: "sm", className: "font-mono", render: (f) => money(f.monto) },
  ];
  const colCambios: Columna<Cambio>[] = [
    { key: "fecha", header: "DESDE", className: "font-mono whitespace-nowrap text-text-secondary", render: (c) => formatDate(c.validFrom) },
    { key: "pack", header: "PACK", className: "font-semibold text-brand-dark", render: (c) => c.pack },
  ];
  const total = filas.reduce((a, f) => a + f.cantidad, 0);

  return (
    <>
      <Topbar section="Gestión" title="Análisis" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Análisis de packs" subtitle="Qué se vende, dónde y si un cambio de menú movió las ventas. Sin uso interno ni pagos con packs" />
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
          <Field label="DESDE"><input type="date" value={desde || data?.from || ""} onChange={(e) => setDesde(e.target.value)} className={inputCls} /></Field>
          <Field label="HASTA"><input type="date" value={hasta || data?.to || ""} onChange={(e) => setHasta(e.target.value)} className={inputCls} /></Field>
          <Field label="AGRUPAR POR">
            <select value={agrupar} onChange={(e) => setAgrupar(e.target.value as "month" | "week")} className={selectCls}>
              <option value="month">Mes</option><option value="week">Semana</option>
            </select>
          </Field>
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="VENTAS POR PACK" caption={semana ? "Semanas de lunes a domingo" : undefined} />
          <ListTable rows={filas} rowKey={(f) => f.k} columns={columnas} empty="Sin ventas en el período."
            footer={`${total} packs · ${money(filas.reduce((a, f) => a + f.monto, 0))}`} />
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="CAMBIOS DE COMPOSICIÓN" caption="Tocá uno para ver qué menús cambiaron" />
          <ListTable rows={data?.changes ?? []} rowKey={(c) => String(c.versionId)} columns={colCambios} empty="Sin cambios en el período."
            onRowClick={(c) => setAbierto(abierto === String(c.versionId) ? null : String(c.versionId))}
            expand={(c) => (abierto === String(c.versionId) ? <DetalleCambio cambio={c} /> : null)} />
        </Card>
      </main>
    </>
  );
}

function DetalleCambio({ cambio }: { cambio: Cambio }) {
  const { data, error } = useApiResource(() => api.getOne<VersionEn>(`/analysis/packs/${cambio.packId}/version-at`, { date: cambio.validFrom }), [cambio.versionId]);
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
