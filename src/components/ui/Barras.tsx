// Barras horizontales sin librería: simples, apiladas (segmentos) o divergentes (con negativos).

import { ancho, escala, type Segmento } from "@/lib/analisis";

const COLORES = ["bg-accent", "bg-brand-dark", "bg-success", "bg-warning", "bg-info", "bg-text-secondary"];

export interface FilaBarra { etiqueta: string; valor: number; segmentos?: Segmento[]; marca?: string; /** clave de React si la etiqueta puede repetirse */ clave?: string | number }

/** Cada barra lleva su valor al final; con segmentos muestra leyenda. Los negativos crecen a la izquierda del eje. */
export default function Barras({ filas, formato, claves }: {
  filas: FilaBarra[];
  formato: (n: number) => string;
  /** Orden y color de los segmentos; por defecto, el orden en que aparecen. */
  claves?: string[];
}) {
  if (!filas.length) return null;
  const e = escala(filas.map((f) => f.valor));
  const divergente = e.min < 0;
  const orden = claves ?? [...new Set(filas.flatMap((f) => f.segmentos?.map((s) => s.clave) ?? []))];
  const color = (clave: string) => COLORES[Math.max(0, orden.indexOf(clave)) % COLORES.length];

  return (
    <div className="flex flex-col gap-1.5">
      {filas.map((f, i) => {
        const barra = (
          <div className={`flex h-4 rounded-xs overflow-hidden ${f.valor < 0 ? "flex-row-reverse" : ""}`} style={{ width: `${ancho(f.valor, e)}%` }}>
            {f.segmentos?.length && f.valor >= 0
              ? f.segmentos.map((s) => (
                <div key={s.clave} className={`${color(s.clave)} h-full`} style={{ width: f.valor ? `${(s.valor / f.valor) * 100}%` : 0 }}
                  title={`${s.clave}: ${formato(s.valor)}`} />
              ))
              : <div className={`${f.valor < 0 ? "bg-danger" : COLORES[0]} h-full w-full`} />}
          </div>
        );
        return (
          <div key={f.clave ?? i} className="grid grid-cols-[minmax(5rem,9rem)_1fr_auto] items-center gap-2 text-xs"
            aria-label={`${f.etiqueta}: ${formato(f.valor)}`}>
            <span className="truncate text-text-body" title={f.etiqueta}>
              {f.etiqueta}{f.marca && <span className="ml-1 text-[10px] text-info">● {f.marca}</span>}
            </span>
            {divergente ? (
              <div className="grid grid-cols-2">
                <div className="flex justify-end border-r border-border-strong pr-px">{f.valor < 0 && barra}</div>
                <div className="pl-px">{f.valor >= 0 && barra}</div>
              </div>
            ) : barra}
            <span className={`font-mono text-right whitespace-nowrap ${f.valor < 0 ? "text-danger" : "text-text-primary"}`}>{formato(f.valor)}</span>
          </div>
        );
      })}
      {orden.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-text-secondary">
          {orden.map((c) => <span key={c} className="inline-flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-xs ${color(c)}`} />{c}</span>)}
        </div>
      )}
    </div>
  );
}
