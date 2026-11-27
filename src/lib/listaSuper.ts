// Lista de compras por proveedor para llevar al súper (copiar o PDF), a partir de GET /productions/{id}/shopping-list.
// Puro: testeado con node --test. Por eso formatea pesos y fecha acá y no importa format.ts/dateUtils.ts.
import type { ShoppingGroupResponse } from "./api.gen";

export interface ItemLista { nombre: string; cantidad: string; importe: string }
export interface ListaSuper { proveedor: string; subtitulo: string; items: ItemLista[]; llevar: string; packs: string }

const num = (n: number, decimales: number) => n.toLocaleString("es-AR", { maximumFractionDigits: decimales });
const pesos = (n: number) => `$${num(Math.round(n), 0)}`;
const fecha = (iso: string) => iso.split("-").reverse().join("/");

/** g → kg y ml → l desde 1000; debajo, en g/ml; u tal cual. Hasta 2 decimales. */
export function cantidad(quantity: number, unit: string): string {
  const grande = { g: "kg", ml: "l" }[unit];
  if (grande && quantity >= 1000) return `${num(quantity / 1000, 2)} ${grande}`;
  return `${num(quantity, 2)} ${unit}`;
}

export function armarLista(g: ShoppingGroupResponse, prod: { code: string; start: string }): ListaSuper {
  return {
    proveedor: g.supplier,
    subtitulo: `${g.supplier} · Producción ${prod.code} · ${fecha(prod.start)}`,
    items: g.items.map((i) => ({ nombre: i.name, cantidad: cantidad(i.quantity, i.unit), importe: !i.unitCost ? "sin precio" : pesos(i.total) })),
    llevar: pesos(g.total),
    packs: num(g.totalInPacks, 1),
  };
}

export function textoLista(l: ListaSuper): string {
  return [
    "FOODA · Lista de compras",
    l.subtitulo,
    "",
    ...l.items.map((i) => `☐ ${i.nombre} — ${i.cantidad} — ${i.importe}`),
    "",
    `Llevar ≈ ${l.llevar} (≈ ${l.packs} packs)`,
  ].join("\n");
}

/** Las que faltan comprar: las compradas vienen con lo planificado, no con lo pagado. */
export const pendientes = (grupos: ShoppingGroupResponse[]) => grupos.filter((g) => g.status === "pending");

/** El grupo de esa compra; si el purchaseId no coincide, el único pendiente del proveedor (nunca uno comprado ni uno ambiguo). */
export function grupoDeCompra(grupos: ShoppingGroupResponse[], compra: { id: number; supplierId: number }): ShoppingGroupResponse | undefined {
  const exacto = grupos.find((g) => g.purchaseId === compra.id);
  if (exacto) return exacto;
  const delProveedor = pendientes(grupos).filter((g) => g.supplierId === compra.supplierId);
  return delProveedor.length === 1 ? delProveedor[0] : undefined;
}

/** Nombre de archivo sin extensión: minúsculas, sin acentos, todo lo demás → "-". */
export const nombreArchivo = (...partes: string[]) =>
  partes.join("-").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Carga por id en paralelo; la que falla queda en null (para avisarlo al tocar) y no deja sin datos a las demás. */
export async function cargarPorId<T>(ids: number[], cargar: (id: number) => Promise<T>): Promise<Map<number, T | null>> {
  return new Map(await Promise.all(ids.map((id) => cargar(id).catch(() => null).then((v) => [id, v] as const))));
}

/** Mientras una ejecución con la misma clave sigue en curso, los demás llamados con esa clave no hacen nada (doble toque → un solo PDF). */
export function unaALaVez<A extends unknown[]>(fn: (...args: A) => Promise<void>, clave: (...args: A) => string = () => ""): (...args: A) => Promise<void> {
  const enCurso = new Set<string>();
  return async (...args) => {
    const k = clave(...args);
    if (enCurso.has(k)) return;
    enCurso.add(k);
    try {
      await fn(...args);
    } finally {
      enCurso.delete(k);
    }
  };
}
