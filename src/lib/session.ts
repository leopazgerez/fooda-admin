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

/** Mientras una llamada está en curso, las demás reciben la misma promesa (el refresh token rota: dos renovaciones a la vez cierran la sesión). */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => (pending ??= fn().finally(() => { pending = null; }));
}

/** Un 401 en una ruta protegida se reintenta una sola vez, después de renovar. */
export function shouldRetryWithRefresh(status: number, path: string, alreadyRetried: boolean): boolean {
  return status === 401 && !path.startsWith("/auth/") && !alreadyRetried;
}

/** Con el access token vencido la sesión sigue valiendo si hay refresh token: la valida la próxima renovación. */
export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s?.accessToken && s.refreshToken ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage blocked: the session lasts only until reload
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

/** La API rechazó el refresh token (vencido, revocado o falta): la sesión terminó. Un 5xx es pasajero y no la cierra. */
export const refreshRejected = (status: number) => status === 400 || status === 401;
