import { costoPack, costosVigentes, enBase } from "./costos.ts";
import type { Insumo, PackVersion, Parametros, Plato, PrecioInsumo, Produccion, Proveedor, Snapshot, Unidad } from "./types.ts";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** codigoLote(1, "2026-11-03") === "1 NOV 26" */
export function codigoLote(numero: number, fecha: string): string {
  const [y, m] = fecha.split("-");
  return `${numero} ${MESES[Number(m) - 1]} ${y.slice(2)}`;
}

/** Máximo número del mismo mes + 1; reinicia cada mes. */
export function siguienteNumero(producciones: Produccion[], fecha: string): number {
  const mes = fecha.slice(0, 7);
  return producciones.filter((p) => p.inicio.slice(0, 7) === mes).reduce((a, p) => Math.max(a, p.numero), 0) + 1;
}

/** Orden cronológico de versiones: por `desde`; en empate, la de id mayor es la última cargada. */
export const porVigencia = (a: PackVersion, b: PackVersion) => a.desde.localeCompare(b.desde) || a.id - b.id;

/** Versión vigente de un pack a la fecha: la última por vigencia con `desde` <= dia. */
export function versionVigente(versiones: PackVersion[], packId: number, dia: string): PackVersion | undefined {
  return versiones.filter((v) => v.packId === packId && v.desde <= dia).sort(porVigencia).at(-1);
}

/** Pack congelado en el snapshot de la producción. */
export const packDelSnapshot = (p: Produccion, packId: number) => p.snapshot.packs.find((x) => x.packId === packId);

/** Packs que salieron de la producción (0 si no se cerró). */
export const packsReales = (p: Produccion) => p.lineas.reduce((a, l) => a + (l.real ?? 0), 0);

/** Versión vigente de cada pack a la fecha, platos referenciados y costos, copiados por valor. */
export function tomarSnapshot(
  packIds: number[], versiones: PackVersion[], platos: Plato[], insumos: Insumo[], precios: PrecioInsumo[],
  params: Parametros, fecha: string,
): Snapshot {
  const packs = packIds.map((packId) => {
    const v = versionVigente(versiones, packId, fecha);
    if (!v) throw new Error(`El pack ${packId} no tiene versión vigente al ${fecha}`);
    return { packId, versionId: v.id, menus: v.menus.map((m) => ({ ...m })) };
  });
  const usados = new Set(packs.flatMap((p) => p.menus.map((m) => m.platoId)));
  const copia = Object.fromEntries(platos.filter((p) => usados.has(p.id)).map((p) => [p.id, structuredClone(p)]));
  return { costos: costosVigentes(insumos, precios, fecha), platos: copia, packs, parametros: { ...params }, insumos: structuredClone(insumos) };
}

/** Costo por unidad de bandeja y sticker según los insumos marcados como envase. */
export function costosEnvases(insumos: Insumo[], costos: Record<number, number>) {
  const de = (t: "bandeja" | "sticker") => costos[insumos.find((i) => i.esEnvase === t)?.id ?? -1] ?? 0;
  return { bandeja: de("bandeja"), sticker: de("sticker") };
}

/** Insumos con los que se calcula la producción: los del snapshot (conversión y compuestos congelados),
 *  con el proveedor vigente para agrupar la lista. Producciones sin copia (lote INICIAL) usan los vivos. */
export function insumosDe(p: Produccion, vivos: Insumo[]): Insumo[] {
  if (!p.snapshot.insumos?.length) return vivos;
  return p.snapshot.insumos.map((i) => ({ ...i, proveedorId: vivos.find((v) => v.id === i.id)?.proveedorId ?? i.proveedorId }));
}

/** Costo directo de un pack en la producción: estimado (snapshot) y real (precios pagados donde los hay). */
export function costoPackEnProduccion(p: Produccion, packId: number, vivos: Insumo[]): { estimado: number; real: number } {
  const insumos = insumosDe(p, vivos);
  const sp = packDelSnapshot(p, packId);
  if (!sp) return { estimado: 0, real: 0 };
  const est = p.snapshot.costos;
  const real = { ...est, ...p.costosPagados };
  const calc = (c: Record<number, number>) =>
    costoPack(sp.menus, p.snapshot.platos, c, insumos, p.snapshot.parametros, costosEnvases(insumos, c)).directo;
  return { estimado: calc(est), real: calc(real) };
}

export interface ItemLista { insumoId: number; nombre: string; cantidad: number; unidad: Unidad; costoUnitario: number; total: number }

/** Reparte un compuesto: promedio en partes iguales; máximo todo al más caro del snapshot. */
function expandir(insumo: Insumo, cantidad: number, insumos: Insumo[], costos: Record<number, number>): [Insumo, number][] {
  if (!insumo.compuesto) return [[insumo, cantidad]];
  const partes = insumo.compuesto.insumoIds.map((id) => insumos.find((i) => i.id === id)).filter((i): i is Insumo => !!i);
  if (!partes.length) return [];
  if (insumo.compuesto.regla === "maximo") {
    const caro = partes.reduce((a, b) => ((costos[b.id] ?? 0) > (costos[a.id] ?? 0) ? b : a));
    return [[caro, cantidad]];
  }
  return partes.map((i) => [i, cantidad / partes.length]);
}

/** Salida 1: lista de súper por proveedor, menos sobrantes, sin envases. */
export function listaSuper(p: Produccion, vivos: Insumo[], proveedores: Proveedor[]): { proveedor: Proveedor; items: ItemLista[]; total: number }[] {
  const insumos = insumosDe(p, vivos);
  const cant = new Map<number, number>();
  for (const linea of p.lineas) {
    const sp = packDelSnapshot(p, linea.packId);
    for (const m of sp?.menus ?? []) {
      for (const r of p.snapshot.platos[m.platoId]?.receta ?? []) {
        const insumo = insumos.find((i) => i.id === r.insumoId);
        if (!insumo) continue;
        const total = enBase(insumo, r.cantidad * r.porciones * linea.planificada, r.unidad);
        for (const [i, c] of expandir(insumo, total, insumos, p.snapshot.costos)) cant.set(i.id, (cant.get(i.id) ?? 0) + c);
      }
    }
  }
  const grupos = new Map<number, ItemLista[]>();
  for (const [id, c] of cant) {
    const insumo = insumos.find((i) => i.id === id)!;
    const cantidad = Math.max(0, c - (p.sobrantes[id] ?? 0));
    if (insumo.esEnvase || cantidad <= 0) continue;
    const costoUnitario = p.snapshot.costos[id] ?? 0;
    const item = { insumoId: id, nombre: insumo.nombre, cantidad, unidad: insumo.unidad, costoUnitario, total: cantidad * costoUnitario };
    grupos.set(insumo.proveedorId, [...(grupos.get(insumo.proveedorId) ?? []), item]);
  }
  return [...proveedores].sort((a, b) => a.orden - b.orden)
    .filter((pr) => grupos.has(pr.id))
    .map((proveedor) => {
      const items = grupos.get(proveedor.id)!.sort((a, b) => a.nombre.localeCompare(b.nombre));
      return { proveedor, items, total: items.reduce((a, i) => a + i.total, 0) };
    });
}

export interface MenuEscalado {
  numero: number; plato: string; ingredientes: { nombre: string; cantidad: number; unidad: Unidad }[];
  compartidoCon?: { packId: number; cantidad: number }; totalCombinado?: number;
}

/** Salida 2: recetario por pack → menú, multiplicado por los packs planificados. */
export function recetarioEscalado(p: Produccion, vivos: Insumo[]): { packId: number; nombre: string; cantidad: number; menus: MenuEscalado[] }[] {
  const insumos = insumosDe(p, vivos);
  return p.lineas.map((linea) => {
    const sp = packDelSnapshot(p, linea.packId);
    const menus = (sp?.menus ?? []).map((m): MenuEscalado => {
      const plato = p.snapshot.platos[m.platoId];
      const otra = p.lineas.find((o) => o.packId !== linea.packId &&
        packDelSnapshot(p, o.packId)?.menus.some((om) => om.platoId === m.platoId));
      return {
        numero: m.numero, plato: plato?.nombre ?? "",
        ingredientes: (plato?.receta ?? []).map((r) => ({
          nombre: insumos.find((i) => i.id === r.insumoId)?.nombre ?? "", unidad: r.unidad,
          cantidad: r.cantidad * r.porciones * linea.planificada,
        })),
        ...(otra ? { compartidoCon: { packId: otra.packId, cantidad: otra.planificada }, totalCombinado: linea.planificada + otra.planificada } : {}),
      };
    });
    return { packId: linea.packId, nombre: `Pack ${linea.packId}`, cantidad: linea.planificada, menus };
  });
}
