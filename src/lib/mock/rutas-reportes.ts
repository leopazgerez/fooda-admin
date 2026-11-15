// Reportes de solo lectura: stock, finanzas mensuales (+ cierre de mes), análisis de packs y dashboard.
import { cumpleanosHoy, mesAnterior, recontactos } from "../domain/clientes.ts";
import { enPacks, indirectoAplicable, indirectoDelMes, repartoReservas, resumenMes } from "../domain/finanzas.ts";
import { porVigencia } from "../domain/produccion.ts";
import { esIngreso, totalVenta } from "../domain/ventas.ts";
import { buscar, creado, falla, ok, type Ctx, type Ruta } from "./http.ts";
import { estadoEnvases } from "./rutas-operacion.ts";
import type { Estado } from "./store.ts";
import { gananciaVenta, nombreCompleto, nombrePack, nombreProveedor, nombreSede, produccionResumen, stockVista, ultimaCerrada } from "./vistas.ts";

const num = (v: string | null) => (v ? Number(v) : undefined);


function finanzasMes(e: Estado, mes: string) {
  const r = resumenMes(mes, e);
  const memo = new Map<number, number>();
  const ganancia = e.ventas.filter((v) => v.fecha.startsWith(mes)).reduce((a, v) => a + gananciaVenta(e, v, memo), 0);
  return {
    mes, ...r, cerrado: e.cierres.some((c) => c.mes === mes),
    indirecto: indirectoAplicable(mes, e.cierres, e.gastos, e.producciones, e.parametros),
    ganancia, gananciaEnPacks: enPacks(ganancia, e.parametros.precioPack),
    resultadoCajaEnPacks: enPacks(r.resultadoCaja, e.parametros.precioPack),
    reservas: repartoReservas(ganancia, e.reservas).map((x) => ({ nombre: x.reserva.nombre, porcentaje: x.reserva.porcentaje, monto: x.monto })),
  };
}

/** Lunes de la semana de una fecha "YYYY-MM-DD". */
function lunes(dia: string): string {
  const [y, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function versionEn(c: Ctx, packId: number, dia: string) {
  const vs = c.e.versiones.filter((v) => v.packId === packId).sort(porVigencia);
  const i = vs.map((v) => v.desde <= dia).lastIndexOf(true);
  if (i < 0) return falla("El pack no tenía versión en esa fecha", "fecha");
  const plato = (id: number) => c.e.platos.find((p) => p.id === id)?.nombre ?? "—";
  const version = vs[i], anterior = vs[i - 1];
  return {
    version, hasta: vs[i + 1]?.desde ?? null,
    menus: version.menus.map((m) => ({ numero: m.numero, plato: plato(m.platoId) })),
    anterior: anterior ?? null,
    cambios: anterior ? version.menus.flatMap((m, k) => {
      const a = anterior.menus[k];
      return a && (a.platoId !== m.platoId || a.numero !== m.numero)
        ? [{ numero: a.numero, antes: plato(a.platoId), despues: plato(m.platoId), numeroNuevo: m.numero }] : [];
    }) : [],
  };
}

export const rutas: Ruta[] = [
  { metodo: "GET", patron: "/stock", manejar: (c) => ok(stockVista(c.e, {
    sedeId: num(c.query.get("sedeId")), packId: num(c.query.get("packId")), produccionId: num(c.query.get("produccionId")) })) },

  { metodo: "GET", patron: "/finanzas/mensual", manejar: (c) => {
    const fechas = [...c.e.ventas.map((v) => v.fecha), ...c.e.gastos.map((g) => g.fecha), ...c.e.cobros.map((x) => x.fecha),
      ...c.e.producciones.map((p) => p.cierre ?? p.inicio), c.hoy];
    const meses = [...new Set(fechas.map((f) => f.slice(0, 7)))].sort().reverse().slice(0, 12);
    return ok(meses.map((m) => finanzasMes(c.e, m)));
  } },
  { metodo: "POST", patron: "/finanzas/cierres", manejar: (c) => {
    const mes = String(c.body?.mes ?? "");
    if (!/^\d{4}-\d{2}$/.test(mes)) falla("Indicá el mes (AAAA-MM)", "mes");
    if (c.e.cierres.some((x) => x.mes === mes)) falla("Ese mes ya está cerrado", "mes");
    const cierre = { mes, indirectoPorPack: indirectoDelMes(mes, c.e.gastos, c.e.producciones), cerradoEl: c.hoy };
    c.e.cierres.push(cierre);
    return creado(finanzasMes(c.e, mes));
  } },

  { metodo: "GET", patron: "/analisis/packs", manejar: (c) => {
    const hasta = c.query.get("hasta") ?? c.hoy;
    const desde = c.query.get("desde") ?? `${mesAnterior(c.hoy.slice(0, 7), 2)}-01`;
    const porSemana = c.query.get("agrupar") === "semana";
    const filas = new Map<string, { periodo: string; packId: number; pack: string; sedeId: number; sede: string; cantidad: number; monto: number }>();
    for (const v of c.e.ventas.filter((x) => esIngreso(x) && x.fecha >= desde && x.fecha <= hasta)) {
      const periodo = porSemana ? lunes(v.fecha) : v.fecha.slice(0, 7);
      for (const l of v.lineas) {
        const k = `${periodo}|${l.packId}|${v.sedeId}`;
        const f = filas.get(k) ?? { periodo, packId: l.packId, pack: nombrePack(c.e, l.packId), sedeId: v.sedeId, sede: nombreSede(c.e, v.sedeId), cantidad: 0, monto: 0 };
        f.cantidad += l.cantidad;
        f.monto += l.cantidad * l.precioUnitario;
        filas.set(k, f);
      }
    }
    const primeras = new Set(c.e.packs.map((p) => c.e.versiones.filter((v) => v.packId === p.id).sort(porVigencia)[0]?.id));
    const cambios = c.e.versiones.filter((v) => !primeras.has(v.id) && v.desde >= desde && v.desde <= hasta)
      .map((v) => ({ packId: v.packId, pack: nombrePack(c.e, v.packId), desde: v.desde, versionId: v.id }));
    return ok({ desde, hasta, agrupar: porSemana ? "semana" : "mes", filas: [...filas.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)), cambios });
  } },
  { metodo: "GET", patron: "/analisis/packs/:id/version-en", manejar: (c) => {
    const pack = buscar(c.e.packs, c.params.id, "Pack");
    return ok(versionEn(c, pack.id, c.query.get("fecha") ?? c.hoy));
  } },

  { metodo: "GET", patron: "/dashboard", manejar: (c) => {
    const mes = c.hoy.slice(0, 7), anterior = mesAnterior(mes);
    const actual = finanzasMes(c.e, mes);
    // mismo período del mes anterior (día 1 a hoy) para comparar ventas
    const mismoPeriodo = c.e.ventas.filter((v) => v.fecha >= `${anterior}-01` && v.fecha <= `${anterior}${c.hoy.slice(7)}`).reduce((a, v) => a + totalVenta(v), 0);
    const ventasPorPack = c.e.packs.map((p) => {
      const ls = c.e.ventas.filter((v) => esIngreso(v) && v.fecha.startsWith(mes)).flatMap((v) => v.lineas.map((l) => ({ ...l, sedeId: v.sedeId })))
        .filter((l) => l.packId === p.id);
      return { packId: p.id, pack: p.nombre, cantidad: ls.reduce((a, l) => a + l.cantidad, 0), monto: ls.reduce((a, l) => a + l.cantidad * l.precioUnitario, 0),
        porSede: c.e.sedes.map((s) => ({ sedeId: s.id, sede: s.nombre, cantidad: ls.filter((l) => l.sedeId === s.id).reduce((a, l) => a + l.cantidad, 0) })) };
    });
    const ultima = ultimaCerrada(c.e);
    const envases = estadoEnvases(c.e);
    return ok({
      hoy: c.hoy, mes: actual,
      ventasMesAnteriorMismoPeriodo: mismoPeriodo,
      stockPorSede: stockVista(c.e).porSede,
      ventasPorPack,
      producciones: c.e.producciones.filter((p) => p.lineas.length).slice(-5).reverse().map((p) => produccionResumen(c.e, p)),
      recupero: ultima ? { codigo: ultima.codigo, ...produccionResumen(c.e, ultima).recupero } : null,
      avisos: {
        recontactos: recontactos(c.e.clientes, c.e.ventas, c.hoy, c.e.parametros.diasRecontacto)
          .map((r) => ({ clienteId: r.cliente.id, cliente: nombreCompleto(r.cliente), diasSinComprar: r.diasSinComprar,
            packs: r.packIds.map((id) => nombrePack(c.e, id)) })),
        cumpleanos: cumpleanosHoy(c.e.clientes, c.hoy).map((x) => ({ clienteId: x.id, cliente: nombreCompleto(x), telefono: x.telefono ?? null })),
        envasesBajos: (["bandeja", "sticker"] as const).filter((t) => !envases[t].alcanza).map((t) => ({ tipo: t, ...envases[t] })),
        comprasPendientes: c.e.compras.filter((x) => x.estado === "pendiente").map((x) => ({ compraId: x.id,
          proveedor: nombreProveedor(c.e, x.proveedorId),
          produccion: c.e.producciones.find((p) => p.id === x.produccionId)?.codigo ?? null })),
      },
    });
  } },
];
