import test from "node:test";
import assert from "node:assert/strict";
import { insumosSobrantes, mapaSobrantes } from "./sobrantes.ts";

test("insumosSobrantes: une la lista y los sobrantes cargados, sin repetir, por nombre", () => {
  const lista = [{ items: [{ supplyId: 2, name: "Zanahoria", unit: "g" }, { supplyId: 1, name: "Arroz", unit: "g" }] },
                 { items: [{ supplyId: 2, name: "Zanahoria", unit: "g" }] }];
  const insumos = [{ id: 9, name: "Lenteja", unit: "g" }];
  assert.deepEqual(insumosSobrantes(lista, { "9": 500 }, insumos).map((i) => i.supplyId), [1, 9, 2]);
});

test("insumosSobrantes: un sobrante de un insumo desconocido igual aparece con su id", () => {
  assert.deepEqual(insumosSobrantes([], { "7": 1 }, []), [{ supplyId: 7, nombre: "Insumo 7", unit: "" }]);
});

test("mapaSobrantes: conserva los no tocados, aplica cambios y quita 0/vacío/inválido", () => {
  assert.deepEqual(mapaSobrantes({ "1": 100, "2": 200, "3": 300 }, { 2: "250", 3: "0", 4: "50" }), { "1": 100, "2": 250, "4": 50 });
  assert.deepEqual(mapaSobrantes({ "1": 100 }, { 1: "" }), {});
  assert.deepEqual(mapaSobrantes({ "1": 100 }, { 1: "abc" }), {});
  assert.deepEqual(mapaSobrantes({ "1": 100 }, { 1: "-5" }), {});
});
