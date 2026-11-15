import { test } from "node:test";
import assert from "node:assert/strict";
import { crearBloqueo } from "./scrollLock.ts";

test("dos paneles superpuestos que se cierran en orden de apertura devuelven el scroll", () => {
  const style = { overflow: "" };
  const bloquear = crearBloqueo(style);
  const liberarDetalle = bloquear();
  const liberarForm = bloquear(); // se abre la edición mientras el detalle todavía sale
  assert.equal(style.overflow, "hidden");
  liberarDetalle();
  assert.equal(style.overflow, "hidden");
  liberarForm();
  assert.equal(style.overflow, "");
});

test("respeta el overflow que había antes y liberar dos veces no descuenta de más", () => {
  const style = { overflow: "auto" };
  const bloquear = crearBloqueo(style);
  const a = bloquear();
  const b = bloquear();
  a();
  a();
  assert.equal(style.overflow, "hidden");
  b();
  assert.equal(style.overflow, "auto");
});
