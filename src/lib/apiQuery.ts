/** Listas de la API: `?page=&size=&sort=&dir=` más los filtros propios de cada ruta (ej. `/sales?customerId=`). */
export interface ListQuery {
  sort?: string;
  dir?: "asc" | "desc";
  params?: Record<string, string | number | undefined>;
}

export function toSearchParams(q: ListQuery & { page?: number; size?: number }): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: string | number | undefined) => {
    if (v !== undefined && v !== "") p.set(k, String(v));
  };
  set("page", q.page);
  set("size", q.size);
  set("sort", q.sort);
  set("dir", q.dir);
  for (const [k, v] of Object.entries(q.params ?? {})) set(k, v);
  return p;
}

/** Pide páginas desde 0 hasta juntar `total` (o hasta una página vacía). */
export async function collectAll<T>(fetchPage: (page: number) => Promise<{ items: T[]; total: number }>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    const { items, total } = await fetchPage(page);
    all.push(...items);
    if (items.length === 0 || all.length >= total) return all;
  }
}

/** La API responde los errores como `{message, status, timestamp, field?}`. */
export function errorInfo(status: number, body: unknown): { message: string; field?: string } {
  if (body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string") {
    const b = body as { message: string; field?: unknown };
    return typeof b.field === "string" ? { message: b.message, field: b.field } : { message: b.message };
  }
  return { message: `HTTP ${status}` };
}

/** Escrituras que pueden cambiar datos de las vistas. Login/logout no: recargar las vistas al salir dispara 401 sin sesión. */
export const firesWriteEvent = (method: string, path: string) => method !== "GET" && !path.startsWith("/auth/");
