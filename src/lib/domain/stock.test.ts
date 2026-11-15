import test from "node:test";
import assert from "node:assert/strict";
import { alertasSede, disponible, stockActual, validarSalidas } from "./stock.ts";
import type { MovimientoStock, Sede } from "./types.ts";

let n = 0;
const mov = (sedeId: number, produccionId: number, packId: number, cantidad: number, tipo: MovimientoStock["tipo"] = "produccion"): MovimientoStock =>
  ({ id: ++n, fecha: "2026-11-04", sedeId, produccionId, packId, cantidad, tipo });

const movs = [
  mov(1, 2, 1, 10), mov(1, 1, 1, 10), mov(1, 1, 1, -4, "traslado_salida"), mov(2, 1, 1, 4, "traslado_entrada"),
  mov(2, 1, 1, -1, "venta"), mov(1, 1, 2, 5), mov(1, 1, 2, -5, "venta"),
];

test("stockActual suma por sede × producción × pack, omite ceros y ordena FIFO", () => {
  assert.deepEqual(stockActual(movs), [
    { sedeId: 1, produccionId: 1, packId: 1, cantidad: 6 },
    { sedeId: 2, produccionId: 1, packId: 1, cantidad: 3 },
    { sedeId: 1, produccionId: 2, packId: 1, cantidad: 10 },
  ]);
});

test("disponible por sede, producción y pack", () => {
  assert.equal(disponible(movs, 2, 1, 1), 3);
  assert.equal(disponible(movs, 1, 1, 2), 0);
});

test("validarSalidas: dos líneas iguales que juntas superan el stock", () => {
  const lineas = [{ produccionId: 1, packId: 1, cantidad: 2 }, { produccionId: 1, packId: 1, cantidad: 2 }];
  assert.deepEqual(validarSalidas(movs, 2, lineas), { produccionId: 1, packId: 1, disponible: 3, pedido: 4 });
  assert.equal(validarSalidas(movs, 2, [{ produccionId: 1, packId: 1, cantidad: 3 }]), null);
});

test("validarSalidas rechaza cantidades no positivas o no enteras", () => {
  assert.notEqual(validarSalidas(movs, 1, [{ produccionId: 1, packId: 1, cantidad: 0 }]), null);
  assert.notEqual(validarSalidas(movs, 1, [{ produccionId: 1, packId: 1, cantidad: 1.5 }]), null);
});

const sede = { capacidad: 60, umbralStock: 8, umbralLugaresLibres: 20 } as Sede;
test("alertasSede: stock bajo y lugar libre", () => {
  assert.deepEqual(alertasSede(sede, 5), ["stock_bajo", "lugar_libre"]);
  assert.deepEqual(alertasSede(sede, 30), ["lugar_libre"]);
  assert.deepEqual(alertasSede(sede, 50), []);
});
