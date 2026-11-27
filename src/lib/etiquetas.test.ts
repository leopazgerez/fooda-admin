import test from "node:test";
import assert from "node:assert/strict";
import { ALERTA_SEDE, ESTADO_PRODUCCION, etiqueta, mapaDe, opcionesDe } from "./etiquetas.ts";

test("etiqueta: texto en español, el código si no está, — si es vacío", () => {
  assert.equal(etiqueta(ESTADO_PRODUCCION, "planned"), "Planificada");
  assert.equal(etiqueta(ESTADO_PRODUCCION, "nuevo_tipo"), "nuevo_tipo");
  assert.equal(etiqueta(ESTADO_PRODUCCION, null), "—");
});

test("etiqueta: no distingue mayúsculas (/dashboard manda LOW_STOCK, PLANNED)", () => {
  assert.equal(etiqueta(ALERTA_SEDE, "LOW_STOCK"), "Stock bajo");
  assert.equal(etiqueta(ALERTA_SEDE, "free_slots"), "Hay lugar para un viaje");
});

const ITEMS = [
  { code: "transfer", name: "Transferencia", active: true },
  { code: "cash", name: "Efectivo", active: false },
  { code: "packs", name: "Packs", active: true },
];

test("mapaDe: nombre por código, para etiqueta()", () => {
  assert.equal(etiqueta(mapaDe(ITEMS), "cash"), "Efectivo");
  assert.equal(etiqueta(mapaDe([]), "cash"), "cash");
});

test("opcionesDe: activas en el orden de la API, sin las excluidas; la actual aunque esté inactiva", () => {
  assert.deepEqual(opcionesDe(ITEMS, { sin: ["packs"] }), [{ value: "transfer", label: "Transferencia" }]);
  assert.deepEqual(opcionesDe(ITEMS, { sin: ["packs"], actual: "cash" }),
    [{ value: "transfer", label: "Transferencia" }, { value: "cash", label: "Efectivo" }]);
});

test("opcionesDe: mientras la lista carga, la actual queda con su código", () => {
  assert.deepEqual(opcionesDe([], { actual: "g" }), [{ value: "g", label: "g" }]);
  assert.deepEqual(opcionesDe([]), []);
});
