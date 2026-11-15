import type { MovimientoStock, Sede } from "./types.ts";

export interface FilaStock { sedeId: number; produccionId: number; packId: number; cantidad: number }
export interface Faltante { produccionId: number; packId: number; disponible: number; pedido: number }

/** Stock por sede × producción × pack; omite ceros; FIFO (producción más vieja primero). */
export function stockActual(movs: MovimientoStock[]): FilaStock[] {
  const m = new Map<string, FilaStock>();
  for (const x of movs) {
    const k = `${x.sedeId}|${x.produccionId}|${x.packId}`;
    const f = m.get(k) ?? { sedeId: x.sedeId, produccionId: x.produccionId, packId: x.packId, cantidad: 0 };
    f.cantidad += x.cantidad;
    m.set(k, f);
  }
  return [...m.values()].filter((f) => f.cantidad !== 0)
    .sort((a, b) => a.produccionId - b.produccionId || a.sedeId - b.sedeId || a.packId - b.packId);
}

export function disponible(movs: MovimientoStock[], sedeId: number, produccionId: number, packId: number): number {
  return movs.reduce((a, x) => (x.sedeId === sedeId && x.produccionId === produccionId && x.packId === packId ? a + x.cantidad : a), 0);
}

/** Primer faltante (agrupando líneas repetidas) o null si todo alcanza. Cantidades deben ser enteros > 0. */
export function validarSalidas(
  movs: MovimientoStock[], sedeId: number, lineas: { produccionId: number; packId: number; cantidad: number }[],
): Faltante | null {
  const pedido = new Map<string, Faltante>();
  for (const l of lineas) {
    const k = `${l.produccionId}|${l.packId}`;
    const f = pedido.get(k) ?? { produccionId: l.produccionId, packId: l.packId, disponible: disponible(movs, sedeId, l.produccionId, l.packId), pedido: 0 };
    if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) return { ...f, pedido: l.cantidad };
    f.pedido += l.cantidad;
    pedido.set(k, f);
  }
  return [...pedido.values()].find((f) => f.pedido > f.disponible) ?? null;
}

export function alertasSede(sede: Sede, stockTotal: number): ("stock_bajo" | "lugar_libre")[] {
  const out: ("stock_bajo" | "lugar_libre")[] = [];
  if (stockTotal <= sede.umbralStock) out.push("stock_bajo");
  if (sede.capacidad - stockTotal >= sede.umbralLugaresLibres) out.push("lugar_libre");
  return out;
}
