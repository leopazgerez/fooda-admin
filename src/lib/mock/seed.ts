// Semilla del prototipo: datos reales de la planilla de noviembre del cliente (insumos, recetas, packs)
// más un mes y medio de operación de ejemplo coherente (producciones, compras, traslados, ventas, gastos).
import { costoUnitario, montoCompra } from "../domain/costos.ts";
import { codigoLote, listaSuper, tomarSnapshot } from "../domain/produccion.ts";
import type {
  CierreMes, Cliente, Cobro, Compra, Gasto, Insumo, MedioPago, MovimientoStock, Pack, PackVersion, Parametros, Plato,
  PrecioInsumo, Produccion, Proveedor, Reserva, Sede, TipoVenta, Traslado, Unidad, Venta,
} from "../domain/types.ts";

export interface Estado {
  proveedores: Proveedor[]; insumos: Insumo[]; precios: PrecioInsumo[]; platos: Plato[]; packs: Pack[];
  versiones: PackVersion[]; sedes: Sede[]; producciones: Produccion[]; compras: Compra[];
  movimientos: MovimientoStock[]; traslados: Traslado[]; clientes: Cliente[]; ventas: Venta[]; cobros: Cobro[];
  gastos: Gasto[]; reservas: Reserva[]; cierres: CierreMes[];
  parametros: Parametros; motivos: string[]; tiposGasto: string[];
  /** próximo id global */
  seq: number;
}

const PROVEEDORES: [string, string?][] = [
  ["Súper", "jueves"], ["Cofruthos", "lunes"], ["Vegetales"], ["Pollo"], ["Cerdo"], ["Res"], ["El Milagro"], ["Belén"],
];

// [nombre, proveedor, unidad, presentación, precio envase, contenido] — planilla págs. 2–3
const INSUMOS: [string, string, Unidad, string, number, number][] = [
  ["Tallarines", "Belén", "g", "1kg", 1800, 1000],
  ["Bondiola", "Cerdo", "g", "1kg", 10000, 1000],
  ["Carne (roast beef/aguja)", "Res", "g", "1kg", 16500, 1000],
  ["Carne molida", "Res", "g", "1kg", 12500, 1000],
  ["Carré", "Cerdo", "g", "1kg", 12000, 1000],
  ["Pollo", "Pollo", "g", "1kg", 9500, 1000],
  ["Solomillo", "Cerdo", "g", "1kg", 8000, 1000],
  ["Miel", "Cofruthos", "g", "0,5kg", 4000, 500],
  ["Pimentón ahumado", "Cofruthos", "g", "0,1kg", 500, 100],
  ["Garbanzos", "Cofruthos", "g", "1kg", 3000, 1000],
  ["Lentejas", "Cofruthos", "g", "1kg", 3000, 1000],
  ["Nueces", "Cofruthos", "g", "0,1kg", 1400, 100],
  ["Pesto", "Cofruthos", "g", "250g", 3000, 250],
  ["Quinoa", "Cofruthos", "g", "1kg", 7000, 1000],
  ["Soja texturizada", "Cofruthos", "g", "1kg", 2500, 1000],
  ["Leche", "El Milagro", "ml", "1 litro", 1550, 1000],
  ["Manteca", "El Milagro", "g", "1kg", 9900, 1000],
  ["Muzzarella", "El Milagro", "g", "1kg", 7400, 1000],
  ["Queso azul", "El Milagro", "g", "1kg", 19200, 1000],
  ["Queso crema", "El Milagro", "g", "1kg", 7000, 1000],
  ["Queso sardo", "El Milagro", "g", "1kg", 9900, 1000],
  ["Aceite", "Súper", "ml", "1,5 litros", 4800, 1500],
  ["Azúcar", "Súper", "g", "1kg", 1500, 1000],
  ["Mostaza", "Súper", "g", "0,5kg", 2600, 500],
  ["Salsa BBQ", "Súper", "g", "0,25kg", 2200, 250],
  ["Salsa de soja", "Súper", "ml", "5 litros", 31700, 5000],
  ["Salsa de tomate", "Súper", "g", "2,9kg", 12100, 2900],
  ["Arroz", "Súper", "g", "1kg", 1200, 1000],
  ["Maicena", "Súper", "g", "1kg", 4500, 1000],
  ["Pan rallado", "Súper", "g", "1kg", 2900, 1000],
  ["Ravioles", "Súper", "g", "2kg", 10700, 2000],
  ["Champiñones", "Súper", "g", "230g", 3200, 230],
  ["Ajo", "Vegetales", "u", "1 cabeza", 1000, 1],
  ["Albahaca", "Vegetales", "u", "1 u", 4000, 1],
  ["Batata", "Vegetales", "g", "1kg", 2000, 1000],
  ["Berenjena", "Vegetales", "g", "1kg", 2500, 1000],
  ["Zapallo", "Vegetales", "g", "1kg", 1800, 1000],
  ["Calabaza", "Vegetales", "g", "1kg", 2500, 1000],
  ["Cebolla", "Vegetales", "g", "10kg", 12000, 10000],
  ["Coliflor o brócoli", "Vegetales", "u", "unidad", 2500, 1],
  ["Espinaca", "Vegetales", "u", "atado", 2500, 1],
  ["Limón", "Vegetales", "u", "docena", 1000, 12],
  ["Pimiento verde", "Vegetales", "g", "1kg", 2000, 1000],
  ["Pimiento rojo", "Vegetales", "g", "1kg", 3000, 1000],
  ["Papa", "Vegetales", "g", "1kg", 2000, 1000],
  ["Repollo morado", "Vegetales", "g", "unidad (~1kg)", 2500, 1000],
  ["Repollo blanco", "Vegetales", "u", "unidad", 2500, 1],
  ["Zanahoria", "Vegetales", "g", "1kg", 14000, 1000],
  ["Zapallitos", "Vegetales", "u", "~8kg / 60u", 7500, 60],
  ["Zucchini", "Vegetales", "g", "1kg", 2500, 1000],
  ["Huevo", "Vegetales", "u", "30u", 5000, 30],
  ["Harina", "Súper", "g", "1kg", 0, 1000],
];
const PIMIENTO = "Pimiento (50% rojo + 50% verde)";
const CALABAZA = "Calabaza/zapallo";

// Recetas (planilla págs. 4–8). [insumo, cantidad, unidad?, porciones?]; unidad por defecto la del insumo.
type R = [string, number, Unidad?, number?];
const PLATOS: { menus: number[]; nombre: string; receta: R[] }[] = [
  { menus: [1], nombre: "Ravioles con Queso Azul y Nueces", receta: [["Ravioles", 320], ["Queso crema", 30], ["Queso azul", 25], ["Leche", 60], ["Queso sardo", 35], ["Maicena", 10], ["Nueces", 20]] },
  { menus: [2], nombre: "Estofado de Carne con Papas y Batatas", receta: [["Carne (roast beef/aguja)", 150], ["Papa", 120], ["Batata", 100], ["Zanahoria", 60], ["Cebolla", 60], [PIMIENTO, 40], ["Salsa de tomate", 50]] },
  { menus: [3], nombre: "Bondiola Braseada con Tallarines al Pesto", receta: [["Bondiola", 180], ["Tallarines", 200], ["Pesto", 35], ["Albahaca", 0.25]] },
  { menus: [4, 21], nombre: "Canelones de Crema de Calabaza, Quinoa y Muzzarella Gratinados", receta: [["Leche", 112.5], ["Huevo", 0.45], ["Harina", 56.25], ["Manteca", 1.125], [CALABAZA, 190], ["Quinoa", 70], ["Muzzarella", 50], ["Cebolla", 40], ["Leche", 300], ["Huevo", 1], ["Manteca", 80], ["Maicena", 30]] },
  { menus: [5], nombre: "Pollo en Salsa Roja con Arroz y Legumbres", receta: [["Pollo", 180], ["Arroz", 60], ["Lentejas", 50], ["Cebolla", 75], ["Zanahoria", 80], ["Salsa de tomate", 80], [PIMIENTO, 40]] },
  { menus: [6, 11], nombre: "Wok Oriental de Pollo y Vegetales", receta: [["Pollo", 190], ["Cebolla", 60], ["Zanahoria", 60], ["Repollo morado", 60], [PIMIENTO, 60], ["Salsa de soja", 20], ["Pimentón ahumado", 5], ["Maicena", 10]] },
  { menus: [7], nombre: "Solomillo BBQ con Vegetales Asados", receta: [["Solomillo", 200], ["Zucchini", 100], ["Cebolla", 100], ["Coliflor o brócoli", 0.25], [CALABAZA, 100], ["Salsa BBQ", 40]] },
  { menus: [8, 15], nombre: "Tortilla de Espinaca y Muzzarella", receta: [["Huevo", 2, "u", 2], ["Espinaca", 0.5], ["Muzzarella", 50], ["Cebolla", 30], ["Queso crema", 20]] },
  { menus: [9], nombre: "Zapallitos Rellenos Low", receta: [["Carne molida", 150], ["Zapallitos", 3], ["Zanahoria", 50], ["Cebolla", 50], ["Salsa de tomate", 50], ["Leche", 90], ["Maicena", 10], ["Manteca", 10], ["Queso sardo", 15]] },
  { menus: [10], nombre: "Soufflé de Calabaza con Quinoa y Legumbres", receta: [["Lentejas", 120], ["Quinoa", 60], [CALABAZA, 250], ["Queso crema", 40], ["Queso sardo", 40], ["Huevo", 2]] },
  { menus: [12], nombre: "Bondiola Desmenuzada con Vegetales Salteados y Quinoa", receta: [["Bondiola", 200], ["Quinoa", 60], ["Zucchini", 60], ["Zanahoria", 50], ["Cebolla", 40], [PIMIENTO, 40], ["Salsa de soja", 10]] },
  { menus: [13], nombre: "Albóndigas en Salsa Roja con Vegetales y Quinoa", receta: [["Carne molida", 180], ["Cebolla", 50], ["Zanahoria", 50], ["Pan rallado", 15], ["Huevo", 0.5], ["Salsa de tomate", 150], ["Quinoa", 60], ["Zucchini", 50], [PIMIENTO, 50]] },
  { menus: [14], nombre: "Cerdo Teriyaki con Vegetales y Legumbres", receta: [["Carré", 200], ["Cebolla", 60], ["Zanahoria", 60], [PIMIENTO, 50], ["Repollo blanco", 0.25], ["Garbanzos", 120], ["Salsa de soja", 50], ["Miel", 20], ["Azúcar", 10]] },
  { menus: [16], nombre: "Pollo Teriyaki con Vegetales y Garbanzos Salteados", receta: [["Pollo", 200], ["Cebolla", 60], ["Zanahoria", 60], [PIMIENTO, 50], ["Repollo blanco", 0.25], ["Garbanzos", 120], ["Salsa de soja", 50], ["Miel", 20], ["Azúcar", 10]] },
  { menus: [17], nombre: "Solomillo al Limón y Mostaza con Quinoa Cremosa", receta: [["Solomillo", 200], [CALABAZA, 100], ["Repollo blanco", 0.3], ["Zanahoria", 60], ["Zucchini", 70], ["Quinoa", 30], ["Limón", 1], ["Mostaza", 20], ["Queso crema", 30]] },
  { menus: [18], nombre: "Albóndigas en Salsa Roja con Arroz/Legumbres", receta: [["Carne molida", 180], ["Zanahoria", 60], ["Cebolla", 50], ["Pan rallado", 15], ["Huevo", 0.5], ["Arroz", 60], ["Lentejas", 100], ["Salsa de tomate", 200]] },
  { menus: [19], nombre: "Chop Suey de Pollo con Tallarines", receta: [["Pollo", 180], ["Repollo blanco", 0.25], ["Repollo morado", 0.25, "u"], ["Cebolla", 30], ["Zanahoria", 70], ["Tallarines", 50], ["Salsa de soja", 30], ["Pimentón ahumado", 3]] },
  { menus: [20], nombre: "Risotto de Quinoa con Calabaza y Cerdo", receta: [["Carré", 180], ["Quinoa", 70], [CALABAZA, 100], ["Cebolla", 60], ["Queso crema", 30]] },
  { menus: [22], nombre: "Zapallitos Rellenos Vegetarianos", receta: [["Zapallitos", 3], ["Quinoa", 60], ["Soja texturizada", 40], ["Zanahoria", 50], ["Cebolla", 50], ["Salsa de tomate", 100], ["Leche", 90], ["Maicena", 10], ["Manteca", 10], ["Queso sardo", 15]] },
  { menus: [23], nombre: "Ravioles con Crema de Morrones Asados y Manteca", receta: [["Ravioles", 320], ["Pimiento rojo", 150], ["Manteca", 25], ["Queso crema", 30], ["Leche", 60], ["Queso sardo", 20]] },
  { menus: [24], nombre: "Pastel de Berenjenas Gratinado con Champiñones", receta: [["Berenjena", 300], ["Champiñones", 100], ["Cebolla", 80], ["Queso crema", 40], ["Leche", 100], ["Maicena", 10], ["Manteca", 10], ["Muzzarella", 60], ["Queso sardo", 15]] },
  { menus: [25], nombre: "Chop Suey Vegetariano", receta: [["Repollo blanco", 0.25], ["Repollo morado", 0.25, "u"], ["Cebolla", 40], ["Zanahoria", 80], ["Zucchini", 70], ["Tallarines", 50], ["Salsa de soja", 30], ["Pimentón ahumado", 3]] },
];
const PACKS = ["Caserito", "Low Carb", "Proteico", "Equilibrio", "Full Veggie"];

const CLIENTES: [string, string, string, string, string?][] = [
  ["Juan Pablo", "Ríos", "387 512-3344", "Los Ceibos 120, Salta"],
  ["María", "Gómez", "387 498-1120", "Belgrano 845, Salta", "11-15"],
  ["Lucía", "Fernández", "3877 40-8812", "San Martín 50, J.V. González"],
  ["Gimnasio", "Balance", "387 533-0071", "Av. Bolivia 3100, Salta"],
  ["Carlos", "Medina", "3877 41-2290", "Rivadavia 210, J.V. González"],
  ["Ana", "Paz", "387 421-6650", "Caseros 1500, Salta"],
  ["Pedro", "Álvarez", "387 455-0198", "Mitre 77, Salta"],
  ["Sofía", "Cruz", "3877 43-7781", "Güemes 34, J.V. González"],
];

export function semilla(): Estado {
  let seq = 1;
  const id = () => seq++;
  const e: Estado = {
    proveedores: [], insumos: [], precios: [], platos: [], packs: [], versiones: [], sedes: [], producciones: [],
    compras: [], movimientos: [], traslados: [], clientes: [], ventas: [], cobros: [], gastos: [], reservas: [], cierres: [],
    parametros: {} as Parametros, motivos: ["recontacto", "nuevo", "repatriado", "fiel"],
    tiposGasto: ["fijo", "mercadería", "inversión", "personal"], seq: 0,
  };

  e.proveedores = PROVEEDORES.map(([nombre, diaCompra], i) => ({ id: id(), nombre, orden: i + 1, ...(diaCompra ? { diaCompra } : {}) }));
  const prov = (n: string) => e.proveedores.find((p) => p.nombre === n)!.id;

  const precioInicial = (insumoId: number, precioEnvase: number) => e.precios.push({ id: id(), insumoId, fecha: "2026-10-01", precioEnvase });
  for (const [nombre, p, unidad, presentacion, precio, contenido] of INSUMOS) {
    const ins: Insumo = { id: id(), nombre, unidad, proveedorId: prov(p), presentacion, contenido, activo: true,
      ...(nombre === "Repollo morado" ? { gramosPorUnidad: 1000 } : {}) };
    e.insumos.push(ins);
    precioInicial(ins.id, precio);
  }
  const insumo = (n: string) => e.insumos.find((i) => i.nombre === n)!;
  e.insumos.push(
    { id: id(), nombre: PIMIENTO, unidad: "g", proveedorId: prov("Vegetales"), contenido: 1, activo: true,
      compuesto: { regla: "promedio", insumoIds: [insumo("Pimiento rojo").id, insumo("Pimiento verde").id] } },
    { id: id(), nombre: CALABAZA, unidad: "g", proveedorId: prov("Vegetales"), contenido: 1, activo: true,
      compuesto: { regla: "maximo", insumoIds: [insumo("Zapallo").id, insumo("Calabaza").id] } },
  );
  for (const [nombre, t, p, precio] of [["Bandeja", "bandeja", "Súper", 750], ["Sticker", "sticker", "Belén", 1500]] as const) {
    const ins: Insumo = { id: id(), nombre, unidad: "u", proveedorId: prov(p), presentacion: "unidad", contenido: 1, esEnvase: t, activo: true };
    e.insumos.push(ins);
    precioInicial(ins.id, precio);
  }

  const menuPlato = new Map<number, number>();
  for (const pl of PLATOS) {
    const plato: Plato = { id: id(), nombre: pl.nombre, receta: pl.receta.map(([n, cantidad, unidad, porciones]) => {
      const i = insumo(n);
      return { insumoId: i.id, cantidad, unidad: unidad ?? i.unidad, porciones: porciones ?? 1 };
    }) };
    e.platos.push(plato);
    for (const m of pl.menus) menuPlato.set(m, plato.id);
  }
  PACKS.forEach((nombre, i) => {
    const pack: Pack = { id: id(), numero: i + 1, nombre, activo: true };
    e.packs.push(pack);
    e.versiones.push({ id: id(), packId: pack.id, desde: "2026-10-01",
      menus: [1, 2, 3, 4, 5].map((k) => ({ numero: i * 5 + k, platoId: menuPlato.get(i * 5 + k)! })) });
  });
  const packId = (numero: number) => e.packs[numero - 1].id;

  e.parametros = { precioPack: 45000, aceiteMlPorPack: 20, aceiteInsumoId: insumo("Aceite").id, bandejasPorPack: 5, stickersPorPack: 1,
    indirectoReferencia: 1000, mesesRegular: 2, diasRecontacto: 30, alertaSubaPrecio: 0.15 };

  e.sedes = [
    { id: id(), nombre: "Salta", direccion: "Cocina central, Salta Capital", capacidad: 300, umbralStock: 20, umbralLugaresLibres: 999,
      envio: { tipo: "monto", valor: 0 }, afectaPrecio: false, esCocina: true },
    { id: id(), nombre: "J.V. González", direccion: "Punto de entrega, Joaquín V. González", capacidad: 60, umbralStock: 8, umbralLugaresLibres: 20,
      envio: { tipo: "monto", valor: 9000 }, afectaPrecio: false, esCocina: false },
  ];
  const [SALTA, JVG] = e.sedes.map((s) => s.id);

  e.reservas = [["Producción", 40], ["Envases", 10], ["Ahorro", 20], ["Monotributo", 10], ["Emergencia", 10]]
    .map(([nombre, porcentaje]) => ({ id: id(), nombre: nombre as string, porcentaje: porcentaje as number }));
  e.clientes = CLIENTES.map(([nombre, apellido, telefono, domicilio, cumpleanos]) =>
    ({ id: id(), nombre, apellido, telefono, domicilio, ...(cumpleanos ? { cumpleanos } : {}) }));

  // ── Operación de ejemplo ──
  const mov = (fecha: string, sedeId: number, produccionId: number, pk: number, cantidad: number, tipo: MovimientoStock["tipo"], refId?: number, motivo?: string) =>
    e.movimientos.push({ id: id(), fecha, sedeId, produccionId, packId: pk, cantidad, tipo, ...(refId ? { refId } : {}), ...(motivo ? { motivo } : {}) });
  const gasto = (fecha: string, tipo: string, detalle: string, monto: number, medio: MedioPago = "transferencia", origen?: Gasto["origen"]) => {
    const g: Gasto = { id: id(), fecha, tipo, detalle, monto, medio, pagado: true, ...(origen ? { origen } : {}) };
    e.gastos.push(g);
    return g;
  };
  const precioNuevo = (nombre: string, fecha: string, factor: number) => {
    const i = insumo(nombre);
    const ultimo = e.precios.filter((p) => p.insumoId === i.id).at(-1)!;
    e.precios.push({ id: id(), insumoId: i.id, fecha, precioEnvase: Math.round(ultimo.precioEnvase * factor) });
  };

  // Stock inicial (lote INICIAL) cargado como ajuste.
  const inicial: Produccion = { id: id(), codigo: "INICIAL", numero: 0, estado: "cerrada", inicio: "2026-09-01", cierre: "2026-09-01", lineas: [],
    snapshot: { costos: {}, platos: {}, packs: [], insumos: [], parametros: { ...e.parametros } }, costosPagados: {}, sobrantes: {} };
  e.producciones.push(inicial);
  mov("2026-09-01", SALTA, inicial.id, packId(1), 6, "ajuste", undefined, "Stock inicial");
  mov("2026-09-01", SALTA, inicial.id, packId(2), 4, "ajuste", undefined, "Stock inicial");

  // Envases comprados por adelantado.
  const compraEnvases = (fecha: string, nombre: "Bandeja" | "Sticker", cantidad: number) => {
    const i = insumo(nombre);
    const precioEnvase = e.precios.find((p) => p.insumoId === i.id)!.precioEnvase;
    const c: Compra = { id: id(), proveedorId: i.proveedorId, estado: "comprada", fecha, lineas: [{ insumoId: i.id, cantidad, precioEnvase }] };
    c.gastoId = gasto(fecha, "mercadería", `Compra de ${nombre.toLowerCase()}s`, cantidad * precioEnvase, "transferencia", { compraId: c.id }).id;
    e.compras.push(c);
  };
  compraEnvases("2026-09-25", "Bandeja", 1500);
  compraEnvases("2026-09-25", "Sticker", 140);

  const producir = (numero: number, inicio: string, cierre: string | undefined, porPack: number, aJvg: number, subas: [string, number][] = []) => {
    const lineas = e.packs.map((p) => ({ packId: p.id, planificada: porPack, ...(cierre ? { real: porPack } : {}) }));
    const p: Produccion = { id: id(), codigo: codigoLote(numero, inicio), numero, estado: cierre ? "cerrada" : "planificada", inicio,
      ...(cierre ? { cierre } : {}), lineas,
      snapshot: tomarSnapshot(e.packs.map((x) => x.id), e.versiones, e.platos, e.insumos, e.precios, e.parametros, inicio),
      costosPagados: {}, sobrantes: {} };
    e.producciones.push(p);
    const fechaCompra = cierre ? inicio : undefined;
    if (fechaCompra) for (const [n, f] of subas) precioNuevo(n, fechaCompra, f);
    for (const g of listaSuper(p, e.insumos, e.proveedores)) {
      const c: Compra = { id: id(), produccionId: p.id, proveedorId: g.proveedor.id, estado: fechaCompra ? "comprada" : "pendiente",
        ...(fechaCompra ? { fecha: fechaCompra } : {}),
        lineas: g.items.map((it) => {
          const ins = insumo(it.nombre);
          const costo = fechaCompra ? costoUnitario(ins, e.precios, e.insumos, fechaCompra) : it.costoUnitario;
          if (fechaCompra) p.costosPagados[ins.id] = costo;
          return { insumoId: ins.id, cantidad: it.cantidad, precioEnvase: costo * ins.contenido };
        }) };
      if (fechaCompra) {
        c.gastoId = gasto(fechaCompra, "mercadería", `Compra ${g.proveedor.nombre} · ${p.codigo}`, montoCompra(e.insumos, c.lineas), "transferencia", { compraId: c.id }).id;
      }
      e.compras.push(c);
    }
    if (!cierre) return p;
    for (const l of lineas) mov(cierre, SALTA, p.id, l.packId, porPack, "produccion", p.id);
    const t: Traslado = { id: id(), fecha: cierre, origenId: SALTA, destinoId: JVG, notas: `Reparto al cerrar ${p.codigo}`, lineas: e.packs.map((x) => ({ produccionId: p.id, packId: x.id, cantidad: aJvg })) };
    e.traslados.push(t);
    for (const l of t.lineas) {
      mov(cierre, SALTA, p.id, l.packId, -l.cantidad, "traslado_salida", t.id);
      mov(cierre, JVG, p.id, l.packId, l.cantidad, "traslado_entrada", t.id);
    }
    return p;
  };
  const oct = producir(1, "2026-10-02", "2026-10-06", 10, 4);
  const nov = producir(1, "2026-11-01", "2026-11-04", 10, 5, [["Pollo", 1.1], ["Zanahoria", 1.05]]);
  producir(2, "2026-11-14", undefined, 10, 0);

  // Ventas: [fecha, sede, cliente (índice) | null, tipo, [lote, pack, cantidad][], (sin uso: toda venta se cobra completa), medio, motivo?, precio?]
  const L = [inicial, oct, nov];
  type V = [string, number, number | null, TipoVenta, [number, number, number][], number, MedioPago, string?, number?];
  const VENTAS: V[] = [
    ["2026-09-10", SALTA, 0, "minorista", [[0, 1, 2]], 1, "transferencia", "nuevo"],
    ["2026-09-12", SALTA, 1, "minorista", [[0, 2, 1]], 1, "efectivo", "nuevo"],
    ["2026-09-20", SALTA, 3, "mayorista", [[0, 1, 3], [0, 2, 2]], 1, "transferencia", "nuevo", 42000],
    ["2026-10-07", SALTA, 0, "minorista", [[1, 1, 2]], 1, "transferencia", "fiel"],
    ["2026-10-08", SALTA, 1, "minorista", [[1, 2, 1], [1, 3, 1]], 1, "transferencia", "fiel"],
    ["2026-10-09", JVG, 2, "minorista", [[1, 1, 2]], 1, "efectivo", "nuevo"],
    ["2026-10-10", SALTA, 3, "mayorista", [[1, 3, 3], [1, 4, 3]], 1, "transferencia", "fiel", 42000],
    ["2026-10-12", JVG, 4, "minorista", [[1, 5, 1]], 1, "transferencia", "nuevo"],
    ["2026-10-14", SALTA, 5, "minorista", [[1, 1, 1]], 1, "transferencia", "nuevo"],
    ["2026-10-15", SALTA, 6, "minorista", [[1, 2, 2]], 1, "mercado_pago", "nuevo"],
    ["2026-10-18", JVG, 2, "minorista", [[1, 2, 2]], 1, "transferencia"],
    ["2026-10-20", SALTA, null, "minorista", [[1, 5, 2]], 1, "efectivo"],
    ["2026-10-22", SALTA, 0, "minorista", [[1, 4, 1]], 1, "transferencia"],
    ["2026-10-25", JVG, 4, "minorista", [[1, 3, 1]], 1, "transferencia"],
    ["2026-10-28", SALTA, 3, "mayorista", [[1, 1, 1], [1, 2, 1]], 1, "transferencia", undefined, 42000],
    ["2026-10-30", SALTA, null, "uso_interno", [[1, 5, 1]], 0, "otro"],
    ["2026-11-05", SALTA, 1, "minorista", [[1, 1, 2]], 1, "transferencia", "fiel"],
    ["2026-11-06", JVG, 2, "minorista", [[2, 1, 2], [1, 4, 1]], 1, "transferencia", "fiel"],
    ["2026-11-07", SALTA, 3, "mayorista", [[2, 3, 4], [2, 4, 4]], 0.5, "transferencia", "fiel", 42000],
    ["2026-11-08", SALTA, null, "pago_con_packs", [[2, 5, 1]], 0, "packs"],
    ["2026-11-09", JVG, 7, "minorista", [[2, 2, 2]], 0, "transferencia", "nuevo"],
    ["2026-11-10", SALTA, 0, "minorista", [[2, 1, 1]], 1, "transferencia", "fiel"],
    ["2026-11-11", JVG, 4, "minorista", [[1, 5, 2]], 1, "efectivo", "recontacto"],
    ["2026-11-12", SALTA, 1, "minorista", [[2, 2, 1], [1, 2, 1]], 1, "transferencia", "fiel"],
    ["2026-11-13", SALTA, null, "minorista", [[1, 3, 1]], 1, "efectivo"],
    ["2026-11-14", JVG, 2, "minorista", [[2, 5, 2]], 1, "mercado_pago", "fiel"],
    ["2026-11-14", SALTA, 0, "minorista", [[2, 5, 1]], 1, "transferencia", "fiel"],
  ];
  for (const [fecha, sedeId, cli, tipo, ls, , medio, motivo, precio] of VENTAS) {
    const v: Venta = { id: id(), fecha, sedeId, tipo, descuento: 0, envio: 0, medio,
      ...(cli !== null ? { clienteId: e.clientes[cli].id } : {}), ...(motivo ? { motivo } : {}),
      ...(tipo === "pago_con_packs" ? { notas: "Pago a community manager" } : {}),
      lineas: ls.map(([lote, pk, cantidad]) => ({ produccionId: L[lote].id, packId: packId(pk), cantidad,
        precioUnitario: tipo === "uso_interno" || tipo === "pago_con_packs" ? 0 : precio ?? e.parametros.precioPack })) };
    e.ventas.push(v);
    for (const l of v.lineas) mov(fecha, sedeId, l.produccionId, l.packId, -l.cantidad, "venta", v.id);
    const total = v.lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario, 0);
    if (total > 0) e.cobros.push({ id: id(), ventaId: v.id, fecha, monto: total, medio }); // se cobra antes de entregar
    if (tipo === "pago_con_packs") {
      const packs = v.lineas.reduce((a, l) => a + l.cantidad, 0);
      gasto(fecha, "personal", "Community manager (pagado en packs)", packs * e.parametros.precioPack, "packs", { ventaId: v.id });
    }
  }

  // Gastos fijos mensuales.
  for (const [mes, dias] of [["2026-10", ["03", "05", "08", "10", "06"]], ["2026-11", ["03", "05", "08", "10", "04"]]] as const) {
    const fijos: [string, number][] = [["Luz", 62000], ["Gas", 34000], ["Internet", 21000], ["Monotributo", 45000], ["Combustible (viaje a JVG)", 70000]];
    fijos.forEach(([detalle, monto], i) => gasto(`${mes}-${dias[i]}`, "fijo", detalle, monto));
  }
  // Octubre cerrado: indirecto congelado = fijos de octubre ÷ 50 packs.
  e.cierres.push({ mes: "2026-10", indirectoPorPack: (62000 + 34000 + 21000 + 45000 + 70000) / 50, cerradoEl: "2026-11-01" });

  e.seq = seq;
  return e;
}
