import test from "node:test";
import assert from "node:assert/strict";
import { listar } from "./query.ts";
import { encodeFilter, toSearchParams, type ListQuery } from "../apiQuery.ts";

interface Row { id: number; nombre: string; fecha: string; tipo: string; monto: number; nota?: string }
const rows: Row[] = [
  { id: 1, nombre: "Lucía Fernández", fecha: "2026-11-01", tipo: "a", monto: 10 },
  { id: 2, nombre: "Juan Pablo", fecha: "2026-11-05", tipo: "b", monto: 30, nota: "x" },
  { id: 3, nombre: "Lucas", fecha: "2026-10-20", tipo: "c", monto: 20 },
];
const q = (lq: ListQuery) => toSearchParams(lq);
const opts = { buscarEn: ["nombre"] as (keyof Row)[], ordenPorDefecto: "id" as keyof Row };

test("búsqueda sin tildes ni mayúsculas", () => {
  assert.deepEqual(listar(rows, q({ search: "LUCIA" }), opts).data.map((r) => r.id), [1]);
});

test("filtros IN, BETWEEN, IS_NULL y GREATER_OR_EQUAL", () => {
  assert.deepEqual(listar(rows, q({ filters: [{ field: "tipo", operator: "IN", value: ["a", "c"] }] }), opts).data.map((r) => r.id), [1, 3]);
  assert.deepEqual(listar(rows, q({ filters: [{ field: "fecha", operator: "BETWEEN", value: ["2026-11-01", "2026-11-30"] }] }), opts).data.map((r) => r.id), [1, 2]);
  assert.deepEqual(listar(rows, q({ filters: [{ field: "nota", operator: "IS_NULL" }] }), opts).data.map((r) => r.id), [1, 3]);
  assert.deepEqual(listar(rows, q({ filters: [{ field: "monto", operator: "GREATER_OR_EQUAL", value: 20 }] }), opts).data.map((r) => r.id), [2, 3]);
  assert.ok(encodeFilter([]) === undefined);
});

test("orden y paginación con cursor", () => {
  const p1 = listar(rows, q({ sortBy: "monto", sortDir: "desc", length: 2 }), opts);
  assert.deepEqual(p1.data.map((r) => r.id), [2, 3]);
  assert.equal(p1.total, 3);
  assert.equal(p1.prevCursor, null);
  const p2 = listar(rows, q({ sortBy: "monto", sortDir: "desc", length: 2, cursor: p1.nextCursor! }), opts);
  assert.deepEqual(p2.data.map((r) => r.id), [1]);
  assert.equal(p2.nextCursor, null);
  assert.equal(p2.prevCursor, "0");
});

test("página anterior: before (sin cursor) vuelve a la página previa, no a la primera", () => {
  const p3 = listar(rows, q({ length: 1, cursor: "2" }), opts);
  assert.equal(p3.prevCursor, "1");
  const p2 = listar(rows, q({ length: 1, before: p3.prevCursor! }), opts);
  assert.deepEqual(p2.data.map((r) => r.id), [2]);
});

test("empates del orden se resuelven por id en la misma dirección (lo último cargado primero en desc)", () => {
  const mismos: Row[] = [{ id: 1, nombre: "a", fecha: "2026-11-15", tipo: "a", monto: 1 }, { id: 2, nombre: "b", fecha: "2026-11-15", tipo: "a", monto: 1 }];
  assert.deepEqual(listar(mismos, q({ sortBy: "fecha", sortDir: "desc" }), opts).data.map((r) => r.id), [2, 1]);
  assert.deepEqual(listar(mismos, q({ sortBy: "fecha", sortDir: "asc" }), opts).data.map((r) => r.id), [1, 2]);
});
