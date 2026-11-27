import test from "node:test";
import assert from "node:assert/strict";
import { armarLista, cantidad, cargarPorId, grupoDeCompra, nombreArchivo, pendientes, textoLista, unaALaVez } from "./listaSuper.ts";

const g = (over = {}) => ({ supplierId: 3, supplier: "Cofruthos", purchaseId: 11, status: "pending", total: 23200.4, totalInPacks: 1.234,
  items: [
    { supplyId: 1, name: "Zanahoria", quantity: 4500, unit: "g", unitCost: 2, total: 9000 },
    { supplyId: 2, name: "Champiñones", quantity: 1000, unit: "g", unitCost: 13.9, total: 13913.04347826087 },
    { supplyId: 3, name: "Harina", quantity: 1125, unit: "g", unitCost: 0, total: 0 },
  ], ...over });
const prod = { code: "1 NOV 26", start: "2026-11-30" };

test("cantidad: kg/l desde 1000 con hasta 2 decimales; g/ml debajo; u tal cual", () => {
  assert.equal(cantidad(4500, "g"), "4,5 kg");
  assert.equal(cantidad(1000, "g"), "1 kg");
  assert.equal(cantidad(1125, "g"), "1,13 kg");
  assert.equal(cantidad(999, "g"), "999 g");
  assert.equal(cantidad(1500, "ml"), "1,5 l");
  assert.equal(cantidad(250, "ml"), "250 ml");
  assert.equal(cantidad(12, "u"), "12 u");
  assert.equal(cantidad(0.5, "u"), "0,5 u");
});

test("armarLista: subtítulo, importes redondeados, sin precio, pie", () => {
  const l = armarLista(g() as never, prod);
  assert.equal(l.proveedor, "Cofruthos");
  assert.equal(l.subtitulo, "Cofruthos · Producción 1 NOV 26 · 30/11/2026");
  assert.deepEqual(l.items.map((i) => i.importe), ["$9.000", "$13.913", "sin precio"]);
  assert.deepEqual(l.items.map((i) => i.cantidad), ["4,5 kg", "1 kg", "1,13 kg"]);
  assert.equal(l.llevar, "$23.200");
  assert.equal(l.packs, "1,2");
});

test("textoLista: encabezado, casillas ☐, pie con ≈", () => {
  const t = textoLista(armarLista(g() as never, prod));
  const lineas = t.split("\n");
  assert.equal(lineas[0], "FOODA · Lista de compras");
  assert.equal(lineas[1], "Cofruthos · Producción 1 NOV 26 · 30/11/2026");
  assert.equal(lineas[2], "");
  assert.ok(lineas.includes("☐ Zanahoria — 4,5 kg — $9.000"));
  assert.ok(lineas.includes("☐ Harina — 1,13 kg — sin precio"));
  assert.equal(lineas.at(-2), "");
  assert.equal(lineas.at(-1), "Llevar ≈ $23.200 (≈ 1,2 packs)");
});

test("pendientes: solo status pending", () => {
  assert.deepEqual(pendientes([g(), g({ supplierId: 4, status: "bought" })] as never).map((x) => x.supplierId), [3]);
  assert.deepEqual(pendientes([]), []);
});

test("grupoDeCompra: por purchaseId; si no, el único pendiente de ese proveedor", () => {
  const gs = [g({ purchaseId: 11, supplierId: 3 }), g({ purchaseId: 12, supplierId: 4 })] as never;
  assert.equal(grupoDeCompra(gs, { id: 12, supplierId: 99 })?.supplierId, 4);
  assert.equal(grupoDeCompra(gs, { id: 99, supplierId: 3 })?.purchaseId, 11);
  assert.equal(grupoDeCompra(gs, { id: 99, supplierId: 99 }), undefined);
});

test("grupoDeCompra: nunca devuelve una lista ya comprada ni elige entre dos pendientes del mismo proveedor", () => {
  const comprada = [g({ purchaseId: 11, supplierId: 3, status: "bought" })] as never;
  assert.equal(grupoDeCompra(comprada, { id: 12, supplierId: 3 }), undefined);
  const dos = [g({ purchaseId: 11, supplierId: 3 }), g({ purchaseId: 13, supplierId: 3 })] as never;
  assert.equal(grupoDeCompra(dos, { id: 12, supplierId: 3 }), undefined);
});

test("armarLista: unitCost null también es sin precio", () => {
  const l = armarLista(g({ items: [{ supplyId: 9, name: "Sal", quantity: 100, unit: "g", unitCost: null, total: 0 }] }) as never, prod);
  assert.equal(l.items[0].importe, "sin precio");
});

test("nombreArchivo: minúsculas, sin acentos, guiones simples", () => {
  assert.equal(nombreArchivo("Súper", "1 NOV 26"), "super-1-nov-26");
  assert.equal(nombreArchivo("lista-super", " El Milagro / Lácteos "), "lista-super-el-milagro-lacteos");
});

test("cargarPorId: la que falla queda en null (para avisarlo) y no apaga las demás", async () => {
  const m = await cargarPorId([1, 2], (id) => (id === 1 ? Promise.reject(new Error("500")) : Promise.resolve("ok")));
  assert.equal(m.get(1), null);
  assert.equal(m.get(2), "ok");
});

test("unaALaVez: ignora los toques mientras el anterior sigue (no baja dos PDF)", async () => {
  let n = 0;
  let soltar = () => {};
  const f = unaALaVez(() => { n++; return new Promise<void>((r) => { soltar = r; }); });
  const primero = f();
  f();
  assert.equal(n, 1);
  soltar();
  await primero;
  f();
  assert.equal(n, 2);
});

test("unaALaVez: con clave, otro archivo sí se genera mientras sigue el primero", async () => {
  const hechos: string[] = [];
  const soltar: Record<string, () => void> = {};
  const f = unaALaVez((a: string) => { hechos.push(a); return new Promise<void>((r) => { soltar[a] = r; }); }, (a) => a);
  const a = f("a");
  f("a");
  const b = f("b");
  assert.deepEqual(hechos, ["a", "b"]);
  soltar.a();
  soltar.b();
  await Promise.all([a, b]);
});
