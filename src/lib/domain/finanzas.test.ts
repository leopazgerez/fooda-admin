import test from "node:test";
import assert from "node:assert/strict";
import { enPacks, indirectoAplicable, indirectoDelMes, recupero, repartoReservas, resumenMes } from "./finanzas.ts";
import type { CierreMes, Cobro, Gasto, Parametros, Produccion, Venta } from "./types.ts";

const prod = (cierre: string | undefined, real: number[]): Produccion => ({
  id: 1, codigo: "", numero: 1, estado: cierre ? "cerrada" : "planificada", inicio: "2026-11-01", cierre,
  lineas: real.map((r, i) => ({ packId: i + 1, planificada: r, real: r })), snapshot: {} as Produccion["snapshot"],
  costosPagados: {}, sobrantes: {},
});
let gid = 0;
const gasto = (fecha: string, monto: number, over: Partial<Gasto> = {}): Gasto =>
  ({ id: ++gid, fecha, tipo: "fijo", detalle: "", monto, medio: "transferencia", pagado: true, ...over });
const params = { indirectoReferencia: 1000 } as Parametros;

test("indirectoDelMes: gastos fijos pagados ÷ packs cerrados del mes", () => {
  const gastos = [gasto("2026-11-02", 30000), gasto("2026-11-05", 20000), gasto("2026-11-06", 99, { pagado: false }),
    gasto("2026-11-07", 99, { tipo: "mercadería" }), gasto("2026-11-08", 99, { medio: "packs" }), gasto("2026-10-30", 99)];
  assert.equal(indirectoDelMes("2026-11", gastos, [prod("2026-11-04", [10, 10, 10, 10, 10]), prod(undefined, [99])]), 1000);
});

test("mes sin packs producidos: null, y se aplica la referencia", () => {
  assert.equal(indirectoDelMes("2026-12", [gasto("2026-12-01", 5000)], []), null);
  assert.deepEqual(indirectoAplicable("2026-12", [], [gasto("2026-12-01", 5000)], [], params), { valor: 1000, provisorio: true, esReferencia: true });
});

test("mes abierto: provisorio; mes cerrado: valor congelado aunque haya gastos nuevos", () => {
  const ps = [prod("2026-10-06", [50])];
  assert.deepEqual(indirectoAplicable("2026-10", [], [gasto("2026-10-02", 50000)], ps, params), { valor: 1000, provisorio: true, esReferencia: false });
  const cierres: CierreMes[] = [{ mes: "2026-10", indirectoPorPack: 800, cerradoEl: "2026-11-01" }];
  assert.deepEqual(indirectoAplicable("2026-10", cierres, [gasto("2026-10-02", 999999)], ps, params), { valor: 800, provisorio: false, esReferencia: false });
});

test("resumenMes: cobros por fecha de cobro y pago con packs no resta caja", () => {
  const v = (id: number, fecha: string, tipo: Venta["tipo"] = "minorista"): Venta => ({ id, fecha, sedeId: 1, tipo, descuento: 0, envio: 0,
    medio: "transferencia", lineas: [{ produccionId: 1, packId: 1, cantidad: 2, precioUnitario: 45000 }] });
  const ventas = [v(1, "2026-11-03"), v(2, "2026-10-28"), v(3, "2026-11-04", "pago_con_packs")];
  const cobros: Cobro[] = [{ id: 1, ventaId: 1, fecha: "2026-11-03", monto: 50000, medio: "efectivo" },
    { id: 2, ventaId: 2, fecha: "2026-11-02", monto: 90000, medio: "efectivo" }];
  const gastos = [gasto("2026-11-02", 30000), gasto("2026-11-04", 90000, { medio: "packs" })];
  const r = resumenMes("2026-11", { producciones: [prod("2026-11-04", [10])], ventas, cobros, gastos });
  assert.deepEqual(r, { producidos: 10, vendidos: 2, pctVendido: 0.2, ventas: 90000, cobros: 140000,
    gastosPagados: 30000, resultadoCaja: 110000 });
  assert.equal(resumenMes("2027-01", { producciones: [], ventas: [], cobros: [], gastos: [] }).pctVendido, 0);
});

test("recupero: packs necesarios para cubrir el costo", () => {
  assert.deepEqual(recupero(1_068_000, 45_000, 10), { necesarios: 24, faltan: 14 });
  assert.deepEqual(recupero(1_068_000, 45_000, 30), { necesarios: 24, faltan: 0 });
});

test("repartoReservas y enPacks", () => {
  const rs = [{ id: 1, nombre: "Ahorro", porcentaje: 20 }, { id: 2, nombre: "Envases", porcentaje: 10 }];
  assert.deepEqual(repartoReservas(100000, rs).map((x) => x.monto), [20000, 10000]);
  assert.deepEqual(repartoReservas(-5, rs).map((x) => x.monto), [0, 0]);
  assert.equal(enPacks(67500, 45000), 1.5);
});
