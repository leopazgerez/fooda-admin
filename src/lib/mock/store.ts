// Estado del mock persistido en localStorage. Cualquier fallo de storage cae a la semilla sin romper.
import { semilla, type Estado } from "./seed.ts";

export type { Estado };
export type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const CLAVE = "fooda_mock_v1";

export function cargar(storage?: Almacen): Estado {
  try {
    const raw = storage?.getItem(CLAVE);
    const e = raw ? (JSON.parse(raw) as Estado) : null;
    if (e && typeof e.seq === "number" && Array.isArray(e.insumos)) return e;
  } catch {
    // storage bloqueado o JSON corrupto
  }
  return semilla();
}

export function guardar(e: Estado, storage?: Almacen): void {
  try {
    storage?.setItem(CLAVE, JSON.stringify(e));
  } catch {
    // storage lleno o bloqueado: el estado vive solo en memoria
  }
}

export function restaurar(storage?: Almacen): Estado {
  try {
    storage?.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
  return semilla();
}

/** localStorage del navegador, o undefined si leerlo lanza (cookies/datos de sitio bloqueados) o no existe. */
export function storageNavegador(): Almacen | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

export const nuevoId = (e: Estado): number => e.seq++;
