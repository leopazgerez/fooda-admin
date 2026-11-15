import test from "node:test";
import assert from "node:assert/strict";
import { envioPorPack, esIngreso, gananciaLinea, totalVenta } from "./ventas.ts";
import { cumpleanosHoy, esRegular, recontactos } from "./clientes.ts";
import type { Cliente, Sede, Venta } from "./types.ts";

const venta = (over: Partial<Venta> = {}): Venta => ({
  id: 1, fecha: "2026-11-10", sedeId: 1, tipo: "minorista", descuento: 0, envio: 0, medio: "transferencia",
  lineas: [{ produccionId: 1, packId: 1, cantidad: 2, precioUnitario: 45000 }], ...over,
});

test("totalVenta = packs × precio − descuento + envío", () => {
  assert.equal(totalVenta(venta({ descuento: 5000, envio: 3000 })), 88000);
});

test("uso interno y pago con packs: total 0 y no son ingreso", () => {
  assert.equal(totalVenta(venta({ tipo: "uso_interno" })), 0);
  assert.equal(totalVenta(venta({ tipo: "pago_con_packs" })), 0);
  assert.equal(esIngreso(venta({ tipo: "pago_con_packs" })), false);
  assert.equal(esIngreso(venta({ tipo: "mayorista" })), true);
});

const salta = { esCocina: true, afectaPrecio: false, envio: { tipo: "monto", valor: 0 } } as Sede;
const jvg = { esCocina: false, afectaPrecio: false, envio: { tipo: "monto", valor: 9000 } } as Sede;

test("envioPorPack: JVG monto 9.000; Salta 0; afectaPrecio 0; porcentaje", () => {
  assert.equal(envioPorPack(jvg, 45000), 9000);
  assert.equal(envioPorPack(salta, 45000), 0);
  assert.equal(envioPorPack({ ...jvg, afectaPrecio: true }, 45000), 0);
  assert.equal(envioPorPack({ ...jvg, envio: { tipo: "porcentaje", valor: 10 } }, 45000), 4500);
});

test("gananciaLinea descuenta costo, descuento prorrateado y envío no cobrado", () => {
  const v = venta({ descuento: 4000 });
  assert.equal(gananciaLinea(v.lineas[0], v, 24000, 9000), 2 * (45000 - 2000 - 24000 - 9000));
  const u = venta({ tipo: "uso_interno" });
  assert.equal(gananciaLinea(u.lineas[0], u, 24000, 0), -48000);
});

const ventaDe = (clienteId: number, fecha: string, tipo: Venta["tipo"] = "minorista") => venta({ clienteId, fecha, tipo });

test("esRegular: compra en cada uno de los 2 meses completos anteriores", () => {
  const vs = [ventaDe(1, "2026-09-05"), ventaDe(1, "2026-10-20"), ventaDe(2, "2026-09-05"), ventaDe(2, "2026-11-02")];
  assert.equal(esRegular(1, vs, "2026-11-15", 2), true);
  assert.equal(esRegular(2, vs, "2026-11-15", 2), false);
  assert.equal(esRegular(3, [ventaDe(3, "2026-09-05"), ventaDe(3, "2026-10-05", "uso_interno")], "2026-11-15", 2), false);
});

const cli = (id: number, cumpleanos?: string): Cliente => ({ id, nombre: `C${id}`, apellido: "X", cumpleanos });

test("recontactos: última compra hace >= 30 días, más antiguo primero, nunca compró no aparece", () => {
  const vs = [ventaDe(1, "2026-10-16"), ventaDe(2, "2026-10-17"), ventaDe(3, "2026-09-01"), ventaDe(3, "2026-10-01")];
  const r = recontactos([cli(1), cli(2), cli(3), cli(4)], vs, "2026-11-15", 30);
  assert.deepEqual(r.map((x) => [x.cliente.id, x.diasSinComprar, x.ultimaCompra]), [[3, 45, "2026-10-01"], [1, 30, "2026-10-16"]]);
  assert.deepEqual(r[0].packIds, [1]);
});

test("cumpleanosHoy", () => {
  assert.deepEqual(cumpleanosHoy([cli(1, "11-15"), cli(2, "11-16"), cli(3)], "2026-11-15").map((c) => c.id), [1]);
});
