"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import type { SessionResponse } from "./api.gen";
import type { CurrentUser } from "./apiTypes";
import { clearSession, getSession, saveSession } from "./session";
import { useApiResource } from "./useApi";
import { ApiErrorBanner } from "@/components/ui";

const UserContext = createContext<CurrentUser | null>(null);

/** Disparado en window cuando cambia el perfil (Mi cuenta): el usuario del contexto se vuelve a pedir. */
export const PERFIL_CAMBIADO = "admin:perfil-cambiado";

export async function login(email: string, password: string): Promise<void> {
  saveSession(await api.post<SessionResponse>("/auth/login", { email, password }, { silent: true }));
}

/** Revoca el refresh token en la API; la sesión local se borra aunque falle. */
export async function logout(): Promise<void> {
  try {
    // el body se arma después de una posible renovación: el refresh token rota
    if (getSession()) await api.post("/auth/logout", () => ({ refreshToken: getSession()?.refreshToken }), { quiet: true, silent: true });
  } catch {
    // la sesión local se cierra igual
  } finally {
    clearSession();
  }
}

export function useCurrentUser(): CurrentUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useCurrentUser must be used inside <AuthGuard>");
  return user;
}

const noop = () => () => {};

function Me({ children }: { children: React.ReactNode }) {
  const { data, error, reload } = useApiResource(() => api.getOne<CurrentUser>("/me"), []);
  // solo cuando cambia el perfil: recargar en cada escritura cambiaría toda la app por un error ante un corte de red
  useEffect(() => {
    window.addEventListener(PERFIL_CAMBIADO, reload);
    return () => window.removeEventListener(PERFIL_CAMBIADO, reload);
  }, [reload]);
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg p-6">
        <div className="w-full max-w-md"><ApiErrorBanner error={error} onRetry={reload} /></div>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen bg-app-bg" />;
  return <UserContext.Provider value={data}>{children}</UserContext.Provider>;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // false on the server/hydration pass so the session (localStorage) is only read on the client
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const hasSession = mounted && getSession() !== null;
  useEffect(() => {
    if (mounted && !hasSession) router.replace("/login");
  }, [mounted, hasSession, router]);
  return hasSession ? <Me>{children}</Me> : null;
}
