import { env } from "@/config/env";
import { collectAll, errorInfo, firesWriteEvent, toSearchParams, type ListQuery } from "./apiQuery";
import { feedback } from "./feedback";
import { clearSession, getSession, mutex, needsRefresh, otraPestanaRenovo, refreshRejected, renewIfStale, saveSession, shouldRetryWithRefresh, type Session } from "./session";

export class ApiError extends Error {
  status: number;
  field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
  }
}

interface RawPage<T> { items: T[]; page: number; size: number; total: number }

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
    if (firesWriteEvent(method, path)) window.dispatchEvent(new Event(API_WRITE_EVENT));
  }
}

/** One HTTP round trip: status + parsed body (text if it isn't JSON). */
async function raw(method: string, path: string, query?: URLSearchParams, body?: unknown, token?: string): Promise<{ status: number; parsed: unknown }> {
  const qs = query?.toString();
  const url = `${env.apiUrl}${path}${qs ? `?${qs}` : ""}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, `No se pudo conectar con la API (${env.apiUrl})`);
  }
  if (res.status === 204) return { status: 204, parsed: undefined };
  const text = await res.text();
  try {
    return { status: res.status, parsed: text ? JSON.parse(text) : undefined };
  } catch {
    return { status: res.status, parsed: text };
  }
}

function toLogin(): void {
  clearSession();
  // outside React, and a full reload drops any in-memory state of the expired session
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${env.basePath}/login/`;
}

/** Serializes renewals across tabs (Web Locks); a per-tab queue where the browser lacks it (non-HTTPS). */
const lock: <T>(fn: () => Promise<T>) => Promise<T> =
  typeof navigator !== "undefined" && navigator.locks ? <T>(fn: () => Promise<T>) => navigator.locks.request("fooda-refresh", fn) as Promise<T> : mutex();

/** Renews the session with the refresh token (it rotates), unless someone already replaced `usedToken`. If the API refuses, the session is over. */
const refresh = (usedToken: string) => renewIfStale(usedToken, lock, async (s) => {
  const { status, parsed } = s ? await raw("POST", "/auth/refresh", undefined, { refreshToken: s.refreshToken }) : { status: 401, parsed: undefined };
  if (status !== 200) {
    // sin navigator.locks otra pestaña pudo haber rotado el token justo antes: entonces la sesión sigue con el suyo
    if (s && refreshRejected(status) && await otraPestanaRenovo(s.refreshToken)) return;
    if (refreshRejected(status)) toLogin();
    throw new ApiError(status, errorInfo(status, parsed).message);
  }
  saveSession(parsed as Session);
});

/**
 * Returns the parsed body as-is (204 → undefined). Renews the token before it expires, and once more on a 401.
 * `body` may be a function: it is read after the renewal (logout must send the refresh token that is live then).
 */
async function send(method: string, path: string, query?: URLSearchParams, body?: unknown, retried = false): Promise<unknown> {
  const session = getSession();
  if (session && needsRefresh(session) && path !== "/auth/login" && path !== "/auth/refresh") {
    // the access token may still be valid: only a refused refresh stops the request, not a 5xx or a network error
    await refresh(session.accessToken).catch((e) => { if (e instanceof ApiError && refreshRejected(e.status)) throw e; });
  }
  const token = getSession()?.accessToken;
  const { status, parsed } = await raw(method, path, query, typeof body === "function" ? body() : body, token);
  if (shouldRetryWithRefresh(status, path, retried) && token) {
    await refresh(token);
    return send(method, path, query, body, true);
  }
  return finish(status, parsed, path);
}

/** Response tail: errors become ApiError; a 401 outside /auth/ ends the session. */
function finish(status: number, parsed: unknown, path: string): unknown {
  if (status === 204) return undefined;
  if (status >= 400) {
    if (status === 401 && !path.startsWith("/auth/")) toLogin();
    const { message, field } = errorInfo(status, parsed);
    throw new ApiError(status, message, field);
  }
  return parsed;
}

const PAGE_SIZE = 200; // máximo que acepta la API

export const api = {
  getOne: async <T>(path: string, p?: Record<string, string | number | undefined>, notify?: Notify) =>
    (await request("GET", path, toSearchParams({ params: p }), undefined, notify)) as T,
  /** Lista paginada completa ({items,page,size,total} de a 200). */
  getAll: <T>(path: string, q: ListQuery = {}) =>
    collectAll<T>(async (page) => (await request("GET", path, toSearchParams({ ...q, page, size: PAGE_SIZE }))) as RawPage<T>),
  post: async <T>(path: string, body?: unknown, notify?: Notify) =>
    (await request("POST", path, undefined, body, notify)) as T,
  patch: async <T>(path: string, body: unknown, notify?: Notify) =>
    (await request("PATCH", path, undefined, body, notify)) as T,
  put: async <T>(path: string, body: unknown, notify?: Notify) =>
    (await request("PUT", path, undefined, body, notify)) as T,
  del: async (path: string, notify?: Notify): Promise<void> => {
    await request("DELETE", path, undefined, undefined, notify);
  },
};
