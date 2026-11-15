import test from "node:test";
import assert from "node:assert/strict";
import { codigoLote, costoPackEnProduccion, listaSuper, recetarioEscalado, siguienteNumero, tomarSnapshot, versionVigente } from "./produccion.ts";
import type { Insumo, PackVersion, Parametros, Plato, PrecioInsumo, Produccion, Proveedor, Unidad } from "./types.ts";

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

const proveedores: Proveedor[] = [
  { id: 1, nombre: "Súper", orden: 1 }, { id: 2, nombre: "Vegetales", orden: 2 }, { id: 3, nombre: "Belén", orden: 3 },
];
const ins = (id: number, nombre: string, unidad: Unidad, contenido: number, proveedorId: number, extra: Partial<Insumo> = {}): Insumo =>
  ({ id, nombre, unidad, contenido, proveedorId, activo: true, ...extra });
const insumos: Insumo[] = [
  ins(1, "Ravioles", "g", 2000, 1), ins(2, "Leche", "ml", 1000, 1), ins(3, "Zapallo", "g", 1000, 2),
  ins(4, "Calabaza", "g", 1000, 2), ins(5, "Pimiento rojo", "g", 1000, 2), ins(6, "Pimiento verde", "g", 1000, 2),
  ins(7, "Aceite", "ml", 1500, 1), ins(8, "Bandeja", "u", 1, 1, { esEnvase: "bandeja" }), ins(9, "Sticker", "u", 1, 3, { esEnvase: "sticker" }),
  ins(10, "Calabaza/zapallo", "g", 1, 2, { compuesto: { regla: "maximo", insumoIds: [3, 4] } }),
  ins(11, "Pimiento (50/50)", "g", 1, 2, { compuesto: { regla: "promedio", insumoIds: [5, 6] } }),
];
const precio = (insumoId: number, precioEnvase: number, fecha = "2026-11-01"): PrecioInsumo => ({ id: insumoId * 100, insumoId, fecha, precioEnvase });
const precios: PrecioInsumo[] = [precio(1, 10700), precio(2, 1550), precio(3, 1800), precio(4, 2500), precio(5, 3000),
  precio(6, 2000), precio(7, 4800), precio(8, 750), precio(9, 1500)];
const l = (insumoId: number, cantidad: number, unidad: Unidad = "g") => ({ insumoId, cantidad, unidad, porciones: 1 });
const platos: Plato[] = [
  { id: 1, nombre: "Ravioles con Queso Azul", receta: [l(1, 320), l(2, 60, "ml")] },
  { id: 2, nombre: "Canelones de Calabaza", receta: [l(10, 190), l(2, 300, "ml")] },
  { id: 3, nombre: "Ravioles con Morrones", receta: [l(1, 320), l(11, 150)] },
];
const versiones: PackVersion[] = [
  { id: 1, packId: 1, desde: "2026-10-01", menus: [{ numero: 1, platoId: 1 }, { numero: 4, platoId: 2 }] },
  { id: 5, packId: 5, desde: "2026-10-01", menus: [{ numero: 21, platoId: 2 }, { numero: 23, platoId: 3 }] },
];
const params: Parametros = { precioPack: 45000, aceiteMlPorPack: 20, aceiteInsumoId: 7, bandejasPorPack: 5, stickersPorPack: 1,
  indirectoReferencia: 1000, mesesRegular: 2, diasRecontacto: 30, alertaSubaPrecio: 0.15 };

function produccion(lineas: { packId: number; planificada: number }[], over: Partial<Produccion> = {}): Produccion {
  return { id: 1, codigo: "1 NOV 26", numero: 1, estado: "planificada", inicio: "2026-11-03", lineas,
    snapshot: tomarSnapshot(lineas.map((x) => x.packId), versiones, platos, insumos, precios, params, "2026-11-03"),
    costosPagados: {}, sobrantes: {}, ...over };
}

test("codigoLote: 1 NOV 26", () => {
  assert.equal(codigoLote(1, "2026-11-03"), "1 NOV 26");
  assert.equal(codigoLote(12, "2027-01-30"), "12 ENE 27");
});

test("siguienteNumero sigue en el mes y reinicia al cambiar de mes", () => {
  const ps = [{ numero: 2, inicio: "2026-11-01" }, { numero: 4, inicio: "2026-10-20" }] as Produccion[];
  assert.equal(siguienteNumero(ps, "2026-11-20"), 3);
  assert.equal(siguienteNumero(ps, "2026-12-01"), 1);
  assert.equal(siguienteNumero([], "2026-12-01"), 1);
});

test("snapshot congela precios, recetas y versión", () => {
  const p = produccion([{ packId: 1, planificada: 10 }]);
  const antes = costoPackEnProduccion(p, 1, insumos).estimado;
  precios.push(precio(1, 99999, "2026-11-05"));
  platos[0].receta.push(l(2, 1000, "ml"));
  versiones.push({ id: 2, packId: 1, desde: "2026-11-04", menus: [{ numero: 1, platoId: 3 }, { numero: 4, platoId: 2 }] });
  assert.equal(costoPackEnProduccion(p, 1, insumos).estimado, antes);
  precios.pop(); platos[0].receta.pop(); versiones.pop();
});

test("snapshot usa la versión con mayor desde <= fecha", () => {
  versiones.push({ id: 2, packId: 1, desde: "2026-11-04", menus: [{ numero: 1, platoId: 3 }, { numero: 4, platoId: 2 }] });
  const s = tomarSnapshot([1], versiones, platos, insumos, precios, params, "2026-11-10");
  assert.equal(s.packs[0].versionId, 2);
  assert.ok(s.platos[3] && !s.platos[1]);
  versiones.pop();
});

test("costo estimado: recetas + aceite + packaging", () => {
  const p = produccion([{ packId: 1, planificada: 10 }]);
  // ravioles 1712 + 93 + canelones 475 + 465 = 2745; aceite 64; packaging 5250
  near(costoPackEnProduccion(p, 1, insumos).estimado, 2745 + 64 + 5250);
});

test("costo real usa los precios pagados", () => {
  const p = produccion([{ packId: 1, planificada: 10 }], { costosPagados: { 1: 6 } }); // ravioles 5,35 → 6
  const c = costoPackEnProduccion(p, 1, insumos);
  near(c.real - c.estimado, 320 * (6 - 5.35));
});

test("lista de súper: 10 de cada pack, ravioles 6.400 g, por proveedor y sin envases", () => {
  const lista = listaSuper(produccion([{ packId: 1, planificada: 10 }, { packId: 5, planificada: 10 }]), insumos, proveedores);
  assert.deepEqual(lista.map((g) => g.proveedor.nombre), ["Súper", "Vegetales"]);
  const rav = lista[0].items.find((i) => i.nombre === "Ravioles")!;
  assert.equal(rav.cantidad, 6400);
  near(rav.total, 6400 * 5.35);
  assert.ok(!lista.flatMap((g) => g.items).some((i) => i.nombre === "Bandeja" || i.nombre === "Sticker"));
});

test("lista de súper: compuesto promedio se reparte, máximo va al más caro", () => {
  const lista = listaSuper(produccion([{ packId: 1, planificada: 10 }, { packId: 5, planificada: 10 }]), insumos, proveedores);
  const veg = lista.find((g) => g.proveedor.nombre === "Vegetales")!.items;
  assert.equal(veg.find((i) => i.nombre === "Calabaza")!.cantidad, 3800); // 190 × 20
  assert.equal(veg.find((i) => i.nombre === "Zapallo"), undefined);
  assert.equal(veg.find((i) => i.nombre === "Pimiento rojo")!.cantidad, 750); // 150 × 10 / 2
  assert.equal(veg.find((i) => i.nombre === "Pimiento verde")!.cantidad, 750);
});

test("lista de súper resta sobrantes (sin bajar de 0)", () => {
  const lista = listaSuper(produccion([{ packId: 1, planificada: 10 }], { sobrantes: { 1: 1000, 2: 99999 } }), insumos, proveedores);
  const super_ = lista.find((g) => g.proveedor.nombre === "Súper")!;
  assert.equal(super_.items.find((i) => i.nombre === "Ravioles")!.cantidad, 2200);
  assert.equal(super_.items.find((i) => i.nombre === "Leche"), undefined);
});

test("recetario: Canelones en pack 1 (×10) y pack 5 (×5) → totalCombinado 15", () => {
  const r = recetarioEscalado(produccion([{ packId: 1, planificada: 10 }, { packId: 5, planificada: 5 }]), insumos);
  const can1 = r.find((p) => p.packId === 1)!.menus.find((m) => m.numero === 4)!;
  assert.equal(can1.ingredientes.find((i) => i.nombre === "Calabaza/zapallo")!.cantidad, 1900);
  assert.deepEqual(can1.compartidoCon, { packId: 5, cantidad: 5 });
  assert.equal(can1.totalCombinado, 15);
  const rav = r.find((p) => p.packId === 1)!.menus.find((m) => m.numero === 1)!;
  assert.equal(rav.compartidoCon, undefined);
});

test("versionVigente: con dos versiones de la misma fecha gana la de id mayor (snapshot y catálogo coinciden)", () => {
  versiones.push({ id: 7, packId: 1, desde: "2026-10-01", menus: [{ numero: 1, platoId: 3 }, { numero: 4, platoId: 2 }] });
  assert.equal(versionVigente(versiones, 1, "2026-11-03")?.id, 7);
  assert.equal(tomarSnapshot([1], versiones, platos, insumos, precios, params, "2026-11-03").packs[0].versionId, 7);
  versiones.pop();
});
