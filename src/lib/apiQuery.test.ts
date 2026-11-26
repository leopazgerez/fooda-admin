import test from "node:test";
import assert from "node:assert/strict";
import { toSearchParams, collectAll, errorInfo, firesWriteEvent } from "./apiQuery.ts";

test("toSearchParams: page, size, sort, dir y params no vacíos", () => {
  assert.equal(
    toSearchParams({ page: 1, size: 200, sort: "name", dir: "desc", params: { customerId: 7, from: "", to: undefined } }).toString(),
    "page=1&size=200&sort=name&dir=desc&customerId=7",
  );
});

function pager(total: number, size = 200) {
  const calls: number[] = [];
  const fetchPage = (page: number) => {
    calls.push(page);
    const start = page * size;
    const items = Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => start + i);
    return Promise.resolve({ items, total });
  };
  return { calls, fetchPage };
}

test("collectAll: lista vacía → [] con una sola llamada", async () => {
  const p = pager(0);
  assert.deepEqual(await collectAll(p.fetchPage), []);
  assert.deepEqual(p.calls, [0]);
});

test("collectAll: total múltiplo exacto del tamaño no pide una página de más", async () => {
  const p = pager(400);
  assert.equal((await collectAll(p.fetchPage)).length, 400);
  assert.deepEqual(p.calls, [0, 1]);
});

test("collectAll: total no múltiplo junta todo", async () => {
  const p = pager(250);
  assert.equal((await collectAll(p.fetchPage)).length, 250);
  assert.deepEqual(p.calls, [0, 1]);
});

test("collectAll: una página vacía corta aunque total diga más", async () => {
  const calls: number[] = [];
  const out = await collectAll((page) => { calls.push(page); return Promise.resolve({ items: page === 0 ? [1] : [], total: 5 }); });
  assert.deepEqual(out, [1]);
  assert.deepEqual(calls, [0, 1]);
});

test("errorInfo: forma de la API {message, status, timestamp, field}", () => {
  assert.deepEqual(errorInfo(409, { message: "Ese mes está cerrado", status: 409, timestamp: "2026-11-26T12:00:00Z", field: "date" }),
    { message: "Ese mes está cerrado", field: "date" });
  assert.equal(errorInfo(502, "<html>").message, "HTTP 502");
});

test("firesWriteEvent: escrituras de datos sí; GET y /auth/ no (el logout no debe recargar las vistas)", () => {
  assert.equal(firesWriteEvent("POST", "/sales"), true);
  assert.equal(firesWriteEvent("GET", "/sales"), false);
  assert.equal(firesWriteEvent("POST", "/auth/logout"), false);
  assert.equal(firesWriteEvent("POST", "/auth/login"), false);
});

test("collectAll: una alta entre páginas corre los offsets; la fila repetida aparece una sola vez", async () => {
  // página 0 = ids 3,2 · se crea el 4 · página 1 = ids 2,1 (el 2 se repite)
  const paginas = [[{ id: 3 }, { id: 2 }], [{ id: 2 }, { id: 1 }], []];
  const out = await collectAll((page) => Promise.resolve({ items: paginas[page], total: 4 }));
  assert.deepEqual(out.map((x) => x.id), [3, 2, 1]);
});
