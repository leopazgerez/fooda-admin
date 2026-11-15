// Vistas derivadas que comparten las rutas: costos por producción, ventas, clientes con regularidad, stock con nombres.
import { esRegular } from "../domain/clientes.ts";
import { indirectoAplicable, recupero } from "../domain/finanzas.ts";
import { costoPackEnProduccion, packDelSnapshot } from "../domain/produccion.ts";
import { alertasSede, stockActual } from "../domain/stock.ts";
import { envioPorPack, esIngreso, gananciaLinea, packsVenta, totalVenta } from "../domain/ventas.ts";
import type { Cliente, Produccion, Venta } from "../domain/types.ts";
import type { Estado } from "./seed.ts";

export const nombrePack = (e: Estado, id: number) => e.packs.find((p) => p.id === id)?.nombre ?? "—";
export const nombreSede = (e: Estado, id: number) => e.sedes.find((s) => s.id === id)?.nombre ?? "—";
export const codigoProduccion = (e: Estado, id: number) => e.producciones.find((p) => p.id === id)?.codigo ?? "—";
export const nombreProveedor = (e: Estado, id: number) => e.proveedores.find((p) => p.id === id)?.nombre ?? "—";
export const nombreCompleto = (c: Pick<Cliente, "nombre" | "apellido">) => `${c.nombre} ${c.apellido}`;
export const nombreCliente = (e: Estado, id?: number) => {
  const c = e.clientes.find((x) => x.id === id);
  return c ? nombreCompleto(c) : null;
};

/** Precio de venta del pack: el propio o, si no tiene, el general. */
export const precioDePack = (e: Estado, packId: number) => e.packs.find((p) => p.id === packId)?.precio ?? e.parametros.precioPack;

/** Última producción cerrada con packs (por fecha de cierre). */
export const ultimaCerrada = (e: Estado) => e.producciones.filter((p) => p.estado === "cerrada" && p.lineas.length)
  .sort((a, b) => (a.cierre ?? "").localeCompare(b.cierre ?? "")).at(-1);

const packsDe = (p: Produccion) => p.lineas.reduce((a, l) => a + (l.real ?? l.planificada), 0);
const indirecto = (e: Estado, p: Produccion) =>
  indirectoAplicable((p.cierre ?? p.inicio).slice(0, 7), e.cierres, e.gastos, e.producciones, e.parametros);

/** Costo real por pack (directo con precios pagados + indirecto del mes de producción). */
/** Indirecto por pack ya calculado, por producción: compartirlo entre ventas de una misma respuesta evita recalcularlo. */
export type MemoIndirecto = Map<number, number>;
function costoRealPack(e: Estado, produccionId: number, packId: number, memo: MemoIndirecto): number {
  const p = e.producciones.find((x) => x.id === produccionId);
  if (!p) return 0;
  if (!memo.has(p.id)) memo.set(p.id, indirecto(e, p).valor);
  return costoPackEnProduccion(p, packId, e.insumos).real + memo.get(p.id)!;
}

const vendidosDe = (e: Estado, produccionId: number) => e.ventas.filter(esIngreso)
  .reduce((a, v) => a + v.lineas.reduce((b, l) => b + (l.produccionId === produccionId ? l.cantidad : 0), 0), 0);

export function produccionResumen(e: Estado, p: Produccion) {
  const ind = indirecto(e, p);
  let costoEstimado = 0, costoReal = 0;
  const packs = p.lineas.map((l) => {
    const c = costoPackEnProduccion(p, l.packId, e.insumos);
    const cantidad = l.real ?? l.planificada;
    costoEstimado += cantidad * (c.estimado + ind.valor);
    costoReal += cantidad * (c.real + ind.valor);
    return { packId: l.packId, nombre: nombrePack(e, l.packId), planificada: l.planificada, real: l.real ?? null,
      versionId: packDelSnapshot(p, l.packId)?.versionId ?? null,
      costoDirecto: { estimado: c.estimado, real: c.real }, costoPorPack: c.real + ind.valor };
  });
  const total = packsDe(p);
  const vendidos = vendidosDe(e, p.id);
  return {
    id: p.id, codigo: p.codigo, numero: p.numero, estado: p.estado, inicio: p.inicio, cierre: p.cierre ?? null,
    packs: total, costoEstimado, costoReal, vendidos, pctVendido: total ? vendidos / total : 0,
    indirecto: ind, detallePacks: packs,
    recupero: recupero(costoReal, e.parametros.precioPack, vendidos),
  };
}

export function gananciaVenta(e: Estado, v: Venta, memo: MemoIndirecto = new Map()): number {
  const sede = e.sedes.find((s) => s.id === v.sedeId);
  const envio = sede ? envioPorPack(sede, e.parametros.precioPack) : 0;
  return v.lineas.reduce((a, l) => a + gananciaLinea(l, v, costoRealPack(e, l.produccionId, l.packId, memo), envio), 0);
}

export const ventaVista = (e: Estado, v: Venta, memo?: MemoIndirecto) => ({
  ...v, sede: nombreSede(e, v.sedeId), cliente: nombreCliente(e, v.clienteId),
  packs: packsVenta(v),
  lineas: v.lineas.map((l) => ({ ...l, pack: nombrePack(e, l.packId), lote: codigoProduccion(e, l.produccionId) })),
  total: totalVenta(v), ganancia: gananciaVenta(e, v, memo),
});

export function clienteVista(e: Estado, c: Cliente, hoy: string) {
  const compras = e.ventas.filter((v) => v.clienteId === c.id && esIngreso(v));
  return {
    ...c, nombreCompleto: nombreCompleto(c),
    regular: esRegular(c.id, e.ventas, hoy, e.parametros.mesesRegular),
    ultimaCompra: compras.map((v) => v.fecha).sort().at(-1) ?? null,
    packs: compras.reduce((a, v) => a + packsVenta(v), 0),
    total: compras.reduce((a, v) => a + totalVenta(v), 0),
  };
}

export function stockVista(e: Estado, filtro: { sedeId?: number; packId?: number; produccionId?: number } = {}) {
  const todas = stockActual(e.movimientos);
  const filas = todas
    .filter((f) => (!filtro.sedeId || f.sedeId === filtro.sedeId) && (!filtro.packId || f.packId === filtro.packId) &&
      (!filtro.produccionId || f.produccionId === filtro.produccionId))
    .map((f) => ({ ...f, sede: nombreSede(e, f.sedeId), pack: nombrePack(e, f.packId), lote: codigoProduccion(e, f.produccionId),
      precio: precioDePack(e, f.packId), fechaLote: e.producciones.find((p) => p.id === f.produccionId)?.cierre ?? null }));
  const porSede = e.sedes.map((s) => {
    const total = todas.filter((f) => f.sedeId === s.id).reduce((a, f) => a + f.cantidad, 0);
    return { sedeId: s.id, sede: s.nombre, total, capacidad: s.capacidad, lugaresLibres: s.capacidad - total, alertas: alertasSede(s, total) };
  });
  return { filas, porSede };
}
