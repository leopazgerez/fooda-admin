// Catálogo y ajustes: proveedores, sedes, reservas, insumos (+precios), platos, packs (+versiones), parámetros.
import { costoPack, costoPlato, costosVigentes, ultimoPrecio } from "../domain/costos.ts";
import { costosEnvases, porVigencia, versionVigente } from "../domain/produccion.ts";
import type { Plato } from "../domain/types.ts";
import { buscar, creado, falla, fecha, lista, ok, positivo, type Ctx, type Ruta } from "./http.ts";
import { listar } from "./query.ts";
import { nuevoId, type Estado } from "./store.ts";
import { nombreProveedor, precioDePack } from "./vistas.ts";

type Coleccion = "proveedores" | "sedes" | "reservas" | "clientes" | "gastos";

/** CRUD simple: lista paginada, alta y edición parcial de campos permitidos. */
export function crud(
  path: string, col: Coleccion, opts: { campos: string[]; requeridos: string[]; buscarEn: string[]; orden: string; dir?: "asc" | "desc";
    vista?: (c: Ctx, x: never) => unknown; borrar?: boolean;
    /** valores por defecto en el alta */
    defaults?: Record<string, unknown>;
    /** valida el registro ya combinado (alta y edición); lanza con falla() */
    validar?: (x: Record<string, unknown>) => void },
): Ruta[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (e: Estado) => e[col] as any[];
  const vista = (c: Ctx, x: never) => (opts.vista ? opts.vista(c, x) : x);
  const tomar = (body: Record<string, unknown>) => Object.fromEntries(opts.campos.filter((k) => k in (body ?? {})).map((k) => [k, body[k]]));
  const rutas: Ruta[] = [
    { metodo: "GET", patron: path, manejar: (c) => lista(listar(items(c.e).map((x) => vista(c, x as never)), c.query,
      { buscarEn: opts.buscarEn as never[], ordenPorDefecto: opts.orden as never, dirPorDefecto: opts.dir })) },
    { metodo: "GET", patron: `${path}/:id`, manejar: (c) => ok(vista(c, buscar(items(c.e), c.params.id) as never)) },
    { metodo: "POST", patron: path, manejar: (c) => {
      for (const k of opts.requeridos) if (c.body?.[k] === undefined || c.body?.[k] === "") falla(`Completá ${k}`, k);
      const x = { ...opts.defaults, ...tomar(c.body), id: nuevoId(c.e) };
      opts.validar?.(x);
      items(c.e).push(x);
      return creado(vista(c, x as never));
    } },
    { metodo: "PATCH", patron: `${path}/:id`, manejar: (c) => {
      const x = buscar(items(c.e), c.params.id);
      const nuevo = { ...x, ...tomar(c.body) };
      for (const k of opts.requeridos) if (nuevo[k] == null || String(nuevo[k]).trim() === "") falla(`Completá ${k}`, k);
      opts.validar?.(nuevo);
      Object.assign(x, nuevo);
      return ok(vista(c, x as never));
    } },
  ];
  if (opts.borrar) rutas.push({ metodo: "DELETE", patron: `${path}/:id`, manejar: (c) => {
    buscar(items(c.e), c.params.id);
    c.e[col] = items(c.e).filter((x) => x.id !== Number(c.params.id)) as never;
    return { status: 204 };
  } });
  return rutas;
}

/** Vista de packs con su versión y costo vigentes; costos y platos se calculan una vez para todos. */
function packsVista(c: Ctx, packIds: number[]) {
  const costos = costosVigentes(c.e.insumos, c.e.precios, c.hoy);
  const platos = Object.fromEntries(c.e.platos.map((p) => [p.id, p]));
  const envases = costosEnvases(c.e.insumos, costos);
  return packIds.map((id) => packVista(c, buscar(c.e.packs, id, "Pack"), costos, platos, envases));
}

function packVista(c: Ctx, pack: Estado["packs"][number], costos: Record<number, number>, platos: Record<number, Plato>,
  envases: { bandeja: number; sticker: number }) {
  const v = versionVigente(c.e.versiones, pack.id, c.hoy);
  const directo = v ? costoPack(v.menus, platos, costos, c.e.insumos, c.e.parametros, envases) : null;
  const precio = precioDePack(c.e, pack.id);
  const costo = directo ? directo.directo + c.e.parametros.indirectoReferencia : 0;
  return {
    ...pack, precioVenta: precio,
    versionActual: v ? { ...v, menus: v.menus.map((m) => ({ ...m, plato: platos[m.platoId]?.nombre ?? "—",
      costo: platos[m.platoId] ? costoPlato(platos[m.platoId], costos, c.e.insumos) : 0 })) } : null,
    costo: directo ? { ...directo, indirecto: c.e.parametros.indirectoReferencia, total: costo } : null,
    ganancia: precio - costo, margen: precio ? (precio - costo) / precio : 0,
  };
}

function validarReceta(c: Ctx, receta: unknown): Plato["receta"] {
  if (!Array.isArray(receta) || !receta.length) falla("La receta necesita al menos un ingrediente", "receta");
  return (receta as Plato["receta"]).map((l) => {
    buscar(c.e.insumos, l.insumoId, "Insumo");
    if (!positivo(l.cantidad)) falla("Las cantidades deben ser mayores a cero", "receta");
    return { insumoId: l.insumoId, cantidad: l.cantidad, unidad: l.unidad, porciones: l.porciones || 1 };
  });
}

const numero = (x: Record<string, unknown>, k: string, msg: string, min = 0) => {
  if (typeof x[k] !== "number" || !Number.isFinite(x[k]) || (x[k] as number) < min) falla(msg, k);
};

export const rutas: Ruta[] = [
  ...crud("/proveedores", "proveedores", { campos: ["nombre", "diaCompra", "orden"], requeridos: ["nombre"], buscarEn: ["nombre"], orden: "orden" }),
  ...crud("/sedes", "sedes", { campos: ["nombre", "direccion", "capacidad", "umbralStock", "umbralLugaresLibres", "envio", "afectaPrecio", "esCocina"],
    requeridos: ["nombre", "capacidad"], buscarEn: ["nombre"], orden: "id",
    defaults: { direccion: "", umbralStock: 0, umbralLugaresLibres: 999, envio: { tipo: "monto", valor: 0 }, afectaPrecio: false, esCocina: false },
    validar: (x) => {
      numero(x, "capacidad", "La capacidad debe ser un número ≥ 0");
      numero(x, "umbralStock", "El umbral debe ser un número ≥ 0");
      numero(x, "umbralLugaresLibres", "El umbral debe ser un número ≥ 0");
      const envio = x.envio as { tipo?: string; valor?: unknown } | undefined;
      if (!envio || !["monto", "porcentaje"].includes(envio.tipo ?? "") || typeof envio.valor !== "number" || envio.valor < 0)
        falla("El envío debe ser {tipo: monto|porcentaje, valor ≥ 0}", "envio");
    } }),
  ...crud("/reservas", "reservas", { campos: ["nombre", "porcentaje"], requeridos: ["nombre", "porcentaje"], buscarEn: ["nombre"], orden: "id", borrar: true,
    validar: (x) => numero(x, "porcentaje", "El porcentaje debe ser un número ≥ 0") }),

  { metodo: "GET", patron: "/insumos", manejar: (c) => {
    const costos = costosVigentes(c.e.insumos, c.e.precios, c.hoy);
    const items = c.e.insumos.map((i) => ({ ...i, costoUnitario: costos[i.id] ?? 0,
      proveedor: nombreProveedor(c.e, i.proveedorId),
      precioEnvase: ultimoPrecio(i.id, c.e.precios, c.hoy)?.precioEnvase ?? null }));
    return lista(listar(items, c.query, { buscarEn: ["nombre", "proveedor"], ordenPorDefecto: "nombre" }));
  } },
  { metodo: "POST", patron: "/insumos", manejar: (c) => {
    const b = c.body ?? {};
    if (!b.nombre?.trim()) falla("Ingresá el nombre del insumo", "nombre");
    if (c.e.insumos.some((i) => i.nombre.toLowerCase() === b.nombre.trim().toLowerCase())) falla(`${b.nombre} ya existe`, "nombre");
    buscar(c.e.proveedores, b.proveedorId, "Proveedor");
    if (!positivo(b.contenido)) falla("El contenido del envase debe ser mayor a cero", "contenido");
    const ins = { id: nuevoId(c.e), nombre: b.nombre.trim(), unidad: b.unidad ?? "g", proveedorId: b.proveedorId, contenido: b.contenido,
      presentacion: b.presentacion, activo: true,
      ...(b.gramosPorUnidad != null ? { gramosPorUnidad: b.gramosPorUnidad } : {}) };
    c.e.insumos.push(ins);
    if (b.precioEnvase !== undefined) c.e.precios.push({ id: nuevoId(c.e), insumoId: ins.id, fecha: c.hoy, precioEnvase: Number(b.precioEnvase) });
    return creado(ins);
  } },
  { metodo: "PATCH", patron: "/insumos/:id", manejar: (c) => {
    const ins = buscar(c.e.insumos, c.params.id, "Insumo");
    if (c.body && "contenido" in c.body && !positivo(c.body.contenido)) falla("El contenido del envase debe ser mayor a cero", "contenido");
    if (c.body && "gramosPorUnidad" in c.body && c.body.gramosPorUnidad !== null && !positivo(c.body.gramosPorUnidad))
      falla("Los gramos por unidad deben ser mayores a cero", "gramosPorUnidad");
    if (c.body && "proveedorId" in c.body) buscar(c.e.proveedores, c.body.proveedorId, "Proveedor");
    for (const k of ["nombre", "unidad", "proveedorId", "contenido", "presentacion", "activo", "gramosPorUnidad"] as const)
      if (c.body && k in c.body) Object.assign(ins, { [k]: c.body[k] });
    return ok(ins);
  } },
  { metodo: "GET", patron: "/insumos/:id/precios", manejar: (c) => {
    buscar(c.e.insumos, c.params.id, "Insumo");
    return ok(c.e.precios.filter((p) => p.insumoId === Number(c.params.id)).sort((a, b) => a.fecha.localeCompare(b.fecha)));
  } },
  { metodo: "POST", patron: "/insumos/:id/precios", manejar: (c) => {
    const ins = buscar(c.e.insumos, c.params.id, "Insumo");
    if (typeof c.body?.precioEnvase !== "number" || c.body.precioEnvase < 0) falla("Ingresá un precio válido", "precioEnvase");
    const p = { id: nuevoId(c.e), insumoId: ins.id, fecha: fecha(c.body.fecha, c.hoy), precioEnvase: c.body.precioEnvase };
    c.e.precios.push(p);
    return creado(p);
  } },

  { metodo: "GET", patron: "/platos", manejar: (c) => {
    const costos = costosVigentes(c.e.insumos, c.e.precios, c.hoy);
    const vigentes = c.e.packs.map((p) => versionVigente(c.e.versiones, p.id, c.hoy)).filter((v) => !!v);
    const items = c.e.platos.map((p) => ({ ...p, costo: costoPlato(p, costos, c.e.insumos),
      menus: vigentes
        .flatMap((v) => v.menus.filter((m) => m.platoId === p.id).map((m) => ({ numero: m.numero, packId: v.packId }))) }));
    return lista(listar(items, c.query, { buscarEn: ["nombre"], ordenPorDefecto: "id" }));
  } },
  { metodo: "POST", patron: "/platos", manejar: (c) => {
    if (!c.body?.nombre?.trim()) falla("Ingresá el nombre del plato", "nombre");
    const p = { id: nuevoId(c.e), nombre: c.body.nombre.trim(), receta: validarReceta(c, c.body.receta) };
    c.e.platos.push(p);
    return creado(p);
  } },
  { metodo: "PATCH", patron: "/platos/:id", manejar: (c) => {
    const p = buscar(c.e.platos, c.params.id, "Plato");
    if (c.body?.nombre !== undefined) p.nombre = String(c.body.nombre).trim();
    if (c.body?.receta !== undefined) p.receta = validarReceta(c, c.body.receta);
    return ok(p);
  } },

  { metodo: "GET", patron: "/packs", manejar: (c) => ok(packsVista(c, c.e.packs.map((p) => p.id))) },
  { metodo: "GET", patron: "/packs/:id", manejar: (c) => ok(packsVista(c, [Number(c.params.id)])[0]) },
  { metodo: "POST", patron: "/packs", manejar: (c) => {
    if (!c.body?.nombre?.trim()) falla("Ingresá el nombre del pack", "nombre");
    const p = { id: nuevoId(c.e), numero: c.e.packs.reduce((a, x) => Math.max(a, x.numero), 0) + 1, nombre: c.body.nombre.trim(), activo: true };
    c.e.packs.push(p);
    return creado(p);
  } },
  { metodo: "PATCH", patron: "/packs/:id", manejar: (c) => {
    const p = buscar(c.e.packs, c.params.id, "Pack");
    for (const k of ["nombre", "activo", "precio"] as const) if (c.body && k in c.body) Object.assign(p, { [k]: c.body[k] });
    return ok(p);
  } },
  { metodo: "GET", patron: "/packs/:id/versiones", manejar: (c) => {
    buscar(c.e.packs, c.params.id, "Pack");
    return ok(c.e.versiones.filter((v) => v.packId === Number(c.params.id)).sort(porVigencia));
  } },
  { metodo: "POST", patron: "/packs/:id/versiones", manejar: (c) => {
    const pack = buscar(c.e.packs, c.params.id, "Pack");
    const menus = c.body?.menus;
    if (!Array.isArray(menus) || menus.length !== 5) falla("Un pack lleva exactamente 5 menús", "menus");
    for (const m of menus) {
      buscar(c.e.platos, m.platoId, "Plato");
      if (!Number.isInteger(m.numero) || m.numero < 1) falla("Cada menú necesita un número", "menus");
    }
    const v = { id: nuevoId(c.e), packId: pack.id, desde: fecha(c.body.desde, c.hoy),
      menus: menus.map((m: { numero: number; platoId: number }) => ({ numero: m.numero, platoId: m.platoId })) };
    c.e.versiones.push(v);
    return creado(v);
  } },

  { metodo: "GET", patron: "/parametros", manejar: (c) => ok({ ...c.e.parametros, motivos: c.e.motivos, tiposGasto: c.e.tiposGasto }) },
  { metodo: "PUT", patron: "/parametros", manejar: (c) => {
    const b = c.body ?? {};
    if (b.precioPack !== undefined && !positivo(b.precioPack)) falla("El precio del pack debe ser mayor a cero", "precioPack");
    // "fijo" es el tipo que entra al indirecto por pack (domain/finanzas.ts): no se puede quitar ni renombrar
    if (Array.isArray(b.tiposGasto) && !b.tiposGasto.includes("fijo")) falla("El tipo \"fijo\" no se puede quitar: con él se calcula el indirecto por pack", "tiposGasto");
    const { motivos, tiposGasto, ...params } = b;
    Object.assign(c.e.parametros, params);
    if (Array.isArray(motivos)) c.e.motivos = motivos;
    if (Array.isArray(tiposGasto)) c.e.tiposGasto = tiposGasto;
    return ok({ ...c.e.parametros, motivos: c.e.motivos, tiposGasto: c.e.tiposGasto });
  } },
];
