import test from "node:test";
import assert from "node:assert/strict";
import { costoLinea, costoPack, costoPlato, costosVigentes, costoUnitario } from "./costos.ts";
import type { Insumo, Parametros, Plato, PrecioInsumo, Unidad } from "./types.ts";

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

// [id, nombre, unidad, precioEnvase, contenido, extra]
const filas: [number, string, Unidad, number, number, Partial<Insumo>?][] = [
  [1, "Ravioles", "g", 10700, 2000],
  [2, "Queso crema", "g", 7000, 1000],
  [3, "Queso azul", "g", 19200, 1000],
  [4, "Leche", "ml", 1550, 1000],
  [5, "Queso sardo", "g", 9900, 1000],
  [6, "Maicena", "g", 4500, 1000],
  [7, "Nueces", "g", 1400, 100],
  [8, "Huevo", "u", 5000, 30],
  [9, "Harina", "g", 0, 1000],
  [10, "Manteca", "g", 9900, 1000],
  [11, "Zapallo", "g", 1800, 1000],
  [12, "Calabaza", "g", 2500, 1000],
  [13, "Quinoa", "g", 7000, 1000],
  [14, "Muzzarella", "g", 7400, 1000],
  [15, "Cebolla", "g", 12000, 10000],
  [16, "Pimiento rojo", "g", 3000, 1000],
  [17, "Pimiento verde", "g", 2000, 1000],
  [18, "Repollo morado", "g", 2500, 1000, { gramosPorUnidad: 1000 }],
  [19, "Aceite", "ml", 4800, 1500],
  [20, "Salsa de tomate", "g", 12100, 2900],
  [21, "Pollo", "g", 9500, 1000],
  [30, "Pimiento (50% rojo + 50% verde)", "g", 0, 1, { compuesto: { regla: "promedio", insumoIds: [16, 17] } }],
  [31, "Calabaza/zapallo", "g", 0, 1, { compuesto: { regla: "maximo", insumoIds: [11, 12] } }],
];
const insumos: Insumo[] = filas.map(([id, nombre, unidad, , contenido, extra]) =>
  ({ id, nombre, unidad, contenido, proveedorId: 1, activo: true, ...extra }));
const precios: PrecioInsumo[] = filas.filter((f) => !f[5]?.compuesto)
  .map(([id, , , precioEnvase]) => ({ id, insumoId: id, fecha: "2026-11-01", precioEnvase }));
const byId = (id: number) => insumos.find((i) => i.id === id)!;
const costos = costosVigentes(insumos, precios);

const l = (insumoId: number, cantidad: number, unidad: Unidad = "g") => ({ insumoId, cantidad, unidad, porciones: 1 });
const ravioles: Plato = { id: 1, nombre: "Ravioles con Queso Azul y Nueces", receta: [
  l(1, 320), l(2, 30), l(3, 25), l(4, 60, "ml"), l(5, 35), l(6, 10), l(7, 20)] };
const canelones: Plato = { id: 4, nombre: "Canelones de Crema de Calabaza", receta: [
  l(4, 112.5, "ml"), l(8, 0.45, "u"), l(9, 56.25), l(10, 1.125), l(31, 190), l(13, 70), l(14, 50),
  l(15, 40), l(4, 300, "ml"), l(8, 1, "u"), l(10, 80), l(6, 30)] };

test("costoUnitario = precio envase / contenido (salsa 4,1724)", () => {
  near(costoUnitario(byId(20), precios, insumos), 4.1724, 0.0001);
});

test("costoUnitario usa el último precio con fecha <= hasta", () => {
  const ps: PrecioInsumo[] = [
    { id: 1, insumoId: 21, fecha: "2026-10-01", precioEnvase: 9000 },
    { id: 2, insumoId: 21, fecha: "2026-11-10", precioEnvase: 9500 },
  ];
  assert.equal(costoUnitario(byId(21), ps, insumos, "2026-11-01"), 9);
  assert.equal(costoUnitario(byId(21), ps, insumos), 9.5);
});

test("sin precio cargado el costo es 0", () => {
  assert.equal(costoUnitario(byId(21), [], insumos), 0);
});

test("compuestos: pimiento promedio 2,5 y calabaza máximo 2,5", () => {
  assert.equal(costos[30], 2.5);
  assert.equal(costos[31], 2.5);
});

test("repollo morado: 60 g → 150; 0,25 u → 625", () => {
  near(costoLinea(l(18, 60), costos, insumos), 150);
  near(costoLinea(l(18, 0.25, "u"), costos, insumos), 625);
});

test("costoLinea multiplica por porciones", () => {
  near(costoLinea({ insumoId: 8, cantidad: 2, unidad: "u", porciones: 2 }, costos, insumos), 666.67);
});

test("plato Ravioles con Queso Azul y Nueces = 3.166,50", () => {
  near(costoPlato(ravioles, costos, insumos), 3166.5);
});

test("plato Canelones (4/21) = 3.202,18", () => {
  near(costoPlato(canelones, costos, insumos), 3202.18);
});

test("costoPack suma recetas + aceite 20 ml ($64) + packaging 5×750 + 1×1.500", () => {
  const params = { aceiteMlPorPack: 20, aceiteInsumoId: 19, bandejasPorPack: 5, stickersPorPack: 1 } as Parametros;
  const c = costoPack([{ numero: 1, platoId: 1 }, { numero: 4, platoId: 4 }], { 1: ravioles, 4: canelones },
    costos, insumos, params, { bandeja: 750, sticker: 1500 });
  near(c.recetas, 6368.68);
  near(c.aceite, 64);
  assert.equal(c.packaging, 5250);
  near(c.directo, 6368.68 + 64 + 5250);
});
