import test from "node:test";
import assert from "node:assert/strict";
import { buscarClientes } from "./buscar.ts";

const cs = [
  { id: 1, nombre: "María", apellido: "Gómez", telefono: "387 512 3344" },
  { id: 2, nombre: "Juan Pablo", apellido: "Ríos" },
];

test("busca sin tildes por nombre, apellido o teléfono sin espacios", () => {
  assert.deepEqual(buscarClientes(cs, "maria").map((c) => c.id), [1]);
  assert.deepEqual(buscarClientes(cs, "GOMEZ").map((c) => c.id), [1]);
  assert.deepEqual(buscarClientes(cs, "3875123").map((c) => c.id), [1]);
  assert.deepEqual(buscarClientes(cs, "rios").map((c) => c.id), [2]);
});

test("texto vacío → []; máximo de resultados", () => {
  assert.deepEqual(buscarClientes(cs, "  "), []);
  assert.equal(buscarClientes(cs, "a", 1).length, 1);
});

test("teléfono completo con guiones o espacios en cualquiera de los dos lados", () => {
  const conGuion = [{ id: 3, nombre: "María", apellido: "Gómez", telefono: "387 498-1120" }];
  assert.deepEqual(buscarClientes(conGuion, "3874981120").map((c) => c.id), [3]);
  assert.deepEqual(buscarClientes(conGuion, "387 498 1120").map((c) => c.id), [3]);
  assert.deepEqual(buscarClientes(conGuion, "498-1120").map((c) => c.id), [3]);
});

test("nombre con número no trae a cualquiera cuyo teléfono tenga ese dígito", () => {
  const xs = [{ id: 1, nombre: "Ana", apellido: "Paz", telefono: "111" }, { id: 2, nombre: "Pedro", apellido: "Gómez", telefono: "3872" }];
  assert.deepEqual(buscarClientes(xs, "Ana 2").map((c) => c.id), []);
  assert.deepEqual(buscarClientes(xs, "387-2").map((c) => c.id), [2]);
});
