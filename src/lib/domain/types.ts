// Tipos del dominio Fooda.
// Ids numéricos; fechas de calendario "YYYY-MM-DD"; meses "YYYY-MM".

export type Unidad = "g" | "ml" | "u";
export interface Proveedor { id: number; nombre: string; diaCompra?: string; orden: number }
export interface Insumo {
  id: number; nombre: string; unidad: Unidad; proveedorId: number;
  presentacion?: string;
  /** contenido del envase, en `unidad` */
  contenido: number;
  /** permite usar en "u" un insumo medido en g/ml (repollo morado) */
  gramosPorUnidad?: number;
  esEnvase?: "bandeja" | "sticker";
  /** pimiento (promedio rojo/verde), calabaza (máximo zapallo/calabaza) */
  compuesto?: { regla: "promedio" | "maximo"; insumoIds: number[] };
  activo: boolean;
}
export interface PrecioInsumo { id: number; insumoId: number; fecha: string; precioEnvase: number }
export interface LineaReceta { insumoId: number; cantidad: number; unidad: Unidad; porciones: number }
export interface Plato { id: number; nombre: string; receta: LineaReceta[] }
export interface PosicionMenu { numero: number; platoId: number }
export interface Pack { id: number; numero: number; nombre: string; activo: boolean; precio?: number }
export interface PackVersion { id: number; packId: number; desde: string; menus: PosicionMenu[] }
export interface Sede {
  id: number; nombre: string; direccion: string; capacidad: number;
  umbralStock: number; umbralLugaresLibres: number;
  envio: { tipo: "monto" | "porcentaje"; valor: number }; afectaPrecio: boolean; esCocina: boolean;
}
export interface Parametros {
  precioPack: number; aceiteMlPorPack: number; aceiteInsumoId: number;
  bandejasPorPack: number; stickersPorPack: number; indirectoReferencia: number;
  mesesRegular: number; diasRecontacto: number;
  /** 0.15 = alerta si el precio sube más de 15 % */
  alertaSubaPrecio: number;
}
/** Foto tomada al planificar: no cambia aunque cambien precios, recetas o versiones. */
export interface Snapshot {
  /** insumoId → costo por unidad base */
  costos: Record<number, number>;
  platos: Record<number, Plato>;
  packs: { packId: number; versionId: number; menus: PosicionMenu[] }[];
  parametros: Parametros;
  /** copia de los insumos (unidad, conversiones, compuestos) al planificar */
  insumos: Insumo[];
}
export interface LineaProduccion { packId: number; planificada: number; real?: number }
export interface Produccion {
  id: number; codigo: string; numero: number; estado: "planificada" | "cerrada";
  inicio: string; cierre?: string; lineas: LineaProduccion[]; snapshot: Snapshot;
  /** insumoId → costo por unidad pagado (se completa al comprar) */
  costosPagados: Record<number, number>;
  /** insumoId → cantidad sobrante en unidad base */
  sobrantes: Record<number, number>;
}
export interface LineaCompra { insumoId: number; cantidad: number; precioEnvase: number }
export interface Compra {
  id: number; produccionId?: number; proveedorId: number; estado: "pendiente" | "comprada";
  fecha?: string; lineas: LineaCompra[]; gastoId?: number;
  /** fijado al comprar (= monto del gasto) */
  total?: number;
}
export type TipoMovimiento = "produccion" | "traslado_entrada" | "traslado_salida" | "venta" | "ajuste";
export interface MovimientoStock {
  id: number; fecha: string; sedeId: number; produccionId: number; packId: number;
  /** con signo: + entra, − sale */
  cantidad: number; tipo: TipoMovimiento; refId?: number; motivo?: string;
}
export interface Traslado {
  id: number; fecha: string; origenId: number; destinoId: number;
  lineas: { produccionId: number; packId: number; cantidad: number }[]; notas?: string;
}
export interface Cliente {
  id: number; nombre: string; apellido: string; telefono?: string; domicilio?: string;
  /** "MM-DD" */
  cumpleanos?: string; notas?: string;
}
export type TipoVenta = "minorista" | "mayorista" | "consignacion" | "uso_interno" | "pago_con_packs";
export type MedioPago = "transferencia" | "efectivo" | "mercado_pago" | "otro" | "packs";
export interface LineaVenta { produccionId: number; packId: number; cantidad: number; precioUnitario: number }
export interface Venta {
  id: number; fecha: string; sedeId: number; clienteId?: number; tipo: TipoVenta; motivo?: string;
  lineas: LineaVenta[]; descuento: number; envio: number; medio: MedioPago; notas?: string;
}
export interface Cobro { id: number; ventaId: number; fecha: string; monto: number; medio: MedioPago }
export interface Gasto {
  id: number; fecha: string; tipo: string; detalle: string; monto: number;
  medio: MedioPago; pagado: boolean; notas?: string; origen?: { compraId?: number; ventaId?: number };
}
export interface Reserva { id: number; nombre: string; porcentaje: number }
export interface CierreMes { mes: string; indirectoPorPack: number | null; cerradoEl: string }
