import test from "node:test";
import assert from "node:assert/strict";
import { crearServidor } from "./server.ts";

function memoria() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}
const nuevo = (storage = memoria()) => crearServidor({ storage, hoy: () => "2026-11-15" });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const data = (r: { body?: unknown }) => (r.body as { data: Any }).data;

test("login: credenciales buenas 200, malas 401; /auth/me", async () => {
  const s = nuevo();
  const ok = await s.handle("POST", "/auth/login", undefined, { email: "admin@fooda.com", password: "demo" });
  assert.equal(ok.status, 200);
  assert.equal((ok.body as Any).accessToken, "mock");
  assert.equal((await s.handle("POST", "/auth/login", undefined, { email: "x", password: "y" })).status, 401);
  assert.equal(data(await s.handle("GET", "/auth/me")).email, "admin@fooda.com");
});

test("rutas desconocidas → 404", async () => {
  assert.equal((await nuevo().handle("GET", "/no-existe")).status, 404);
});

async function planificar(s: ReturnType<typeof nuevo>, cantidad = 10) {
  const packs = data(await s.handle("GET", "/packs")) as Any[];
  const r = await s.handle("POST", "/producciones", undefined, { lineas: packs.map((p) => ({ packId: p.id, planificada: cantidad })) });
  return { r, packs, prod: data(r) };
}

test("nueva producción: código 3 NOV 26 y compras pendientes por proveedor", async () => {
  const s = nuevo();
  const { r, prod } = await planificar(s);
  assert.equal(r.status, 201);
  assert.equal(prod.codigo, "3 NOV 26");
  const compras = (await s.handle("GET", "/compras", new URLSearchParams({ length: "200" }))).body as Any;
  const mias = compras.data.filter((c: Any) => c.produccionId === prod.id);
  assert.ok(mias.length >= 5 && mias.every((c: Any) => c.estado === "pendiente"));
  assert.equal((await s.handle("POST", "/producciones", undefined, { lineas: [] })).status, 400);
});

test("cerrar producción: reparto mayor al real → 400 y sigue planificada; cierre correcto suma stock", async () => {
  const s = nuevo();
  const { prod, packs } = await planificar(s);
  const sedes = data(await s.handle("GET", "/sedes")) as Any[];
  const jvg = sedes.find((x) => !x.esCocina);
  const lineas = packs.map((p) => ({ packId: p.id, real: 5 }));
  const malo = await s.handle("POST", `/producciones/${prod.id}/cerrar`, undefined,
    { fecha: "2026-11-15", lineas, reparto: [{ sedeId: jvg.id, packId: packs[0].id, cantidad: 6 }] });
  assert.equal(malo.status, 400);
  assert.equal(data(await s.handle("GET", `/producciones/${prod.id}`)).estado, "planificada");
  const neg = await s.handle("POST", `/producciones/${prod.id}/cerrar`, undefined, { fecha: "2026-11-15", lineas: [{ packId: packs[0].id, real: -1 }], reparto: [] });
  assert.equal(neg.status, 400);

  const bien = await s.handle("POST", `/producciones/${prod.id}/cerrar`, undefined,
    { fecha: "2026-11-15", lineas, reparto: [{ sedeId: jvg.id, packId: packs[0].id, cantidad: 2 }] });
  assert.equal(bien.status, 200);
  const stock = data(await s.handle("GET", "/stock", new URLSearchParams({ produccionId: String(prod.id) }))) as Any;
  const fila = (sedeId: number) => stock.filas.find((f: Any) => f.sedeId === sedeId && f.packId === packs[0].id && f.produccionId === prod.id)?.cantidad;
  assert.equal(fila(jvg.id), 2);
  assert.equal(fila(sedes.find((x) => x.esCocina).id), 3);
});

test("venta: dos líneas que juntas superan el stock → 400 sin movimientos; venta válida baja stock", async () => {
  const s = nuevo();
  const stock = data(await s.handle("GET", "/stock")) as Any;
  const f = stock.filas.find((x: Any) => x.cantidad >= 2);
  const antes = s.estado().movimientos.length;
  const linea = { produccionId: f.produccionId, packId: f.packId, cantidad: f.cantidad, precioUnitario: 45000 };
  const malo = await s.handle("POST", "/ventas", undefined, { fecha: "2026-11-15", sedeId: f.sedeId, tipo: "minorista", medio: "efectivo",
    lineas: [linea, { ...linea, cantidad: 1 }] });
  assert.equal(malo.status, 400);
  assert.equal((malo.body as Any).field, "lineas");
  assert.equal(s.estado().movimientos.length, antes);
  const ok = await s.handle("POST", "/ventas", undefined, { fecha: "2026-11-15", sedeId: f.sedeId, tipo: "minorista", medio: "efectivo",
    lineas: [{ ...linea, cantidad: 1 }] });
  assert.equal(ok.status, 201);
  const despues = (data(await s.handle("GET", "/stock")) as Any).filas
    .find((x: Any) => x.sedeId === f.sedeId && x.produccionId === f.produccionId && x.packId === f.packId);
  assert.equal(despues?.cantidad ?? 0, f.cantidad - 1);
});

test("pago con packs no cambia el resultado de caja del mes", async () => {
  const s = nuevo();
  const mes = async () => (data(await s.handle("GET", "/finanzas/mensual")) as Any[]).find((m) => m.mes === "2026-11");
  const antes = (await mes()).resultadoCaja;
  const f = (data(await s.handle("GET", "/stock")) as Any).filas.find((x: Any) => x.cantidad >= 1);
  const r = await s.handle("POST", "/ventas", undefined, { fecha: "2026-11-15", sedeId: f.sedeId, tipo: "pago_con_packs", medio: "packs",
    lineas: [{ produccionId: f.produccionId, packId: f.packId, cantidad: 1, precioUnitario: 0 }], notas: "Pago luz" });
  assert.equal(r.status, 201);
  assert.equal((await mes()).resultadoCaja, antes);
});

test("comprar con pollo +20 %: alerta de suba y costo real > estimado", async () => {
  const s = nuevo();
  const { prod } = await planificar(s);
  const compras = ((await s.handle("GET", "/compras", new URLSearchParams({ length: "200" }))).body as Any).data
    .filter((c: Any) => c.produccionId === prod.id);
  const pollo = s.estado().insumos.find((i) => i.nombre === "Pollo")!;
  const compra = compras.find((c: Any) => c.lineas.some((l: Any) => l.insumoId === pollo.id));
  const lineas = compra.lineas.map((l: Any) => (l.insumoId === pollo.id ? { ...l, precioEnvase: Math.round(l.precioEnvase * 1.2) } : l));
  const r = await s.handle("POST", `/compras/${compra.id}/comprar`, undefined, { fecha: "2026-11-15", lineas });
  assert.equal(r.status, 200);
  assert.deepEqual(data(r).alertas.map((a: Any) => a.insumoId), [pollo.id]);
  const det = data(await s.handle("GET", `/producciones/${prod.id}`));
  assert.ok(det.costoReal > det.costoEstimado);
  assert.ok(s.estado().gastos.some((g) => g.origen?.compraId === compra.id && g.tipo === "mercadería"));
});

test("nueva versión de pack no altera producciones anteriores; version-en devuelve la vieja", async () => {
  const s = nuevo();
  const prods = data(await s.handle("GET", "/producciones")) as Any[];
  const nov = prods.find((p) => p.codigo === "1 NOV 26");
  const antes = data(await s.handle("GET", `/producciones/${nov.id}`)).costoReal;
  const pack3 = (data(await s.handle("GET", "/packs")) as Any[]).find((p) => p.numero === 3);
  const v = data(await s.handle("GET", `/packs/${pack3.id}/versiones`)) as Any[];
  const platoCaro = s.estado().platos.find((p) => p.nombre.startsWith("Cerdo Teriyaki"))!;
  const menus = v[0].menus.map((m: Any, i: number) => (i === 0 ? { numero: 18, platoId: platoCaro.id } : m));
  assert.equal((await s.handle("POST", `/packs/${pack3.id}/versiones`, undefined, { desde: "2026-11-15", menus })).status, 201);
  assert.equal((await s.handle("POST", `/packs/${pack3.id}/versiones`, undefined, { desde: "2026-11-16", menus: menus.slice(1) })).status, 400);
  assert.equal(data(await s.handle("GET", `/producciones/${nov.id}`)).costoReal, antes);
  const vieja = data(await s.handle("GET", `/analisis/packs/${pack3.id}/version-en`, new URLSearchParams({ fecha: "2026-11-01" })));
  assert.equal(vieja.version.id, v[0].id);
  const nueva = data(await s.handle("GET", `/analisis/packs/${pack3.id}/version-en`, new URLSearchParams({ fecha: "2026-11-20" })));
  assert.deepEqual(nueva.cambios.map((c: Any) => c.numero), [11]);
});

test("persistencia entre servidores y reset a la semilla", async () => {
  const storage = memoria();
  const a = nuevo(storage);
  const r = await a.handle("POST", "/clientes", undefined, { nombre: "Nueva", apellido: "Clienta" });
  assert.equal(r.status, 201);
  const b = nuevo(storage);
  assert.ok(b.estado().clientes.some((c) => c.nombre === "Nueva"));
  await b.handle("POST", "/mock/reset");
  assert.ok(!nuevo(storage).estado().clientes.some((c) => c.nombre === "Nueva"));
});

test("reportes responden: dashboard, recontacto, análisis, envases", async () => {
  const s = nuevo();
  const d = data(await s.handle("GET", "/dashboard"));
  assert.ok(d.stockPorSede.length === 2 && typeof d.mes.ganancia === "number");
  const rc = data(await s.handle("GET", "/clientes/recontacto"));
  assert.ok(rc.recontactos.length >= 2 && rc.cumpleanos.length === 1);
  const an = data(await s.handle("GET", "/analisis/packs", new URLSearchParams({ desde: "2026-09-01", hasta: "2026-11-30", agrupar: "mes" })));
  assert.ok(an.filas.length > 0);
  const env = data(await s.handle("GET", "/envases"));
  assert.equal(env.bandeja.stock, 1500 - 500);
  assert.equal(env.sticker.alcanza, false);
});

// ── Correcciones de la revisión final ──

test("cerrar: reparto de un pack que no está en la producción → 400 sin stock negativo", async () => {
  const s = nuevo();
  const packs = data(await s.handle("GET", "/packs")) as Any[];
  const prod = data(await s.handle("POST", "/producciones", undefined, { lineas: [{ packId: packs[0].id, planificada: 5 }] }));
  const jvg = (data(await s.handle("GET", "/sedes")) as Any[]).find((x) => !x.esCocina);
  const r = await s.handle("POST", `/producciones/${prod.id}/cerrar`, undefined,
    { lineas: [{ packId: packs[0].id, real: 5 }], reparto: [{ sedeId: jvg.id, packId: packs[1].id, cantidad: 7 }] });
  assert.equal(r.status, 400);
  assert.equal((r.body as Any).field, "reparto");
});

test("editar la conversión de un insumo no cambia el costo estimado de una producción planificada", async () => {
  const s = nuevo();
  const { prod } = await planificar(s);
  const antes = data(await s.handle("GET", `/producciones/${prod.id}`)).costoEstimado;
  const repollo = s.estado().insumos.find((i) => i.nombre === "Repollo morado")!;
  assert.equal((await s.handle("PATCH", `/insumos/${repollo.id}`, undefined, { gramosPorUnidad: 5000 })).status, 200);
  assert.equal(data(await s.handle("GET", `/producciones/${prod.id}`)).costoEstimado, antes);
});

test("sede creada solo con nombre y capacidad puede vender", async () => {
  const s = nuevo();
  const sede = data(await s.handle("POST", "/sedes", undefined, { nombre: "Metán", capacidad: 40 }));
  const salta = s.estado().sedes.find((x) => x.esCocina)!;
  const f = (data(await s.handle("GET", "/stock")) as Any).filas.find((x: Any) => x.sedeId === salta.id && x.cantidad >= 1);
  const linea = { produccionId: f.produccionId, packId: f.packId, cantidad: 1 };
  assert.equal((await s.handle("POST", "/traslados", undefined, { origenId: salta.id, destinoId: sede.id, lineas: [linea] })).status, 201);
  const v = await s.handle("POST", "/ventas", undefined, { sedeId: sede.id, tipo: "minorista", medio: "efectivo", lineas: [linea] });
  assert.equal(v.status, 201);
});

test("gastos: monto no numérico o ≤ 0, medio inválido → 400; pagado por defecto true", async () => {
  const s = nuevo();
  const base = { fecha: "2026-11-15", tipo: "fijo", detalle: "Luz", medio: "transferencia" };
  assert.equal((await s.handle("POST", "/gastos", undefined, { ...base, monto: "5000" })).status, 400);
  assert.equal((await s.handle("POST", "/gastos", undefined, { ...base, monto: 0 })).status, 400);
  assert.equal((await s.handle("POST", "/gastos", undefined, { ...base, monto: 10, medio: "cheque" })).status, 400);
  const ok = await s.handle("POST", "/gastos", undefined, { ...base, monto: 5000 });
  assert.equal(ok.status, 201);
  assert.equal(data(ok).pagado, true);
  assert.equal((await s.handle("PATCH", `/gastos/${data(ok).id}`, undefined, { monto: "x" })).status, 400);
  assert.equal((await s.handle("POST", "/sedes", undefined, { nombre: "X", capacidad: "mucho" })).status, 400);
  assert.equal((await s.handle("POST", "/reservas", undefined, { nombre: "X", porcentaje: -5 })).status, 400);
});

test("insumo: PATCH con contenido 0 o gramosPorUnidad inválido → 400", async () => {
  const s = nuevo();
  const pollo = s.estado().insumos.find((i) => i.nombre === "Pollo")!;
  assert.equal((await s.handle("PATCH", `/insumos/${pollo.id}`, undefined, { contenido: 0 })).status, 400);
  assert.equal((await s.handle("PATCH", `/insumos/${pollo.id}`, undefined, { gramosPorUnidad: "x" })).status, 400);
});

test("ids como texto (valores de <select>) se normalizan: traslado y venta funcionan igual", async () => {
  const s = nuevo();
  const [salta, jvg] = s.estado().sedes;
  const f = (data(await s.handle("GET", "/stock")) as Any).filas.find((x: Any) => x.sedeId === salta.id && x.cantidad >= 2);
  const linea = { produccionId: String(f.produccionId), packId: String(f.packId), cantidad: 1 };
  assert.equal((await s.handle("POST", "/traslados", undefined, { origenId: String(salta.id), destinoId: String(salta.id), lineas: [linea] })).status, 400);
  assert.equal((await s.handle("POST", "/traslados", undefined, { origenId: String(salta.id), destinoId: String(jvg.id), lineas: [linea] })).status, 201);
  const v = await s.handle("POST", "/ventas", undefined, { sedeId: String(salta.id), tipo: "minorista", medio: "efectivo", lineas: [linea] });
  assert.equal(v.status, 201);
  const despues = (data(await s.handle("GET", "/stock", new URLSearchParams({ sedeId: String(salta.id) }))) as Any).filas
    .find((x: Any) => x.produccionId === f.produccionId && x.packId === f.packId);
  assert.equal(despues?.cantidad ?? 0, f.cantidad - 2);
});

// ── Correcciones de /code-review ──

async function compraDe(s: ReturnType<typeof nuevo>, prodId: number, insumoId: number) {
  const compras = ((await s.handle("GET", "/compras", new URLSearchParams({ length: "200" }))).body as Any).data as Any[];
  return compras.find((c) => c.produccionId === prodId && c.lineas.some((l: Any) => l.insumoId === insumoId));
}

test("comprar usa el contenido congelado: cambiar el contenido después de planificar no altera el costo real", async () => {
  const s = nuevo();
  const { prod } = await planificar(s);
  const pollo = s.estado().insumos.find((i) => i.nombre === "Pollo")!;
  const compra = await compraDe(s, prod.id, pollo.id);
  assert.equal((await s.handle("PATCH", `/insumos/${pollo.id}`, undefined, { contenido: 500 })).status, 200);
  assert.equal((await s.handle("POST", `/compras/${compra.id}/comprar`, undefined, { lineas: compra.lineas })).status, 200);
  const det = data(await s.handle("GET", `/producciones/${prod.id}`));
  assert.ok(Math.abs(det.costoReal - det.costoEstimado) < 0.01, `${det.costoReal} ≠ ${det.costoEstimado}`);
});

test("el total de una compra queda fijo y coincide con su gasto aunque cambie el insumo", async () => {
  const s = nuevo();
  const { prod } = await planificar(s);
  const pollo = s.estado().insumos.find((i) => i.nombre === "Pollo")!;
  const compra = await compraDe(s, prod.id, pollo.id);
  await s.handle("POST", `/compras/${compra.id}/comprar`, undefined, { lineas: compra.lineas });
  await s.handle("PATCH", `/insumos/${pollo.id}`, undefined, { contenido: 500 });
  const despues = await compraDe(s, prod.id, pollo.id);
  const gasto = s.estado().gastos.find((g) => g.origen?.compraId === compra.id)!;
  assert.equal(despues.total, gasto.monto);
});

test("producción con el mismo pack repetido → 400", async () => {
  const s = nuevo();
  const packs = data(await s.handle("GET", "/packs")) as Any[];
  const r = await s.handle("POST", "/producciones", undefined,
    { lineas: [{ packId: packs[0].id, planificada: 10 }, { packId: packs[0].id, planificada: 5 }] });
  assert.equal(r.status, 400);
  assert.equal((r.body as Any).field, "lineas");
});

test("cumpleaños: fecha completa se guarda como MM-DD; formato inválido → 400", async () => {
  const s = nuevo();
  const r = await s.handle("POST", "/clientes", undefined, { nombre: "Ana", apellido: "Sol", cumpleanos: "1990-11-15" });
  assert.equal(r.status, 201);
  assert.equal(data(r).cumpleanos, "11-15");
  assert.ok(data(await s.handle("GET", "/clientes/recontacto")).cumpleanos.some((c: Any) => c.nombre === "Ana"));
  assert.equal((await s.handle("POST", "/clientes", undefined, { nombre: "B", apellido: "C", cumpleanos: "13-45" })).status, 400);
  assert.equal((await s.handle("PATCH", `/clientes/${data(r).id}`, undefined, { cumpleanos: "15/11" })).status, 400);
});

test("cambiar parámetros no altera la foto del lote INICIAL", async () => {
  const s = nuevo();
  await s.handle("PUT", "/parametros", undefined, { precioPack: 50000 });
  const inicial = s.estado().producciones.find((p) => p.codigo === "INICIAL")!;
  assert.equal(inicial.snapshot.parametros.precioPack, 45000);
});

const gastos = async (s: ReturnType<typeof nuevo>) => (await s.handle("GET", "/gastos", new URLSearchParams({ length: "500" }))).body as Any;
const unPack = async (s: ReturnType<typeof nuevo>) => (data(await s.handle("GET", "/stock")) as Any).filas.find((x: Any) => x.cantidad >= 1);

test("venta: crea un cobro por el total aunque mande cobrado parcial; sin saldo en la vista", async () => {
  const s = nuevo();
  const f = await unPack(s);
  const r = await s.handle("POST", "/ventas", undefined, { fecha: "2026-11-15", sedeId: f.sedeId, tipo: "minorista", medio: "efectivo",
    lineas: [{ produccionId: f.produccionId, packId: f.packId, cantidad: 1, precioUnitario: 45000 }], cobrado: 1000 });
  assert.equal(r.status, 201);
  assert.equal(data(r).total, 45000);
  assert.ok(!("saldo" in data(r)) && !("cobrado" in data(r)));
  assert.equal(s.estado().cobros.filter((c) => c.ventaId === data(r).id).reduce((a, c) => a + c.monto, 0), 45000);
  const mes = (data(await s.handle("GET", "/finanzas/mensual")) as Any[]).find((m) => m.mes === "2026-11");
  assert.ok(!("pendiente" in mes));
  const cli = ((await s.handle("GET", "/clientes", new URLSearchParams({ length: "50" }))).body as Any).data[0];
  assert.ok(!("saldo" in cli));
});

test("POST /ventas/:id/cobros ya no existe", async () => {
  const s = nuevo();
  const v = s.estado().ventas.find((x) => x.tipo === "minorista")!;
  const r = await s.handle("POST", `/ventas/${v.id}/cobros`, undefined, { monto: 1, medio: "efectivo" });
  assert.equal(r.status, 404);
  assert.equal((r.body as Any).message, "No encontrado");
});

test("pago con packs: exige notas; crea gasto del tipo elegido con detalle = notas y medio packs", async () => {
  const s = nuevo();
  const f = await unPack(s);
  const base = { fecha: "2026-11-15", sedeId: f.sedeId, tipo: "pago_con_packs", medio: "packs",
    lineas: [{ produccionId: f.produccionId, packId: f.packId, cantidad: 1 }] };
  const sin = await s.handle("POST", "/ventas", undefined, base);
  assert.equal(sin.status, 400);
  assert.equal((sin.body as Any).field, "notas");
  assert.equal((await s.handle("POST", "/ventas", undefined, { ...base, notas: "10 kg de arroz", tipoGasto: "mercadería" })).status, 201);
  const g = (await gastos(s)).data.find((x: Any) => x.detalle === "10 kg de arroz");
  assert.deepEqual([g.tipo, g.medio, g.monto], ["mercadería", "packs", 45000]);
});

test("uso interno: sin notas es válido y no crea gasto", async () => {
  const s = nuevo();
  const f = await unPack(s);
  const antes = (await gastos(s)).total;
  const r = await s.handle("POST", "/ventas", undefined, { fecha: "2026-11-15", sedeId: f.sedeId, tipo: "uso_interno", medio: "packs",
    lineas: [{ produccionId: f.produccionId, packId: f.packId, cantidad: 1 }] });
  assert.equal(r.status, 201);
  assert.equal((await gastos(s)).total, antes);
});

test("pago con packs mayor al stock → 400 lineas, sin gasto ni movimiento", async () => {
  const s = nuevo();
  const f = await unPack(s);
  const [g0, m0] = [(await gastos(s)).total, s.estado().movimientos.length];
  const r = await s.handle("POST", "/ventas", undefined, { fecha: "2026-11-15", sedeId: f.sedeId, tipo: "pago_con_packs", medio: "packs",
    notas: "x", lineas: [{ produccionId: f.produccionId, packId: f.packId, cantidad: f.cantidad + 1 }] });
  assert.equal((r.body as Any).field, "lineas");
  assert.equal((await gastos(s)).total, g0);
  assert.equal(s.estado().movimientos.length, m0);
});

test("gasto generado (con origen) no se edita; uno manual sí", async () => {
  const s = nuevo();
  const lista = (await gastos(s)).data as Any[];
  const auto = lista.find((x) => x.origen);
  const r = await s.handle("PATCH", `/gastos/${auto.id}`, undefined, { monto: 1 });
  assert.equal(r.status, 400);
  assert.equal((r.body as Any).field, "origen");
  const manual = lista.find((x) => !x.origen);
  assert.equal((await s.handle("PATCH", `/gastos/${manual.id}`, undefined, { detalle: "Luz" })).status, 200);
});

test("tipos de gasto: no se puede quitar \"fijo\" (alimenta el indirecto por pack)", async () => {
  const s = nuevo();
  const r = await s.handle("PUT", "/parametros", undefined, { tiposGasto: ["Fijo", "mercadería"] });
  assert.equal(r.status, 400);
  assert.equal((r.body as Any).field, "tiposGasto");
  assert.ok(s.estado().tiposGasto.includes("fijo"));
  assert.equal((await s.handle("PUT", "/parametros", undefined, { tiposGasto: ["fijo", "insumos"] })).status, 200);
});

test("venta sin precio usa el precio propio del pack; el trueque valúa con ese precio; /stock lo informa", async () => {
  const s = nuevo();
  const f = await unPack(s);
  await s.handle("PATCH", `/packs/${f.packId}`, undefined, { precio: 52000 });
  const fila = (data(await s.handle("GET", "/stock")) as Any).filas.find((x: Any) => x.packId === f.packId && x.produccionId === f.produccionId);
  assert.equal(fila.precio, 52000);
  const linea = { produccionId: f.produccionId, packId: f.packId, cantidad: 1 };
  const v = data(await s.handle("POST", "/ventas", undefined, { sedeId: f.sedeId, tipo: "minorista", medio: "efectivo", lineas: [linea] }));
  assert.equal(v.total, 52000);
  const f2 = (data(await s.handle("GET", "/stock")) as Any).filas.find((x: Any) => x.packId === f.packId && x.cantidad >= 1);
  await s.handle("POST", "/ventas", undefined, { sedeId: f2.sedeId, tipo: "pago_con_packs", medio: "packs", notas: "flete",
    lineas: [{ produccionId: f2.produccionId, packId: f2.packId, cantidad: 1 }] });
  assert.equal((await gastos(s)).data.find((x: Any) => x.detalle === "flete").monto, 52000);
});

test("POST /insumos guarda gramosPorUnidad", async () => {
  const s = nuevo();
  const proveedorId = s.estado().proveedores[0].id;
  const r = await s.handle("POST", "/insumos", undefined, { nombre: "Huevo XL", unidad: "u", proveedorId, contenido: 30, gramosPorUnidad: 60 });
  assert.equal(r.status, 201);
  assert.equal(s.estado().insumos.find((i) => i.nombre === "Huevo XL")!.gramosPorUnidad, 60);
});

test("PATCH no puede vaciar campos requeridos", async () => {
  const s = nuevo();
  const c = data(await s.handle("POST", "/clientes", undefined, { nombre: "Ana", apellido: "Paz" }));
  const r = await s.handle("PATCH", `/clientes/${c.id}`, undefined, { apellido: null });
  assert.equal(r.status, 400);
  assert.equal((r.body as Any).field, "apellido");
  assert.equal((await s.handle("PATCH", `/clientes/${c.id}`, undefined, { nombre: "  " })).status, 400);
});

test("editar sobrantes conserva el id de las compras pendientes", async () => {
  const s = nuevo();
  const { prod } = await planificar(s);
  const ids = () => s.estado().compras.filter((c) => c.produccionId === prod.id).map((c) => c.id).sort();
  const antes = ids();
  const insumoId = s.estado().insumos[0].id;
  assert.equal((await s.handle("PATCH", `/producciones/${prod.id}/sobrantes`, undefined, { sobrantes: { [insumoId]: 1 } })).status, 200);
  assert.ok(ids().length > 0);
  assert.ok(ids().every((id) => antes.includes(id)));
});

test("cumpleaños imposible (31 de febrero, 31 de abril) → 400", async () => {
  const s = nuevo();
  for (const cumpleanos of ["02-30", "02-31", "04-31"]) {
    const r = await s.handle("POST", "/clientes", undefined, { nombre: "Ana", apellido: "Paz", cumpleanos });
    assert.equal(r.status, 400, cumpleanos);
  }
  assert.equal((await s.handle("POST", "/clientes", undefined, { nombre: "Ana", apellido: "Paz", cumpleanos: "02-29" })).status, 201);
});
