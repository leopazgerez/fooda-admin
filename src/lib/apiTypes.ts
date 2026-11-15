// Request/response shapes of the backend. One section per module.

// ── Auth ──
export interface CurrentUser { id: number; email: string; fullName: string }
export interface LoginResponse { accessToken: string; expiresAt: string; user: CurrentUser }

// ── Compras ──
/** Lista por proveedor: "pendiente" = por comprar (sale de la producción); "comprada" = ya registrada (creó el gasto). */
export interface CompraVista {
  id: number; produccionId?: number; proveedorId: number; proveedor: string; produccion: string | null;
  estado: "pendiente" | "comprada"; fecha?: string; total: number;
  lineas: { insumoId: number; insumo: string; unidad: string; contenido: number; cantidad: number; precioEnvase: number }[];
}
export interface AlertaPrecio { insumoId: number; insumo: string; anterior: number; nuevo: number; suba: number }
export interface Envases { bandeja: EstadoEnvase; sticker: EstadoEnvase }
export interface EstadoEnvase { comprado: number; consumido: number; stock: number; necesidad: number; alcanza: boolean }
export interface InsumoOpcion { id: number; nombre: string; unidad: string; contenido: number; proveedorId: number; precioEnvase: number | null; activo: boolean }
export interface ProveedorOpcion { id: number; nombre: string }

// ── Producción ──
export interface IndirectoAplicado { valor: number; provisorio: boolean; esReferencia: boolean }
/** Costos calculados por el backend: estimado = precios congelados al planificar; real = con lo pagado en compras. */
export interface ProduccionResumen {
  id: number; codigo: string; numero: number; estado: "planificada" | "cerrada"; inicio: string; cierre: string | null;
  packs: number; costoEstimado: number; costoReal: number; vendidos: number; pctVendido: number;
  indirecto: IndirectoAplicado;
  detallePacks: { packId: number; nombre: string; planificada: number; real: number | null; versionId: number | null;
    costoDirecto: { estimado: number; real: number }; costoPorPack: number }[];
  recupero: { necesarios: number; faltan: number };
}
export interface PackVista {
  id: number; numero: number; nombre: string; activo: boolean; precio?: number; precioVenta: number;
  versionActual: (Omit<PackVersion, "menus"> & { menus: { numero: number; platoId: number; plato: string; costo: number }[] }) | null;
  costo: { recetas: number; aceite: number; packaging: number; directo: number; indirecto: number; total: number } | null;
  ganancia: number; margen: number;
}
export interface PackVersion { id: number; packId: number; desde: string; menus: { numero: number; platoId: number }[] }
export interface SedeOpcion { id: number; nombre: string; esCocina: boolean }

// ── Stock y traslados ──
export interface FilaStock { sedeId: number; produccionId: number; packId: number; cantidad: number; sede: string; pack: string; lote: string; precio: number; fechaLote: string | null }
export interface StockSede { sedeId: number; sede: string; total: number; capacidad: number; lugaresLibres: number; alertas: ("stock_bajo" | "lugar_libre")[] }
export interface StockVista { filas: FilaStock[]; porSede: StockSede[] }
/** Mueve el stock al registrarse: no hay "en tránsito" ni confirmación de recepción. */
export interface TrasladoVista {
  id: number; fecha: string; origenId: number; destinoId: number; origen: string; destino: string; notas?: string; packs: number;
  lineas: { produccionId: number; packId: number; cantidad: number; pack: string; lote: string }[];
}

// ── Sedes ──
export interface Sede {
  id: number; nombre: string; direccion: string; capacidad: number; umbralStock: number; umbralLugaresLibres: number;
  envio: { tipo: "monto" | "porcentaje"; valor: number }; afectaPrecio: boolean; esCocina: boolean;
}

// ── Ventas ──
export type TipoVenta = "minorista" | "mayorista" | "consignacion" | "uso_interno" | "pago_con_packs";
export type MedioPago = "transferencia" | "efectivo" | "mercado_pago" | "otro" | "packs";
export interface VentaVista {
  id: number; fecha: string; sedeId: number; sede: string; clienteId?: number; cliente: string | null; tipo: TipoVenta; motivo?: string;
  medio: MedioPago; notas?: string; descuento: number; envio: number; packs: number; total: number; ganancia: number;
  lineas: { produccionId: number; packId: number; cantidad: number; precioUnitario: number; pack: string; lote: string }[];
}
export interface ClienteOpcion { id: number; nombre: string; apellido: string; telefono?: string; nombreCompleto: string }
export interface Parametros {
  precioPack: number; aceiteMlPorPack: number; aceiteInsumoId: number; bandejasPorPack: number; stickersPorPack: number;
  indirectoReferencia: number; mesesRegular: number; diasRecontacto: number; alertaSubaPrecio: number;
  motivos: string[]; tiposGasto: string[];
}
export interface Reserva { id: number; nombre: string; porcentaje: number }

// ── Clientes ──
/** Sin saldo: toda venta se cobra antes de entregarse. `regular` es automático. */
export interface ClienteVista {
  id: number; nombre: string; apellido: string; telefono?: string; domicilio?: string; cumpleanos?: string; notas?: string;
  nombreCompleto: string; regular: boolean; ultimaCompra: string | null; packs: number; total: number;
}
export interface Recontactos { recontactos: { cliente: ClienteVista; diasSinComprar: number; packs: string[] }[]; cumpleanos: ClienteVista[] }

// ── Finanzas ──
export interface MesFinanzas {
  mes: string; producidos: number; vendidos: number; pctVendido: number; ventas: number; cobros: number; gastosPagados: number;
  resultadoCaja: number; resultadoCajaEnPacks: number; ganancia: number; gananciaEnPacks: number; cerrado: boolean;
  indirecto: IndirectoAplicado; reservas: { nombre: string; porcentaje: number; monto: number }[];
}
/** `origen`: generado por una compra o un pago con packs (solo lectura). medio "packs" no resta caja. */
export interface Gasto {
  id: number; fecha: string; tipo: string; detalle: string; monto: number; medio: MedioPago; pagado: boolean; notas?: string;
  origen?: { compraId?: number; ventaId?: number };
}

// ── Catálogo ──
export type UnidadInsumo = "g" | "ml" | "u";
export interface InsumoVista {
  id: number; nombre: string; unidad: UnidadInsumo; contenido: number; proveedorId: number; proveedor: string; activo: boolean;
  presentacion?: string; gramosPorUnidad?: number; esEnvase?: "bandeja" | "sticker";
  compuesto?: { regla: "promedio" | "maximo"; insumoIds: number[] };
  costoUnitario: number; precioEnvase: number | null;
}
export interface PrecioInsumo { id: number; insumoId: number; fecha: string; precioEnvase: number }
export interface Proveedor { id: number; nombre: string; diaCompra?: string; orden: number }
export interface LineaReceta { insumoId: number; cantidad: number; unidad: UnidadInsumo; porciones: number }
export interface PlatoVista { id: number; nombre: string; receta: LineaReceta[]; costo: number; menus: { numero: number; packId: number }[] }

// ── Dashboard ──
export interface DashboardVista {
  hoy: string; mes: MesFinanzas; ventasMesAnteriorMismoPeriodo: number; stockPorSede: StockSede[];
  ventasPorPack: { packId: number; pack: string; cantidad: number; monto: number; porSede: { sedeId: number; sede: string; cantidad: number }[] }[];
  producciones: ProduccionResumen[];
  recupero: { codigo: string; necesarios: number; faltan: number } | null;
  avisos: {
    recontactos: { clienteId: number; cliente: string; diasSinComprar: number; packs: string[] }[];
    cumpleanos: { clienteId: number; cliente: string; telefono: string | null }[];
    envasesBajos: ({ tipo: "bandeja" | "sticker" } & EstadoEnvase)[];
    comprasPendientes: { compraId: number; proveedor: string; produccion: string | null }[];
  };
}

// ── Recetario y análisis ──
/** Recetario de una producción: cada menú con sus ingredientes multiplicados por los packs planificados. */
export interface RecetarioPack {
  packId: number; nombre: string; cantidad: number;
  menus: { numero: number; plato: string; ingredientes: { nombre: string; cantidad: number; unidad: UnidadInsumo }[];
    compartidoCon?: { packId: number; cantidad: number; nombre: string }; totalCombinado?: number }[];
}
export interface AnalisisPacks {
  desde: string; hasta: string; agrupar: "mes" | "semana";
  filas: { periodo: string; packId: number; pack: string; sedeId: number; sede: string; cantidad: number; monto: number }[];
  cambios: { packId: number; pack: string; desde: string; versionId: number }[];
}
export interface VersionEn {
  version: PackVersion; hasta: string | null; menus: { numero: number; plato: string }[]; anterior: PackVersion | null;
  cambios: { numero: number; antes: string; despues: string; numeroNuevo: number }[];
}
