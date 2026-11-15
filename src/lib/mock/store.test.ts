import test from "node:test";
import assert from "node:assert/strict";
import { CLAVE, cargar, guardar, nuevoId, restaurar, storageNavegador } from "./store.ts";

function memoria() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

test("sin storage, storage que lanza o JSON corrupto → semilla", () => {
  assert.ok(cargar().seq > 0);
  const roto = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
  assert.ok(cargar(roto).seq > 0);
  guardar(cargar(), roto); // no lanza
  const s = memoria();
  s.setItem(CLAVE, "{no es json");
  assert.ok(cargar(s).seq > 0);
  s.setItem(CLAVE, JSON.stringify({ algo: 1 }));
  assert.ok(cargar(s).insumos.length > 0);
});

test("guardar y cargar ida y vuelta; restaurar vuelve a la semilla", () => {
  const s = memoria();
  const e = cargar(s);
  const id = nuevoId(e);
  assert.equal(e.seq, id + 1);
  e.clientes.push({ id, nombre: "Nuevo", apellido: "Cliente" });
  guardar(e, s);
  assert.ok(cargar(s).clientes.some((c) => c.id === id));
  assert.ok(!restaurar(s).clientes.some((c) => c.id === id));
  assert.ok(!cargar(s).clientes.some((c) => c.id === id));
});

test("storageNavegador: si leer localStorage lanza (cookies bloqueadas) devuelve undefined", () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
  try {
    assert.equal(storageNavegador(), undefined);
    assert.ok(cargar(storageNavegador()).seq > 0);
  } finally {
    if (desc) Object.defineProperty(globalThis, "localStorage", desc); else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
