// Operación: producciones (planificar → listas → cerrar), compras, envases, traslados, ajustes de stock, ventas, cobros, clientes, gastos.
import { cumpleanosHoy, recontactos } from "../domain/clientes.ts";
import { combinar, montoCompra, ultimoPrecio } from "../domain/costos.ts";
import { codigoLote, insumosDe, listaSuper, packsReales, recetarioEscalado, siguienteNumero, tomarSnapshot } from "../domain/produccion.ts";
import { disponible, validarSalidas } from "../domain/stock.ts";
import { esIngreso, packsVenta, totalVenta } from "../domain/ventas.ts";
import type { Compra, Insumo, LineaCompra, LineaVenta, MovimientoStock, Produccion, Venta } from "../domain/types.ts";
import { buscar, creado, entero, falla, fecha, lista, ok, positivo, type Ctx, type Ruta } from "./http.ts";
import { listar } from "./query.ts";
import { nuevoId, type Estado } from "./store.ts";
import { crud } from "./rutas-catalogo.ts";
import { clienteVista, codigoProduccion, nombreCliente, nombrePack, nombreProveedor, nombreSede, precioDePack, produccionResumen, ultimaCerrada, ventaVista } from "./vistas.ts";

/** Días del mes en año bisiesto (acepta 29/02); 0 si el mes no existe. */
const diasDelMes = (mes: number) => (mes >= 1 && mes <= 12 ? new Date(2000, mes, 0).getDate() : 0);
const mov = (e: Estado, m: Omit<MovimientoStock, "id">) => e.movimientos.push({ id: nuevoId(e), ...m });
const insumoDe = (e: Estado, id: number) => buscar(e.insumos, id, "Insumo");
/** Insumos que gobiernan una producción o compra: los congelados de su producción, o los vivos si no tiene. */
const insumosDeProduccion = (e: Estado, produccionId?: number) => {
  const p = e.producciones.find((x) => x.id === produccionId);
  return p ? insumosDe(p, e.insumos) : e.insumos;
};

/** Una compra pendiente por proveedor según la lista de súper (no toca las ya compradas). */
function regenerarCompras(e: Estado, p: Produccion) {
  const compradas = new Set(e.compras.filter((c) => c.produccionId === p.id && c.estado === "comprada").map((c) => c.proveedorId));
  // conserva el id de la pendiente de cada proveedor: un panel abierto sigue apuntando a ella
  const previas = new Map(e.compras.filter((c) => c.produccionId === p.id && c.estado === "pendiente").map((c) => [c.proveedorId, c.id]));
  e.compras = e.compras.filter((c) => !(c.produccionId === p.id && c.estado === "pendiente"));
  const insumos = insumosDe(p, e.insumos);
  const contenido = (id: number) => insumos.find((i) => i.id === id)?.contenido ?? insumoDe(e, id).contenido;
  for (const g of listaSuper(p, e.insumos, e.proveedores)) {
    if (compradas.has(g.proveedor.id)) continue;
    e.compras.push({ id: previas.get(g.proveedor.id) ?? nuevoId(e), produccionId: p.id, proveedorId: g.proveedor.id, estado: "pendiente",
      lineas: g.items.map((it) => ({ insumoId: it.insumoId, cantidad: it.cantidad, precioEnvase: it.costoUnitario * contenido(it.insumoId) })) });
  }
}

/** Registra precios nuevos y devuelve las subas que superan el umbral. */
function registrarPrecios(e: Estado, lineas: LineaCompra[], dia: string) {
  const alertas: { insumoId: number; insumo: string; anterior: number; nuevo: number; suba: number }[] = [];
  for (const l of lineas) {
    const previo = ultimoPrecio(l.insumoId, e.precios, dia);
    if (previo?.precioEnvase === l.precioEnvase) continue;
    e.precios.push({ id: nuevoId(e), insumoId: l.insumoId, fecha: dia, precioEnvase: l.precioEnvase });
    if (previo && previo.precioEnvase > 0) {
      const suba = l.precioEnvase / previo.precioEnvase - 1;
      if (suba > e.parametros.alertaSubaPrecio) alertas.push({ insumoId: l.insumoId, insumo: insumoDe(e, l.insumoId).nombre, anterior: previo.precioEnvase, nuevo: l.precioEnvase, suba });
    }
  }
  return alertas;
}

function validarLineasCompra(c: Ctx): LineaCompra[] {
  const ls = c.body?.lineas;
  if (!Array.isArray(ls) || !ls.length) falla("La compra necesita al menos un ítem", "lineas");
  return ls.map((l: LineaCompra) => {
    insumoDe(c.e, l.insumoId);
    if (!positivo(l.cantidad) || typeof l.precioEnvase !== "number" || l.precioEnvase < 0) falla("Revisá cantidades y precios", "lineas");
    return { insumoId: l.insumoId, cantidad: l.cantidad, precioEnvase: l.precioEnvase };
  });
}

function comprar(c: Ctx, compra: Compra) {
  const dia = fecha(c.body?.fecha, c.hoy);
  const lineas = validarLineasCompra(c);
  const alertas = registrarPrecios(c.e, lineas, dia);
  Object.assign(compra, { estado: "comprada", fecha: dia, lineas });
  const prod = c.e.producciones.find((p) => p.id === compra.produccionId);
  // con los insumos congelados de la producción (contenido y compuestos de cuando se planificó)
  const insumos = insumosDeProduccion(c.e, compra.produccionId);
  const g = { id: nuevoId(c.e), fecha: dia, tipo: "mercadería", detalle: `Compra ${nombreProveedor(c.e, compra.proveedorId)}${prod ? ` · ${prod.codigo}` : ""}`,
    monto: montoCompra(insumos, lineas), medio: "transferencia" as const, pagado: true, origen: { compraId: compra.id } };
  c.e.gastos.push(g);
  compra.gastoId = g.id;
  compra.total = g.monto;
  if (prod) {
    const contenido = (id: number) => insumos.find((i) => i.id === id)?.contenido ?? insumoDe(c.e, id).contenido;
    for (const l of lineas) prod.costosPagados[l.insumoId] = l.precioEnvase / contenido(l.insumoId);
    // los compuestos (pimiento, calabaza) se recalculan con sus partes pagadas
    for (const i of insumos.filter((x): x is Insumo & { compuesto: NonNullable<Insumo["compuesto"]> } => !!x.compuesto)) {
      const partes = i.compuesto.insumoIds.map((id) => prod.costosPagados[id] ?? prod.snapshot.costos[id] ?? 0);
      if (i.compuesto.insumoIds.some((id) => id in prod.costosPagados))
        prod.costosPagados[i.id] = combinar(i.compuesto.regla, partes);
    }
  }
  return { compra, gasto: g, alertas };
}

function compraVista(e: Estado, c: Compra) {
  const insumos = insumosDeProduccion(e, c.produccionId);
  return {
    ...c, proveedor: nombreProveedor(e, c.proveedorId),
    produccion: c.produccionId ? codigoProduccion(e, c.produccionId) : null,
    // comprada: el total quedó fijo al registrarla (igual al gasto); pendiente: estimado con los insumos de la producción
    total: c.total ?? montoCompra(insumos, c.lineas),
    lineas: c.lineas.map((l) => {
      const i = insumos.find((x) => x.id === l.insumoId) ?? insumoDe(e, l.insumoId);
      return { ...l, insumo: i.nombre, unidad: i.unidad, contenido: i.contenido };
    }),
  };
}

function salidaInvalida(e: Estado, sedeId: number, lineas: { produccionId: number; packId: number; cantidad: number }[]) {
  const f = validarSalidas(e.movimientos, sedeId, lineas);
  if (!f) return;
  if (!Number.isInteger(f.pedido) || f.pedido <= 0) falla("Las cantidades deben ser enteros mayores a cero", "lineas");
  falla(`Solo hay ${f.disponible} packs de ${nombrePack(e, f.packId)} (${codigoProduccion(e, f.produccionId)}) en ${nombreSede(e, sedeId)}`, "lineas");
}

function produccionPlanificada(c: Ctx) {
  const p = buscar(c.e.producciones, c.params.id, "Producción");
  if (p.estado !== "planificada") falla("La producción ya está cerrada", "estado");
  return p;
}

const rutasProduccion: Ruta[] = [
  { metodo: "GET", patron: "/producciones", manejar: (c) =>
    lista(listar(c.e.producciones.map((p) => produccionResumen(c.e, p)), c.query, { buscarEn: ["codigo"], ordenPorDefecto: "inicio", dirPorDefecto: "desc" })) },
  { metodo: "POST", patron: "/producciones", manejar: (c) => {
    const ls = c.body?.lineas;
    if (!Array.isArray(ls) || !ls.length) falla("Elegí al menos un pack", "lineas");
    for (const l of ls) {
      buscar(c.e.packs, l.packId, "Pack");
      if (!entero(l.planificada)) falla("Las cantidades deben ser enteros ≥ 0", "lineas");
    }
    if (new Set(ls.map((l: { packId: number }) => l.packId)).size !== ls.length) falla("Cada pack va una sola vez en la producción", "lineas");
    if (!ls.some((l: { planificada: number }) => l.planificada > 0)) falla("Indicá cuántos packs vas a producir", "lineas");
    const inicio = fecha(c.body.inicio, c.hoy);
    const numero = siguienteNumero(c.e.producciones.filter((p) => p.numero > 0), inicio);
    const lineas = ls.filter((l: { planificada: number }) => l.planificada > 0).map((l: { packId: number; planificada: number }) => ({ packId: l.packId, planificada: l.planificada }));
    let snapshot;
    try {
      snapshot = tomarSnapshot(lineas.map((l: { packId: number }) => l.packId), c.e.versiones, c.e.platos, c.e.insumos, c.e.precios, c.e.parametros, inicio);
    } catch (err) {
      return falla((err as Error).message, "lineas");
    }
    const p: Produccion = { id: nuevoId(c.e), codigo: codigoLote(numero, inicio), numero, estado: "planificada", inicio, lineas, snapshot, costosPagados: {}, sobrantes: {} };
    c.e.producciones.push(p);
    regenerarCompras(c.e, p);
    return creado(produccionResumen(c.e, p));
  } },
  { metodo: "GET", patron: "/producciones/:id", manejar: (c) => {
    const p = buscar(c.e.producciones, c.params.id, "Producción");
    return ok({ ...produccionResumen(c.e, p), sobrantes: p.sobrantes,
      traslados: c.e.traslados.filter((t) => t.lineas.some((l) => l.produccionId === p.id)),
      compradores: c.e.ventas.filter((v) => v.lineas.some((l) => l.produccionId === p.id))
        .map((v) => ({ ventaId: v.id, fecha: v.fecha, cliente: nombreCliente(c.e, v.clienteId), sede: nombreSede(c.e, v.sedeId),
          packs: v.lineas.filter((l) => l.produccionId === p.id).map((l) => ({ pack: nombrePack(c.e, l.packId), cantidad: l.cantidad })) })) });
  } },
  { metodo: "GET", patron: "/producciones/:id/lista-super", manejar: (c) => {
    const p = buscar(c.e.producciones, c.params.id, "Producción");
    return ok(listaSuper(p, c.e.insumos, c.e.proveedores).map((g) => {
      const compra = c.e.compras.find((x) => x.produccionId === p.id && x.proveedorId === g.proveedor.id);
      return { ...g, compraId: compra?.id ?? null, estado: compra?.estado ?? "pendiente", totalEnPacks: g.total / c.e.parametros.precioPack };
    }));
  } },
  { metodo: "GET", patron: "/producciones/:id/recetario", manejar: (c) => {
    const p = buscar(c.e.producciones, c.params.id, "Producción");
    return ok(recetarioEscalado(p, c.e.insumos).map((r) => ({ ...r, nombre: nombrePack(c.e, r.packId),
      menus: r.menus.map((m) => (m.compartidoCon ? { ...m, compartidoCon: { ...m.compartidoCon, nombre: nombrePack(c.e, m.compartidoCon.packId) } } : m)) })));
  } },
  { metodo: "PATCH", patron: "/producciones/:id/sobrantes", manejar: (c) => {
    const p = produccionPlanificada(c);
    const s = c.body?.sobrantes ?? {};
    for (const [k, v] of Object.entries(s)) { insumoDe(c.e, Number(k)); if (typeof v !== "number" || v < 0) falla("Los sobrantes deben ser ≥ 0", "sobrantes"); }
    p.sobrantes = s;
    regenerarCompras(c.e, p);
    return ok(produccionResumen(c.e, p));
  } },
  { metodo: "POST", patron: "/producciones/:id/cerrar", manejar: (c) => {
    const p = produccionPlanificada(c);
    const dia = fecha(c.body?.fecha, c.hoy);
    const reales: { packId: number; real: number }[] = c.body?.lineas ?? [];
    for (const l of reales) {
      if (!p.lineas.some((x) => x.packId === l.packId)) falla(`${nombrePack(c.e, l.packId)} no está en esta producción`, "lineas");
      if (!entero(l.real)) falla("Las cantidades reales deben ser enteros ≥ 0", "lineas");
    }
    const real = (packId: number) => reales.find((l) => l.packId === packId)?.real ?? p.lineas.find((l) => l.packId === packId)!.planificada;
    const cocina = c.e.sedes.find((s) => s.esCocina);
    if (!cocina) return falla("No hay una sede marcada como cocina", "sede");
    const reparto: { sedeId: number; packId: number; cantidad: number }[] = (c.body?.reparto ?? []).filter((r: { cantidad: number }) => r.cantidad !== 0);
    for (const r of reparto) {
      buscar(c.e.sedes, r.sedeId, "Sede");
      if (r.sedeId === cocina.id) falla("El reparto es hacia otras sedes", "reparto");
      if (!p.lineas.some((x) => x.packId === r.packId)) falla(`${nombrePack(c.e, r.packId)} no está en esta producción`, "reparto");
      if (!entero(r.cantidad)) falla("El reparto debe ser en enteros ≥ 0", "reparto");
    }
    for (const l of p.lineas) {
      const enviados = reparto.filter((r) => r.packId === l.packId).reduce((a, r) => a + r.cantidad, 0);
      if (enviados > real(l.packId)) falla(`Se reparten ${enviados} de ${nombrePack(c.e, l.packId)} pero se produjeron ${real(l.packId)}`, "reparto");
    }
    p.lineas = p.lineas.map((l) => ({ ...l, real: real(l.packId) }));
    Object.assign(p, { estado: "cerrada", cierre: dia });
    for (const l of p.lineas) if (l.real) mov(c.e, { fecha: dia, sedeId: cocina.id, produccionId: p.id, packId: l.packId, cantidad: l.real, tipo: "produccion", refId: p.id });
    for (const sedeId of new Set(reparto.map((r) => r.sedeId))) {
      const t = { id: nuevoId(c.e), fecha: dia, origenId: cocina.id, destinoId: sedeId, notas: `Reparto al cerrar ${p.codigo}`,
        lineas: reparto.filter((r) => r.sedeId === sedeId).map((r) => ({ produccionId: p.id, packId: r.packId, cantidad: r.cantidad })) };
      c.e.traslados.push(t);
      for (const l of t.lineas) {
        mov(c.e, { fecha: dia, sedeId: cocina.id, produccionId: p.id, packId: l.packId, cantidad: -l.cantidad, tipo: "traslado_salida", refId: t.id });
        mov(c.e, { fecha: dia, sedeId, produccionId: p.id, packId: l.packId, cantidad: l.cantidad, tipo: "traslado_entrada", refId: t.id });
      }
    }
    return ok(produccionResumen(c.e, p));
  } },
];

/** Bandejas y stickers: compradas − consumidas por producciones cerradas; alcanza si cubre otra producción como la última. */
export function estadoEnvases(e: Estado) {
  const cerradas = e.producciones.filter((p) => p.estado === "cerrada" && p.lineas.length);
  const ultima = ultimaCerrada(e);
  const packs = (p?: Produccion) => (p ? packsReales(p) : 0);
  const de = (tipo: "bandeja" | "sticker", porPack: number) => {
    const ins = e.insumos.find((i) => i.esEnvase === tipo);
    const comprado = e.compras.filter((x) => x.estado === "comprada").flatMap((x) => x.lineas)
      .filter((l) => l.insumoId === ins?.id).reduce((a, l) => a + l.cantidad, 0);
    const consumido = cerradas.reduce((a, p) => a + packs(p) * porPack, 0);
    const necesidad = packs(ultima) * porPack;
    return { insumoId: ins?.id ?? null, comprado, consumido, stock: comprado - consumido, necesidad, alcanza: comprado - consumido >= necesidad };
  };
  return { bandeja: de("bandeja", e.parametros.bandejasPorPack), sticker: de("sticker", e.parametros.stickersPorPack) };
}

const rutasCompras: Ruta[] = [
  { metodo: "GET", patron: "/compras", manejar: (c) => {
    const pid = c.query.get("produccionId");
    const items = c.e.compras.filter((x) => !pid || x.produccionId === Number(pid)).map((x) => compraVista(c.e, x));
    return lista(listar(items, c.query, { buscarEn: ["proveedor", "produccion"], ordenPorDefecto: "id", dirPorDefecto: "desc" }));
  } },
  { metodo: "POST", patron: "/compras", manejar: (c) => {
    buscar(c.e.proveedores, c.body?.proveedorId, "Proveedor");
    const compra: Compra = { id: nuevoId(c.e), proveedorId: c.body.proveedorId, estado: "pendiente", lineas: [] };
    c.e.compras.push(compra);
    const r = comprar(c, compra);
    return creado({ ...compraVista(c.e, r.compra), alertas: r.alertas });
  } },
  { metodo: "POST", patron: "/compras/:id/comprar", manejar: (c) => {
    const compra = buscar(c.e.compras, c.params.id, "Compra");
    if (compra.estado === "comprada") falla("Esta compra ya está registrada", "estado");
    const r = comprar(c, compra);
    return ok({ ...compraVista(c.e, r.compra), alertas: r.alertas });
  } },
  { metodo: "GET", patron: "/envases", manejar: (c) => ok(estadoEnvases(c.e)) },
];

const rutasStock: Ruta[] = [
  { metodo: "GET", patron: "/traslados", manejar: (c) => lista(listar(c.e.traslados.map((t) => ({ ...t, origen: nombreSede(c.e, t.origenId), destino: nombreSede(c.e, t.destinoId),
    packs: packsVenta(t),
    lineas: t.lineas.map((l) => ({ ...l, pack: nombrePack(c.e, l.packId), lote: codigoProduccion(c.e, l.produccionId) })) })),
    c.query, { buscarEn: ["origen", "destino", "notas"], ordenPorDefecto: "fecha", dirPorDefecto: "desc" })) },
  { metodo: "POST", patron: "/traslados", manejar: (c) => {
    const b = c.body ?? {};
    buscar(c.e.sedes, b.origenId, "Sede");
    buscar(c.e.sedes, b.destinoId, "Sede");
    if (b.origenId === b.destinoId) falla("Origen y destino deben ser distintos", "destinoId");
    if (!Array.isArray(b.lineas) || !b.lineas.length) falla("Agregá al menos un pack", "lineas");
    salidaInvalida(c.e, b.origenId, b.lineas);
    const dia = fecha(b.fecha, c.hoy);
    const t = { id: nuevoId(c.e), fecha: dia, origenId: b.origenId, destinoId: b.destinoId, notas: b.notas,
      lineas: b.lineas.map((l: { produccionId: number; packId: number; cantidad: number }) => ({ produccionId: l.produccionId, packId: l.packId, cantidad: l.cantidad })) };
    c.e.traslados.push(t);
    for (const l of t.lineas) {
      mov(c.e, { fecha: dia, sedeId: t.origenId, produccionId: l.produccionId, packId: l.packId, cantidad: -l.cantidad, tipo: "traslado_salida", refId: t.id });
      mov(c.e, { fecha: dia, sedeId: t.destinoId, produccionId: l.produccionId, packId: l.packId, cantidad: l.cantidad, tipo: "traslado_entrada", refId: t.id });
    }
    return creado(t);
  } },
  { metodo: "POST", patron: "/ajustes-stock", manejar: (c) => {
    const b = c.body ?? {};
    buscar(c.e.sedes, b.sedeId, "Sede");
    buscar(c.e.packs, b.packId, "Pack");
    if (!Number.isInteger(b.cantidad) || b.cantidad === 0) falla("La cantidad debe ser un entero distinto de cero", "cantidad");
    if (!String(b.motivo ?? "").trim()) falla("Indicá el motivo del ajuste", "motivo");
    let produccionId = b.produccionId;
    if (produccionId) buscar(c.e.producciones, produccionId, "Producción");
    else {
      let inicial = c.e.producciones.find((p) => p.codigo === "INICIAL");
      if (!inicial) {
        inicial = { id: nuevoId(c.e), codigo: "INICIAL", numero: 0, estado: "cerrada", inicio: c.hoy, cierre: c.hoy, lineas: [],
          snapshot: { costos: {}, platos: {}, packs: [], insumos: [], parametros: { ...c.e.parametros } }, costosPagados: {}, sobrantes: {} };
        c.e.producciones.push(inicial);
      }
      produccionId = inicial.id;
    }
    if (b.cantidad < 0 && disponible(c.e.movimientos, b.sedeId, produccionId, b.packId) + b.cantidad < 0) falla("El ajuste deja el stock en negativo", "cantidad");
    const m = { fecha: fecha(b.fecha, c.hoy), sedeId: b.sedeId, produccionId, packId: b.packId, cantidad: b.cantidad, tipo: "ajuste" as const, motivo: String(b.motivo).trim() };
    mov(c.e, m);
    return creado(m);
  } },
];

const TIPOS_VENTA = ["minorista", "mayorista", "consignacion", "uso_interno", "pago_con_packs"];
const MEDIOS = ["transferencia", "efectivo", "mercado_pago", "otro", "packs"];

const rutasVentas: Ruta[] = [
  { metodo: "GET", patron: "/ventas", manejar: (c) => {
    const q = c.query;
    const memo = new Map<number, number>();
    const items = c.e.ventas.filter((v) =>
      (!q.get("sedeId") || v.sedeId === Number(q.get("sedeId"))) && (!q.get("tipo") || v.tipo === q.get("tipo")) &&
      (!q.get("clienteId") || v.clienteId === Number(q.get("clienteId"))) && (!q.get("desde") || v.fecha >= q.get("desde")!) &&
      (!q.get("hasta") || v.fecha <= q.get("hasta")!))
      .map((v) => ventaVista(c.e, v, memo));
    return lista(listar(items, q, { buscarEn: ["cliente", "sede", "notas"], ordenPorDefecto: "fecha", dirPorDefecto: "desc" }));
  } },
  { metodo: "GET", patron: "/ventas/:id", manejar: (c) => {
    const v = buscar(c.e.ventas, c.params.id, "Venta");
    return ok({ ...ventaVista(c.e, v), cobros: c.e.cobros.filter((x) => x.ventaId === v.id) });
  } },
  { metodo: "POST", patron: "/ventas", manejar: (c) => {
    const b = c.body ?? {};
    buscar(c.e.sedes, b.sedeId, "Sede");
    if (b.clienteId) buscar(c.e.clientes, b.clienteId, "Cliente");
    if (!TIPOS_VENTA.includes(b.tipo)) falla("Tipo de venta inválido", "tipo");
    if (!MEDIOS.includes(b.medio)) falla("Medio de pago inválido", "medio");
    if (!Array.isArray(b.lineas) || !b.lineas.length) falla("Agregá al menos un pack", "lineas");
    if (b.tipo === "pago_con_packs" && !String(b.notas ?? "").trim()) falla("Indicá qué recibiste a cambio", "notas");
    const noEsIngreso = !esIngreso(b);
    const lineas: LineaVenta[] = b.lineas.map((l: LineaVenta) => {
      buscar(c.e.packs, l.packId, "Pack");
      const precio = noEsIngreso ? 0 : l.precioUnitario ?? precioDePack(c.e, l.packId);
      if (typeof precio !== "number" || precio < 0) falla("Revisá los precios", "lineas");
      return { produccionId: l.produccionId, packId: l.packId, cantidad: l.cantidad, precioUnitario: precio };
    });
    salidaInvalida(c.e, b.sedeId, lineas);
    const v: Venta = { id: nuevoId(c.e), fecha: fecha(b.fecha, c.hoy), sedeId: b.sedeId, tipo: b.tipo, medio: b.medio, lineas,
      descuento: noEsIngreso ? 0 : Number(b.descuento) || 0, envio: noEsIngreso ? 0 : Number(b.envio) || 0,
      ...(b.clienteId ? { clienteId: b.clienteId } : {}), ...(b.motivo ? { motivo: b.motivo } : {}), ...(b.notas ? { notas: b.notas } : {}) };
    if (v.descuento < 0 || v.envio < 0) falla("Descuento y envío deben ser ≥ 0", "descuento");
    const total = totalVenta(v);
    if (total < 0) falla("El descuento supera el total", "descuento");
    c.e.ventas.push(v);
    for (const l of lineas) mov(c.e, { fecha: v.fecha, sedeId: v.sedeId, produccionId: l.produccionId, packId: l.packId, cantidad: -l.cantidad, tipo: "venta", refId: v.id });
    // se cobra completa antes de entregar: un cobro por el total
    if (total > 0) c.e.cobros.push({ id: nuevoId(c.e), ventaId: v.id, fecha: v.fecha, monto: total, medio: v.medio });
    if (v.tipo === "pago_con_packs") {
      c.e.gastos.push({ id: nuevoId(c.e), fecha: v.fecha, tipo: String(b.tipoGasto ?? "").trim() || "personal", detalle: String(v.notas).trim(), monto: lineas.reduce((a, l) => a + l.cantidad * precioDePack(c.e, l.packId), 0),
        medio: "packs", pagado: true, origen: { ventaId: v.id } });
    }
    return creado(ventaVista(c.e, v));
  } },
];

const rutasClientes: Ruta[] = [
  // antes del CRUD para que "recontacto" no se tome como :id
  { metodo: "GET", patron: "/clientes/recontacto", manejar: (c) => ok({
    recontactos: recontactos(c.e.clientes, c.e.ventas, c.hoy, c.e.parametros.diasRecontacto)
      .map((r) => ({ ...r, cliente: clienteVista(c.e, r.cliente, c.hoy), packs: r.packIds.map((id) => nombrePack(c.e, id)) })),
    cumpleanos: cumpleanosHoy(c.e.clientes, c.hoy).map((x) => clienteVista(c.e, x, c.hoy)),
  }) },
  ...crud("/clientes", "clientes", { campos: ["nombre", "apellido", "telefono", "domicilio", "cumpleanos", "notas"], requeridos: ["nombre", "apellido"],
    buscarEn: ["nombreCompleto", "telefono", "domicilio"], orden: "nombreCompleto", vista: (c, x) => clienteVista(c.e, x, c.hoy),
    validar: (x) => {
      if (x.cumpleanos === undefined || x.cumpleanos === null || x.cumpleanos === "") return void (x.cumpleanos = undefined);
      // acepta "MM-DD" o la fecha completa de un <input type="date"> y guarda "MM-DD"
      const m = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(String(x.cumpleanos));
      const mes = Number(m?.[1]), dia = Number(m?.[2]);
      if (!m || dia < 1 || dia > diasDelMes(mes)) falla("Cumpleaños inválido (MM-DD)", "cumpleanos");
      x.cumpleanos = `${m![1]}-${m![2]}`;
    } }),
  ...crud("/gastos", "gastos", { campos: ["fecha", "tipo", "detalle", "monto", "medio", "pagado", "notas"], requeridos: ["fecha", "tipo", "detalle", "monto"],
    buscarEn: ["detalle", "tipo"], orden: "fecha", dir: "desc", defaults: { pagado: true, medio: "transferencia" },
    validar: (x) => {
      if (x.origen) falla("Este gasto se generó automáticamente", "origen");
      if (typeof x.fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.fecha)) falla("Fecha inválida (AAAA-MM-DD)", "fecha");
      if (!positivo(x.monto)) falla("El monto debe ser un número mayor a cero", "monto");
      if (!MEDIOS.includes(String(x.medio))) falla("Medio de pago inválido", "medio");
      if (typeof x.pagado !== "boolean") falla("Indicá si está pagado", "pagado");
    } }),
];

export const rutas: Ruta[] = [...rutasProduccion, ...rutasCompras, ...rutasStock, ...rutasVentas, ...rutasClientes];
