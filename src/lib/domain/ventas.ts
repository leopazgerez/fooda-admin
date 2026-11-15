import type { LineaVenta, Sede, Venta } from "./types.ts";

/** Uso interno y pago con packs descuentan stock pero no son ingreso. */
export const esIngreso = (v: Pick<Venta, "tipo">): boolean => v.tipo !== "uso_interno" && v.tipo !== "pago_con_packs";

/** Packs de una venta o traslado. */
export const packsVenta = (v: { lineas: { cantidad: number }[] }) => v.lineas.reduce((a, l) => a + l.cantidad, 0);

/** Σ packs × precio − descuento + envío; 0 si no es ingreso. */
export function totalVenta(v: Venta): number {
  if (!esIngreso(v)) return 0;
  return v.lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario, 0) - v.descuento + v.envio;
}


/** Envío que absorbe el negocio por pack (no cobrado al cliente). */
export function envioPorPack(sede: Sede, precioPack: number): number {
  if (sede.esCocina || sede.afectaPrecio) return 0;
  return sede.envio.tipo === "monto" ? sede.envio.valor : (sede.envio.valor / 100) * precioPack;
}

/** (precio − descuento prorrateado − costo real − envío) × cantidad; si no es ingreso, −costo × cantidad. */
export function gananciaLinea(l: LineaVenta, v: Venta, costoRealPack: number, envio: number): number {
  if (!esIngreso(v)) return -costoRealPack * l.cantidad;
  const packs = packsVenta(v);
  const descuento = packs ? v.descuento / packs : 0;
  return (l.precioUnitario - descuento - costoRealPack - envio) * l.cantidad;
}
