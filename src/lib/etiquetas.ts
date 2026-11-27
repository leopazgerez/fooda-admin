// Textos en español de los códigos que devuelve la API (en inglés). Puro: testeado con node --test.
// Tipos de venta, medios de pago y unidades no están acá: sus nombres se editan en la API (/lookups, ver useLista).

export const ENVIO: Record<string, string> = { amount: "Monto fijo", percentage: "% del precio" };
export const ENVASE: Record<string, string> = { tray: "Bandeja", sticker: "Sticker" };
export const REGLA_COMPUESTO: Record<string, string> = { average: "promedio", max: "más caro" };
export const ESTADO_PRODUCCION: Record<string, string> = { planned: "Planificada", closed: "Cerrada" };
export const ESTADO_COMPRA: Record<string, string> = { pending: "Pendiente", bought: "Comprada" };
export const ALERTA_SEDE: Record<string, string> = { low_stock: "Stock bajo", free_slots: "Hay lugar para un viaje" };

/** El texto del mapa; el código tal cual si el mapa no lo tiene; "—" si no hay valor. Sin distinguir mayúsculas: /dashboard manda los códigos en mayúsculas (hallazgo). */
export function etiqueta(mapa: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "—";
  return mapa[valor.toLowerCase()] ?? valor;
}

/** Opciones de un <select> en el orden del mapa. */
export const opciones = (mapa: Record<string, string>) => Object.entries(mapa).map(([value, label]) => ({ value, label }));

/** Un valor de una lista de /api/lookups (los códigos no cambian; nombre, orden y activo se editan en Ajustes). */
export interface ItemLista { code: string; name: string; active: boolean }

/** Nombre por código, para usar con etiqueta(). */
export const mapaDe = (items: ItemLista[]): Record<string, string> => Object.fromEntries(items.map((i) => [i.code, i.name]));

/**
 * Opciones de un <select> en el orden de la API: solo las activas y sin los códigos de `sin` (los que tienen su propio
 * flujo, como "packs"). El valor `actual` se conserva aunque esté inactivo, para no cambiarlo sin querer al editar.
 */
export function opcionesDe(items: ItemLista[], { sin = [], actual }: { sin?: string[]; actual?: string } = {}) {
  const out = items.filter((i) => !sin.includes(i.code) && (i.active || i.code === actual)).map((i) => ({ value: i.code, label: i.name }));
  // mientras la lista carga (o si el código no está), el valor actual sigue elegido con su código
  return actual && !out.some((o) => o.value === actual) ? [...out, { value: actual, label: actual }] : out;
}
