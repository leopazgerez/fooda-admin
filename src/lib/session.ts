import type { UserResponse } from "./api.gen";

/** La sesión que devuelve la API (login, refresh). El access token dura poco; el refresh token lo renueva. */
export interface Session { accessToken: string; accessExpiresAt: string; refreshToken: string; user: UserResponse }

const KEY = "admin_session";
const MARGIN_MS = 60_000;

/** Renovar si al access token le queda menos de un minuto (o la fecha no se entiende). */
export function needsRefresh(s: Session, now: Date = new Date()): boolean {
  const t = Date.parse(s.accessExpiresAt);
  return Number.isNaN(t) || t - now.getTime() < MARGIN_MS;
}

/** Corre las funciones de a una, en orden (respaldo de navigator.locks donde no existe). */
export function mutex(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn);
    tail = run.catch(() => {});
    return run;
  };
}

/**
 * El refresh token rota: dos renovaciones con el mismo token cierran la sesión. Bajo el lock (compartido entre
 * pestañas), solo renueva si el access token guardado sigue siendo el que se usó; si cambió, otra llamada ya renovó.
 */
export function renewIfStale(usedToken: string, lock: <T>(fn: () => Promise<T>) => Promise<T>, renew: (s: Session | null) => Promise<void>): Promise<void> {
  return lock(async () => {
    const s = getSession();
    if (s && s.accessToken !== usedToken) return;
    await renew(s);
  });
}

/** Un 401 en una ruta protegida se reintenta una sola vez, después de renovar. */
export function shouldRetryWithRefresh(status: number, path: string, alreadyRetried: boolean): boolean {
  return status === 401 && !path.startsWith("/auth/") && !alreadyRetried;
}

/** En localStorage para que todas las pestañas usen la misma sesión (el refresh token rota). Con el access token vencido la sesión sigue valiendo si hay refresh token: la valida la próxima renovación. */
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s?.accessToken && s.refreshToken ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage blocked: the session lasts only until reload
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

/** La API rechazó el refresh token (vencido, revocado o falta): la sesión terminó. Un 5xx es pasajero y no la cierra. */
export const refreshRejected = (status: number) => status === 400 || status === 401;
