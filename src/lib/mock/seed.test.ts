import test from "node:test";
import assert from "node:assert/strict";
import { semilla } from "./seed.ts";
import { costoPack, costoPlato, costosVigentes } from "../domain/costos.ts";
import { stockActual } from "../domain/stock.ts";
import { esIngreso, totalVenta } from "../domain/ventas.ts";

const near = (a: number, b: number, tol = 0.011) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);
const e = semilla();
const costos = costosVigentes(e.insumos, e.precios, "2026-10-31"); // precios de la planilla, antes de las subas de noviembre
const envase = (t: "bandeja" | "sticker") => costos[e.insumos.find((i) => i.esEnvase === t)!.id];
const version = (packNumero: number) => {
  const pack = e.packs.find((p) => p.numero === packNumero)!;
  return e.versiones.find((v) => v.packId === pack.id)!;
};
const platos = Object.fromEntries(e.platos.map((p) => [p.id, p]));

test("semilla: 52 insumos de la planilla + 2 compuestos + 2 envases; 22 platos; 5 packs", () => {
  assert.equal(e.insumos.filter((i) => !i.compuesto && !i.esEnvase).length, 52);
  assert.equal(e.insumos.filter((i) => i.compuesto).length, 2);
  assert.equal(e.platos.length, 22);
  assert.deepEqual(e.packs.map((p) => p.nombre), ["Caserito", "Low Carb", "Proteico", "Equilibrio", "Full Veggie"]);
});

test("semilla reproduce la planilla: costo directo de los 5 packs", () => {
  const esperado = [22974.09, 20252.42, 23818.56, 25886.85, 20227.92];
  esperado.forEach((v, i) => {
    const c = costoPack(version(i + 1).menus, platos, costos, e.insumos, e.parametros, { bandeja: envase("bandeja"), sticker: envase("sticker") });
    near(c.directo, v);
    near(c.aceite, 64);
    assert.equal(c.packaging, 5250);
  });
});

test("semilla: los 25 costos por menú de la planilla §5", () => {
  const esperado = [3166.5, 4135.62, 3580, 3202.18, 3575.79, 3213.8, 3197, 2462.67, 3650.62, 2414.33,
    3213.8, 3481.4, 4432.7, 4914, 2462.67, 4414, 4222.33, 4483.32, 4271.2, 3182,
    3202.18, 2504.24, 2910.5, 3408.8, 2888.2];
  const menus = [1, 2, 3, 4, 5].flatMap((n) => version(n).menus);
  assert.equal(menus.length, 25);
  for (const m of menus) near(costoPlato(platos[m.platoId], costos, e.insumos), esperado[m.numero - 1]);
});

test("semilla coherente: ids únicos, stock nunca negativo en orden cronológico", () => {
  const ids = Object.values(e).filter(Array.isArray).flat().map((x) => (x as { id?: number }).id).filter((x) => x !== undefined);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(e.seq > Math.max(...(ids as number[])));
  const movs = [...e.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  for (let i = 1; i <= movs.length; i++) {
    for (const f of stockActual(movs.slice(0, i))) assert.ok(f.cantidad >= 0, `stock negativo en ${movs[i - 1].fecha}`);
  }
});

test("semilla: estado de ejemplo útil para la demo", () => {
  assert.deepEqual(e.producciones.map((p) => [p.codigo, p.estado]),
    [["INICIAL", "cerrada"], ["1 OCT 26", "cerrada"], ["1 NOV 26", "cerrada"], ["2 NOV 26", "planificada"]]);
  assert.ok(e.compras.some((c) => c.estado === "pendiente"));
  assert.ok(e.ventas.length >= 25);
  assert.ok(e.ventas.some((v) => v.tipo === "pago_con_packs"));
  assert.deepEqual(e.cierres.map((c) => c.mes), ["2026-10"]);
  assert.equal(e.clientes.length, 8);
});

test("semilla: toda venta de ingreso tiene cobros por su total", () => {
  for (const v of e.ventas.filter(esIngreso)) {
    assert.equal(e.cobros.filter((c) => c.ventaId === v.id).reduce((a, c) => a + c.monto, 0), totalVenta(v), `venta ${v.id}`);
  }
});
