import test from "node:test";
import assert from "node:assert/strict";
import { initials, money, qty } from "./format.ts";

test("money y initials", () => {
  assert.equal(money(-1500), "-$1.500");
  assert.equal(initials("  juan  carlos pérez "), "JC");
});

test("qty pasa a Kg desde 1000 gr", () => {
  assert.equal(qty(600, "gr"), "600 gr");
  assert.equal(qty(5400, "gr"), "5,4 Kg");
  assert.equal(qty(11400, "gr"), "11,4 Kg");
  assert.equal(qty(60, "un"), "60 Unidades");
});
