import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Contraste WCAG de los tokens de globals.css: si alguien cambia un color y el texto deja de leerse, falla.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const tok = (nombre: string) => {
  const m = root.match(new RegExp(`--${nombre}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(m, `falta el token --${nombre}`);
  return m[1];
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [lo, hi] = [lum(a), lum(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
};

test("texto blanco sobre el rosa de los botones cumple AA", () => assert.ok(ratio("#FFFFFF", tok("accent")) >= 4.5));
test("texto secundario sobre crema cumple AA", () => assert.ok(ratio(tok("text-secondary"), tok("app-bg")) >= 4.5));
test("texto secundario sobre tarjetas cumple AA", () => assert.ok(ratio(tok("text-secondary"), tok("surface")) >= 4.5));
test("texto de la barra lateral sobre negro cumple AA", () => assert.ok(ratio(tok("sidebar-text"), tok("sidebar-bg")) >= 4.5));
test("el rojo de error y el rosa se distinguen", () => assert.notEqual(tok("danger").toLowerCase(), tok("accent").toLowerCase()));
