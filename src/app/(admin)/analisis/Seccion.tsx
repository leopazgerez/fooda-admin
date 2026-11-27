"use client";

import { ApiErrorBanner, Card, CardHead } from "@/components/ui";

export interface Filtros { desde: string; hasta: string; agrupar: "month" | "week"; sede: number | null }

/** Parámetros de /analysis/* (vacío → el default de la API). */
export const consulta = (f: Filtros, conSede = true) => ({
  from: f.desde || undefined, to: f.hasta || undefined, groupBy: f.agrupar,
  branchId: conSede && f.sede !== null ? f.sede : undefined,
});

export const pct = (n: number) => `${Math.round(n * 100)} %`;
export const pesos = (n: number) => (n < 0 ? "-$" : "$") + Math.round(Math.abs(n)).toLocaleString("es-AR");

/** Tarjeta de una sección: su error y su vacío no frenan a las demás. */
export default function Seccion({ titulo, pregunta, derecha, error, cargando, vacio, children }: {
  titulo: string; pregunta: string; derecha?: React.ReactNode; error: unknown; cargando: boolean; vacio?: string | false;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 flex flex-col gap-3">
      <CardHead title={titulo} caption={pregunta} right={derecha} />
      <ApiErrorBanner error={error} />
      {cargando ? <p className="text-xs text-text-muted">Cargando…</p>
        : vacio ? <p className="text-xs text-text-muted">{vacio}</p> : children}
    </Card>
  );
}
