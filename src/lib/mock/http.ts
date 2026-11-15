// Tipos y helpers de respuesta del servidor simulado (forma idéntica al backend: {data}, {message, field}).
import type { Estado } from "./seed.ts";

export interface Respuesta { status: number; body?: unknown }
export interface Ctx {
  e: Estado; params: Record<string, string>; query: URLSearchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any; hoy: string;
}
export interface Ruta { metodo: string; patron: string; manejar: (ctx: Ctx) => Respuesta }

/** Error de negocio: el servidor lo convierte en {status, body: {message, field}} y descarta los cambios. */
export class ErrorMock extends Error {
  status: number;
  field?: string;
  constructor(status: number, message: string, field?: string) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

export const ok = (data: unknown): Respuesta => ({ status: 200, body: { data } });
export const creado = (data: unknown): Respuesta => ({ status: 201, body: { data } });
export const lista = (pagina: unknown): Respuesta => ({ status: 200, body: pagina });
export const falla = (message: string, field?: string): never => { throw new ErrorMock(400, message, field); };

export function buscar<T extends { id: number }>(items: T[], id: string | number, que = "Registro"): T {
  const x = items.find((i) => i.id === Number(id));
  if (!x) throw new ErrorMock(404, `${que} no encontrado`);
  return x;
}

export const entero = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
export const positivo = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
export const fecha = (v: unknown, hoy: string): string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : hoy;
