// Búsqueda de texto tolerante a tildes y mayúsculas (pura, testeada con node --test).

export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Clientes cuyo nombre + apellido o teléfono (sin espacios) contiene el texto; vacío → []. */
export function buscarClientes<T extends { firstName: string; lastName: string; phone?: string | null }>(clientes: T[], texto: string, max = 8): T[] {
  const q = normalizar(texto);
  if (!q) return [];
  // teléfono: solo si el texto no tiene letras; dígitos de los dos lados ("387 498-1120" ↔ "3874981120")
  const qTel = /[a-z]/.test(q) ? "" : q.replace(/\D/g, "");
  return clientes
    .filter((c) => normalizar(`${c.firstName} ${c.lastName}`).includes(q) || (!!qTel && !!c.phone && c.phone.replace(/\D/g, "").includes(qTel)))
    .slice(0, max);
}
