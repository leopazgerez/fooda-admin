// Sobrantes de insumos de una producción (PATCH /productions/{id}/leftovers). Puro: testeado con node --test.

export interface InsumoSobrante { supplyId: number; nombre: string; unit: string }

/**
 * Insumos que muestra el panel: los de la lista de súper más los que ya tienen sobrante.
 * Un insumo cuyo sobrante cubre todo sale de la lista de súper, pero sigue en `actuales` y se puede corregir.
 * (El recetario no sirve: sus ingredientes no traen supplyId.)
 */
export function insumosSobrantes(
  lista: { items: { supplyId: number; name: string; unit: string }[] }[],
  actuales: Record<string, number>,
  insumos: { id: number; name: string; unit: string }[],
): InsumoSobrante[] {
  const porId = new Map<number, InsumoSobrante>();
  for (const g of lista) for (const i of g.items) porId.set(i.supplyId, { supplyId: i.supplyId, nombre: i.name, unit: i.unit });
  for (const k of Object.keys(actuales)) {
    const id = Number(k);
    if (porId.has(id)) continue;
    const s = insumos.find((x) => x.id === id);
    porId.set(id, { supplyId: id, nombre: s?.name ?? `Insumo ${id}`, unit: s?.unit ?? "" });
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Mapa completo para el PATCH (la API reemplaza todo): los actuales con los cambios; vacío, 0 o inválido → se quita. */
export function mapaSobrantes(actuales: Record<string, number>, editados: Record<number, string>): Record<string, number> {
  const out: Record<string, number> = { ...actuales };
  for (const [k, v] of Object.entries(editados)) {
    const n = Number(v.replace(",", "."));
    if (v.trim() && Number.isFinite(n) && n > 0) out[k] = n;
    else delete out[k];
  }
  return out;
}
