import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, API_WRITE_EVENT } from "./api";
import type { ListQuery } from "./apiQuery";

interface Result<T> { key: string; data: T | null; error: ApiError | null }

const toApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, e instanceof Error ? e.message : String(e)));

// Runs load() whenever key changes or reload() is called; responses of superseded runs are dropped.
function useLoad<T>(load: () => Promise<T>, baseKey: string) {
  const [tick, setTick] = useState(0);
  const [res, setRes] = useState<Result<T>>({ key: "", data: null, error: null });
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  const key = `${baseKey}#${tick}`;
  useEffect(() => {
    let stale = false;
    loadRef.current().then(
      (data) => { if (!stale) setRes({ key, data, error: null }); },
      (e) => { if (!stale) setRes({ key, data: null, error: toApiError(e) }); },
    );
    return () => { stale = true; };
  }, [key]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  // loaded: some run has settled, so a null data is a real null and not "not fetched yet"
  return { data: res.data, error: res.error, loading: res.key !== key, loaded: res.key !== "", reload };
}

export function useApiResource<T>(load: () => Promise<T>, deps: unknown[]) {
  return useLoad(load, JSON.stringify(deps));
}

export function useOptions<T>(path: string, q: ListQuery = {}) {
  const { data, loading, error, reload } = useLoad(() => api.getAll<T>(path, q), path + JSON.stringify(q));
  return { options: data ?? [], loading, error, reload };
}

/** Calls reload after every API write anywhere (state derived from the backend may have changed). */
export function useReloadOnWrite(reload: () => void) {
  useEffect(() => {
    window.addEventListener(API_WRITE_EVENT, reload);
    return () => window.removeEventListener(API_WRITE_EVENT, reload);
  }, [reload]);
}

/** Guardar de un panel: busy, error y una ejecución a la vez. Si se pasa `onClose`, cierra al terminar bien. */
export function useGuardar(onClose?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await fn();
      onClose?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/**
 * El registro abierto, tomado de la lista recargada (con la `version` al día) y no la copia del click.
 * "nuevo", null o un objeto sin id (alta) pasan tal cual.
 */
export function vigente<T extends { id: number }, O>(lista: T[], abierto: T | O): T | O {
  if (!abierto || typeof abierto !== "object" || !("id" in abierto)) return abierto;
  return lista.find((x) => x.id === (abierto as T).id) ?? abierto;
}
