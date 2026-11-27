import { test } from "node:test";
import assert from "node:assert/strict";
import { ancho, apilar, elegido, escala, etiquetaPeriodo, fechaParaFiltro, nombresUnicos, variacion } from "./analisis.ts";

test("escala vacía es cero y no da anchos", () => {
  assert.deepEqual(escala([]), { max: 0, min: 0 });
  assert.equal(ancho(5, escala([])), 0);
});

test("los negativos se miden contra el mínimo", () => {
  const e = escala([100, -50]);
  assert.deepEqual(e, { max: 100, min: -50 });
  assert.equal(ancho(-50, e), 50);
  assert.equal(ancho(50, e), 50);
  assert.equal(ancho(-25, e), 25);
});

test("escala solo positiva deja el mínimo en cero", () => {
  assert.deepEqual(escala([3, 7]), { max: 7, min: 0 });
  assert.equal(ancho(7, escala([3, 7])), 100);
});

test("variación contra el período anterior", () => {
  assert.equal(variacion(120, 100), 0.2);
  assert.equal(variacion(5, 0), null);
  assert.equal(variacion(-50, -100), 0.5); // la pérdida se achicó: mejora
});

test("apilar suma por fila y conserva el orden de aparición", () => {
  const filas = [
    { f: "nov", s: "A", v: 2 }, { f: "oct", s: "B", v: 1 }, { f: "nov", s: "B", v: 3 }, { f: "nov", s: "A", v: 1 },
  ];
  assert.deepEqual(apilar(filas, (x) => x.f, (x) => x.s, (x) => x.v), [
    { etiqueta: "nov", total: 6, segmentos: [{ clave: "A", valor: 3 }, { clave: "B", valor: 3 }] },
    { etiqueta: "oct", total: 1, segmentos: [{ clave: "B", valor: 1 }] },
  ]);
});

test("etiqueta de período mensual y semanal", () => {
  assert.equal(etiquetaPeriodo("2026-11", false), "nov 2026");
  assert.equal(etiquetaPeriodo("2026-11-23", true), "sem. 23/11");
});

test("una selección que ya no está entre las opciones vuelve a la primera", () => {
  assert.equal(elegido(2, [1, 3]), 1);
  assert.equal(elegido(3, [1, 3]), 3);
  assert.equal(elegido(null, [1, 3]), 1);
  assert.equal(elegido(2, []), null);
});

test("nombres repetidos se distinguen por id; los únicos quedan igual", () => {
  const m = nombresUnicos([[1, "Caserito"], [2, "Proteico"], [3, "Caserito"], [1, "Caserito"]]);
  assert.equal(m.get(1), "Caserito #1");
  assert.equal(m.get(3), "Caserito #3");
  assert.equal(m.get(2), "Proteico");
});

test("solo una fecha completa o vacía llega al filtro", () => {
  assert.equal(fechaParaFiltro(""), "");
  assert.equal(fechaParaFiltro("2026-11-03"), "2026-11-03");
  assert.equal(fechaParaFiltro("0002-11-03"), null); // año a medio escribir
  assert.equal(fechaParaFiltro("2026-11"), null);
});
