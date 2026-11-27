import test from "node:test";
import assert from "node:assert/strict";
import { ALERTA_SEDE, etiqueta, TIPO_VENTA } from "./etiquetas.ts";

test("etiqueta: texto en español, el código si no está, — si es vacío", () => {
  assert.equal(etiqueta(TIPO_VENTA, "retail"), "Minorista");
  assert.equal(etiqueta(TIPO_VENTA, "nuevo_tipo"), "nuevo_tipo");
  assert.equal(etiqueta(TIPO_VENTA, null), "—");
});

test("etiqueta: no distingue mayúsculas (/dashboard manda LOW_STOCK, PLANNED)", () => {
  assert.equal(etiqueta(ALERTA_SEDE, "LOW_STOCK"), "Stock bajo");
  assert.equal(etiqueta(ALERTA_SEDE, "free_slots"), "Hay lugar para un viaje");
});
