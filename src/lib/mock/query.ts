// Motor genérico de listas del mock: mismo contrato que apiQuery.ts (search, sortBy/sortDir, filter base64, cursor).
import type { Criterion } from "../apiQuery.ts";
import { normalizar } from "../buscar.ts";

export interface PaginaMock<T> { data: T[]; nextCursor: string | null; prevCursor: string | null; total: number }

const norm = (s: unknown) => normalizar(String(s ?? ""));

function decodificar(filter: string | null): Criterion[] {
  if (!filter) return [];
  try {
    const bytes = Uint8Array.from(atob(filter), (c) => c.charCodeAt(0));
    return (JSON.parse(new TextDecoder().decode(bytes)) as { filters?: Criterion[] }).filters ?? [];
  } catch {
    return [];
  }
}

function comparar(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a), nb = Number(b);
  if (a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb) && typeof a !== "boolean") return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function cumple(v: unknown, c: Criterion): boolean {
  const vacio = v === undefined || v === null || v === "";
  switch (c.operator) {
    case "EQUALS": return String(v) === String(c.value);
    case "NOT_EQUALS": return String(v) !== String(c.value);
    case "LIKE": return norm(v).includes(norm(c.value));
    case "GREATER_THAN": return !vacio && comparar(v, c.value) > 0;
    case "LESS_THAN": return !vacio && comparar(v, c.value) < 0;
    case "GREATER_OR_EQUAL": return !vacio && comparar(v, c.value) >= 0;
    case "LESS_OR_EQUAL": return !vacio && comparar(v, c.value) <= 0;
    case "BETWEEN": {
      const [a, b] = c.value as [unknown, unknown];
      return !vacio && comparar(v, a) >= 0 && comparar(v, b) <= 0;
    }
    case "IN": return (c.value as unknown[]).map(String).includes(String(v));
    case "IS_NULL": return vacio;
    case "IS_NOT_NULL": return !vacio;
    default: return true;
  }
}

export function listar<T>(
  items: T[], q: URLSearchParams,
  opts: { buscarEn: (keyof T)[]; ordenPorDefecto: keyof T; dirPorDefecto?: "asc" | "desc" },
): PaginaMock<T> {
  const campo = (x: T, f: string) => (x as Record<string, unknown>)[f];
  const search = norm(q.get("search")?.trim());
  const filtros = decodificar(q.get("filter"));
  const sortBy = q.get("sortBy") ?? String(opts.ordenPorDefecto);
  const dir = (q.get("sortDir") ?? opts.dirPorDefecto ?? "asc") === "desc" ? -1 : 1;
  const length = Math.max(1, Number(q.get("length")) || 20);
  // "siguiente" manda cursor; "anterior" manda before: ambos son el offset de la página pedida
  const offset = Math.max(0, Number(q.get("cursor") ?? q.get("before")) || 0);

  const filtrados = items
    .filter((x) => !search || opts.buscarEn.some((f) => norm(campo(x, String(f))).includes(search)))
    .filter((x) => filtros.every((c) => cumple(campo(x, c.field), c)))
    .sort((a, b) => dir * (comparar(campo(a, sortBy), campo(b, sortBy)) || comparar(campo(a, "id"), campo(b, "id"))));
  return {
    data: filtrados.slice(offset, offset + length),
    nextCursor: offset + length < filtrados.length ? String(offset + length) : null,
    prevCursor: offset > 0 ? String(Math.max(0, offset - length)) : null,
    total: filtrados.length,
  };
}
