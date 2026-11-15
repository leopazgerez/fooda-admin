import { env } from "@/config/env";
import { collectAll, errorInfo, toSearchParams, type ListQuery } from "./apiQuery";
import { feedback } from "./feedback";
import { clearSession, getSession } from "./session";

export class ApiError extends Error {
  status: number;
  field?: string;
  details?: unknown;

  constructor(status: number, message: string, field?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
    this.details = details;
  }
}

export interface Page<T> { items: T[]; nextCursor: string | null; prevCursor: string | null; total: number }

interface RawPage<T> { data: T[]; nextCursor: string | null; prevCursor: string | null; total: number }

/**
 * Writes: success → a toast saying what was done; silent → no error toast (the caller handles it).
 * quiet → no global loader (background checks the user didn't ask for).
 */
export interface Notify { success?: string; silent?: boolean; quiet?: boolean }

/** Fired on window after every write settles (ok or not): state derived from the backend may have changed. */
export const API_WRITE_EVENT = "admin:api-write";

/** Counts the call for the global loader; a failed write shows an error toast unless silent. */
async function request(method: string, path: string, query?: URLSearchParams, body?: unknown, notify: Notify = {}): Promise<unknown> {
  if (!notify.quiet) feedback.begin();
  try {
    const parsed = await send(method, path, query, body);
    if (notify.success) feedback.success(notify.success);
    return parsed;
  } catch (e) {
    // a 401 is already on its way to /login
    if (method !== "GET" && !notify.silent && e instanceof ApiError && e.status !== 401) feedback.error(e.message);
    throw e;
  } finally {
    if (!notify.quiet) feedback.end();
    if (method !== "GET") window.dispatchEvent(new Event(API_WRITE_EVENT));
  }
}

type Servidor = ReturnType<typeof import("./mock/server.ts").crearServidor>;
let mock: Promise<Servidor> | null = null;

/** Prototipo: el servidor simulado vive en el navegador y guarda en localStorage. Se carga solo si env.isMock. */
async function sendMock(method: string, path: string, query?: URLSearchParams, body?: unknown): Promise<unknown> {
  mock ??= Promise.all([import("./mock/server.ts"), import("./mock/store.ts")])
    .then(([{ crearServidor }, { storageNavegador }]) => crearServidor({ storage: storageNavegador() }))
    .catch((err) => { mock = null; throw err; });
  const [servidor] = await Promise.all([mock, new Promise((r) => setTimeout(r, 150))]);
  // ida y vuelta por JSON, como con el backend real (nadie comparte referencias con el estado del mock)
  const res = await servidor.handle(method, path, query, body === undefined ? undefined : JSON.parse(JSON.stringify(body)));
  return finish(res.status, res.body === undefined ? undefined : JSON.parse(JSON.stringify(res.body)), path);
}

/** Every backend body is {start, length, total, data, ...}; returns the parsed body as-is (204 → undefined). */
async function send(method: string, path: string, query?: URLSearchParams, body?: unknown): Promise<unknown> {
  if (env.isMock) return sendMock(method, path, query, body);
  const qs = query?.toString();
  const url = `${env.apiUrl}${path}${qs ? `?${qs}` : ""}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getSession()?.accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, `No se pudo conectar con la API (${env.apiUrl})`);
  }

  if (res.status === 204) return undefined;
  const text = await res.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return finish(res.status, parsed, path);
}

/** Shared tail of real and mock responses: errors become ApiError; a 401 clears the session and goes to /login/. */
function finish(status: number, parsed: unknown, path: string): unknown {
  if (status === 204) return undefined;
  if (status >= 400) {
    if (status === 401 && path !== "/auth/login") {
      clearSession();
      // outside React, and a full reload drops any in-memory state of the expired session
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `${env.basePath}/login/`;
    }
    const { message, field, details } = errorInfo(status, parsed);
    throw new ApiError(status, message, field, details);
  }
  return parsed;
}

function unwrap<T>(body: unknown): T {
  return (body && typeof body === "object" && "data" in body ? (body as { data: unknown }).data : body) as T;
}

function params(p?: Record<string, string | number | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(p ?? {})) if (v !== undefined && v !== "") out.set(k, String(v));
  return out;
}

async function getPage<T>(path: string, q: ListQuery = {}, notify?: Notify): Promise<Page<T>> {
  const r = (await request("GET", path, toSearchParams(q), undefined, notify)) as RawPage<T>;
  return { items: r.data, nextCursor: r.nextCursor, prevCursor: r.prevCursor, total: r.total };
}

export const api = {
  getOne: async <T>(path: string, p?: Record<string, string | number | undefined>, notify?: Notify) =>
    unwrap<T>(await request("GET", path, params(p), undefined, notify)),
  getPage,
  getAll: <T>(path: string, q: Omit<ListQuery, "cursor" | "before" | "length"> = {}) =>
    collectAll<T>((cursor) => getPage<T>(path, { ...q, length: 200, cursor })),
  post: async <T>(path: string, body?: unknown, notify?: Notify) =>
    unwrap<T>(await request("POST", path, undefined, body, notify)),
  patch: async <T>(path: string, body: unknown, notify?: Notify) =>
    unwrap<T>(await request("PATCH", path, undefined, body, notify)),
  put: async <T>(path: string, body: unknown, notify?: Notify) =>
    unwrap<T>(await request("PUT", path, undefined, body, notify)),
  del: async (path: string, notify?: Notify): Promise<void> => {
    await request("DELETE", path, undefined, undefined, notify);
  },
};
