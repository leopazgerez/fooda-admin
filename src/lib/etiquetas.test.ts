import test from "node:test";
import assert from "node:assert/strict";
import { etiqueta, TIPO_VENTA } from "./etiquetas.ts";

test("etiqueta: texto en español, el código si no está, — si es vacío", () => {
  assert.equal(etiqueta(TIPO_VENTA, "retail"), "Minorista");
  assert.equal(etiqueta(TIPO_VENTA, "nuevo_tipo"), "nuevo_tipo");
  assert.equal(etiqueta(TIPO_VENTA, null), "—");
});
