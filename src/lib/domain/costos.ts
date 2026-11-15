import type { Insumo, LineaCompra, LineaReceta, Parametros, Plato, PosicionMenu, PrecioInsumo, Unidad } from "./types.ts";

/** Último precio con fecha <= hasta (o el último si no hay hasta); sin precio → undefined. */
export function ultimoPrecio(insumoId: number, precios: PrecioInsumo[], hasta?: string): PrecioInsumo | undefined {
  let best: PrecioInsumo | undefined;
  for (const p of precios) {
    if (p.insumoId !== insumoId || (hasta && p.fecha > hasta)) continue;
    if (!best || p.fecha > best.fecha || (p.fecha === best.fecha && p.id > best.id)) best = p;
  }
  return best;
}

/** Costo de un compuesto a partir del de sus partes: el máximo o el promedio. */
export function combinar(regla: NonNullable<Insumo["compuesto"]>["regla"], partes: number[]): number {
  if (!partes.length) return 0;
  return regla === "maximo" ? Math.max(...partes) : partes.reduce((a, b) => a + b, 0) / partes.length;
}

/** Cantidad en unidad base del insumo (una línea en "u" de un insumo en g/ml usa gramosPorUnidad). */
export function enBase(insumo: Insumo | undefined, cantidad: number, unidad: Unidad): number {
  return unidad === "u" && insumo && insumo.unidad !== "u" ? cantidad * (insumo.gramosPorUnidad ?? 1) : cantidad;
}

/** Monto de una compra: envases (cantidad ÷ contenido) × precio del envase, redondeado. */
export const montoCompra = (insumos: Insumo[], lineas: LineaCompra[]) =>
  Math.round(lineas.reduce((a, l) => a + (l.cantidad / (insumos.find((i) => i.id === l.insumoId)?.contenido ?? 1)) * l.precioEnvase, 0));

/** Costo por unidad base del insumo. Compuesto: promedio o máximo de sus insumos. Sin precio → 0. */
export function costoUnitario(insumo: Insumo, precios: PrecioInsumo[], insumos: Insumo[], hasta?: string): number {
  if (insumo.compuesto) {
    const partes = insumo.compuesto.insumoIds.map((id) => {
      const i = insumos.find((x) => x.id === id);
      return i ? costoUnitario(i, precios, insumos, hasta) : 0;
    });
    return combinar(insumo.compuesto.regla, partes);
  }
  const p = ultimoPrecio(insumo.id, precios, hasta);
  return p && insumo.contenido > 0 ? p.precioEnvase / insumo.contenido : 0;
}

export function costosVigentes(insumos: Insumo[], precios: PrecioInsumo[], hasta?: string): Record<number, number> {
  return Object.fromEntries(insumos.map((i) => [i.id, costoUnitario(i, precios, insumos, hasta)]));
}

/** porciones × cantidad × costo; una línea en "u" de un insumo en g/ml usa gramosPorUnidad. */
export function costoLinea(l: LineaReceta, costos: Record<number, number>, insumos: Insumo[]): number {
  const insumo = insumos.find((i) => i.id === l.insumoId);
  return l.porciones * enBase(insumo, l.cantidad, l.unidad) * (costos[l.insumoId] ?? 0);
}

export function costoPlato(p: Plato, costos: Record<number, number>, insumos: Insumo[]): number {
  return p.receta.reduce((a, l) => a + costoLinea(l, costos, insumos), 0);
}

export function costoPack(
  menus: PosicionMenu[], platos: Record<number, Plato>, costos: Record<number, number>, insumos: Insumo[],
  params: Parametros, envases: { bandeja: number; sticker: number },
): { recetas: number; aceite: number; packaging: number; directo: number } {
  const recetas = menus.reduce((a, m) => a + (platos[m.platoId] ? costoPlato(platos[m.platoId], costos, insumos) : 0), 0);
  const aceite = params.aceiteMlPorPack * (costos[params.aceiteInsumoId] ?? 0);
  const packaging = params.bandejasPorPack * envases.bandeja + params.stickersPorPack * envases.sticker;
  return { recetas, aceite, packaging, directo: recetas + aceite + packaging };
}
