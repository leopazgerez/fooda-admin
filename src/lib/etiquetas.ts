// Textos en español de los códigos que devuelve la API (en inglés). Puro: testeado con node --test.

export const UNIDAD: Record<string, string> = { g: "Gramos (g)", ml: "Mililitros (ml)", u: "Unidades (u)" };
export const ENVIO: Record<string, string> = { amount: "Monto fijo", percentage: "% del precio" };
export const ENVASE: Record<string, string> = { tray: "Bandeja", sticker: "Sticker" };
export const REGLA_COMPUESTO: Record<string, string> = { average: "promedio", max: "más caro" };
export const ESTADO_PRODUCCION: Record<string, string> = { planned: "Planificada", closed: "Cerrada" };
export const ESTADO_COMPRA: Record<string, string> = { pending: "Pendiente", bought: "Comprada" };
export const TIPO_VENTA: Record<string, string> = {
  retail: "Minorista", wholesale: "Mayorista", consignment: "Consignación", internal_use: "Uso interno", paid_with_packs: "Pago con packs",
};
export const MEDIO_PAGO: Record<string, string> = {
  transfer: "Transferencia", cash: "Efectivo", mercado_pago: "Mercado Pago", other: "Otro", packs: "Packs",
};
export const ALERTA_SEDE: Record<string, string> = { low_stock: "Stock bajo", free_slots: "Hay lugar para un viaje" };

/** El texto del mapa; el código tal cual si el mapa no lo tiene; "—" si no hay valor. */
export function etiqueta(mapa: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "—";
  return mapa[valor] ?? valor;
}

/** Opciones de un <select> en el orden del mapa. */
export const opciones = (mapa: Record<string, string>) => Object.entries(mapa).map(([value, label]) => ({ value, label }));
