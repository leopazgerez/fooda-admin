import { env } from "@/config/env";
import { collectAll, errorInfo, firesWriteEvent, toSearchParams, type ListQuery } from "./apiQuery";
import { feedback } from "./feedback";
import { clearSession, getSession, needsRefresh, refreshRejected, saveSession, shouldRetryWithRefresh, singleFlight, type Session } from "./session";

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

/** Renews the session with the refresh token (it rotates). If the API refuses, the session is over. */
const refresh = singleFlight(async (): Promise<void> => {
  const s = getSession();
  const { status, parsed } = s ? await raw("POST", "/auth/refresh", undefined, { refreshToken: s.refreshToken }) : { status: 401, parsed: undefined };
  if (status !== 200) {
    if (refreshRejected(status)) toLogin();
    throw new ApiError(status, errorInfo(status, parsed).message);
  }
  saveSession(parsed as Session);
});

/** Returns the parsed body as-is (204 → undefined). Renews the token before it expires, and once more on a 401. */
async function send(method: string, path: string, query?: URLSearchParams, body?: unknown, retried = false): Promise<unknown> {
  const session = getSession();
  if (session && needsRefresh(session) && path !== "/auth/login" && path !== "/auth/refresh") await refresh();
  const { status, parsed } = await raw(method, path, query, body, getSession()?.accessToken);
  if (shouldRetryWithRefresh(status, path, retried) && getSession()) {
    await refresh();
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
