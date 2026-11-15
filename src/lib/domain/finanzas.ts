import { packsReales } from "./produccion.ts";
import { esIngreso, packsVenta, totalVenta } from "./ventas.ts";
import type { CierreMes, Cobro, Gasto, Parametros, Produccion, Reserva, Venta } from "./types.ts";

/** Tipo de gasto que entra al indirecto por pack. */
const TIPO_FIJO = "fijo";

const enMes = (fecha: string | undefined, mes: string) => !!fecha && fecha.slice(0, 7) === mes;
const packsCerrados = (mes: string, producciones: Produccion[]) => producciones
  .filter((p) => p.estado === "cerrada" && enMes(p.cierre, mes))
  .reduce((a, p) => a + packsReales(p), 0);
/** Gastos que salen de caja: pagados y no pagados con packs. */
const gastosDeCaja = (mes: string, gastos: Gasto[]) => gastos.filter((g) => g.pagado && g.medio !== "packs" && enMes(g.fecha, mes));

/** Gastos fijos pagados del mes ÷ packs reales de producciones cerradas ese mes; sin packs → null. */
export function indirectoDelMes(mes: string, gastos: Gasto[], producciones: Produccion[]): number | null {
  const packs = packsCerrados(mes, producciones);
  if (!packs) return null;
  return gastosDeCaja(mes, gastos).filter((g) => g.tipo === TIPO_FIJO).reduce((a, g) => a + g.monto, 0) / packs;
}

/** Mes cerrado → valor congelado; abierto → provisorio; sin dato → referencia. */
export function indirectoAplicable(
  mesProduccion: string, cierres: CierreMes[], gastos: Gasto[], producciones: Produccion[], params: Parametros,
): { valor: number; provisorio: boolean; esReferencia: boolean } {
  const cierre = cierres.find((c) => c.mes === mesProduccion);
  const valor = cierre ? cierre.indirectoPorPack : indirectoDelMes(mesProduccion, gastos, producciones);
  return { valor: valor ?? params.indirectoReferencia, provisorio: !cierre, esReferencia: valor === null };
}

export function resumenMes(mes: string, d: { producciones: Produccion[]; ventas: Venta[]; cobros: Cobro[]; gastos: Gasto[] }) {
  const ventasMes = d.ventas.filter((v) => enMes(v.fecha, mes) && esIngreso(v));
  const producidos = packsCerrados(mes, d.producciones);
  const vendidos = ventasMes.reduce((a, v) => a + packsVenta(v), 0);
  const cobros = d.cobros.filter((c) => enMes(c.fecha, mes)).reduce((a, c) => a + c.monto, 0);
  const gastosPagados = gastosDeCaja(mes, d.gastos).reduce((a, g) => a + g.monto, 0);
  return {
    producidos, vendidos, pctVendido: producidos ? vendidos / producidos : 0,
    ventas: ventasMes.reduce((a, v) => a + totalVenta(v), 0), cobros,
    gastosPagados, resultadoCaja: cobros - gastosPagados,
  };
}

/** Los primeros N packs vendidos financian la producción; recién después hay ganancia. */
export function recupero(costoTotalProduccion: number, precioPack: number, vendidos: number): { necesarios: number; faltan: number } {
  const necesarios = precioPack > 0 ? Math.ceil(costoTotalProduccion / precioPack) : 0;
  return { necesarios, faltan: Math.max(0, necesarios - vendidos) };
}

export const repartoReservas = (ganancia: number, reservas: Reserva[]) =>
  reservas.map((reserva) => ({ reserva, monto: ganancia > 0 ? (ganancia * reserva.porcentaje) / 100 : 0 }));

export const enPacks = (monto: number, precioPack: number): number => (precioPack ? Math.round((monto / precioPack) * 10) / 10 : 0);
