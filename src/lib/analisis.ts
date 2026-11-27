// Presentación de la pantalla Análisis: escalar barras, agrupar segmentos y formatear períodos.
// No calcula reglas de negocio (costo, ganancia y margen vienen de la API). Puro: testeado con node --test.

export interface Escala { max: number; min: number }
export interface Segmento { clave: string; valor: number }
export interface FilaApilada { etiqueta: string; total: number; segmentos: Segmento[] }

/** Máximo (≥ 0) y mínimo (≤ 0) de los valores; ambos 0 si no hay. */
export function escala(valores: number[]): Escala {
  return { max: Math.max(0, ...valores), min: Math.min(0, ...valores) };
}

/** Largo de la barra en % de su mitad: positivos y negativos comparten la misma medida (el mayor en valor absoluto). */
export function ancho(v: number, e: Escala): number {
  const tope = Math.max(e.max, -e.min);
  return tope === 0 ? 0 : (Math.abs(v) / tope) * 100;
}

/** Variación contra el período anterior (0.2 = +20 %); null si el anterior es 0. */
export function variacion(actual: number, anterior: number): number | null {
  return anterior === 0 ? null : (actual - anterior) / Math.abs(anterior);
}

/** Agrupa filas en barras apiladas: una por `fila`, un segmento por `seg`, en el orden en que aparecen. */
export function apilar<T>(filas: T[], fila: (t: T) => string, seg: (t: T) => string, valor: (t: T) => number): FilaApilada[] {
  const out = new Map<string, FilaApilada>();
  for (const t of filas) {
    const f = out.get(fila(t)) ?? { etiqueta: fila(t), total: 0, segmentos: [] };
    const v = valor(t);
    const s = f.segmentos.find((x) => x.clave === seg(t));
    if (s) s.valor += v;
    else f.segmentos.push({ clave: seg(t), valor: v });
    f.total += v;
    out.set(f.etiqueta, f);
  }
  return [...out.values()];
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11" → "nov 2026"; semana "2026-11-23" (lunes) → "sem. 23/11". */
export function etiquetaPeriodo(periodo: string, semana: boolean): string {
  return semana ? `sem. ${periodo.slice(8, 10)}/${periodo.slice(5, 7)}` : `${MESES[Number(periodo.slice(5, 7)) - 1]} ${periodo.slice(0, 4)}`;
}

/** La opción elegida si sigue disponible; si no (cambió el filtro), la primera. */
export function elegido<T>(actual: T | null, opciones: T[]): T | null {
  return actual !== null && opciones.includes(actual) ? actual : opciones[0] ?? null;
}

/** Nombre por id; si dos ids comparten nombre, se agrega "#id" para que no se mezclen en barras ni leyendas. */
export function nombresUnicos(pares: [number, string][]): Map<number, string> {
  const ids = new Map<number, string>(pares);
  const veces = new Map<string, number>();
  for (const n of ids.values()) veces.set(n, (veces.get(n) ?? 0) + 1);
  return new Map([...ids].map(([id, n]) => [id, (veces.get(n) ?? 0) > 1 ? `${n} #${id}` : n]));
}
