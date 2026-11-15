// Servidor simulado en el navegador. api.ts lo usa cuando NEXT_PUBLIC_API_URL=mock.
// Cada escritura corre sobre una copia del estado y solo se confirma si responde 2xx (un 400 no deja cambios a medias).
import { ErrorMock, ok, type Respuesta, type Ruta } from "./http.ts";
import { rutas as catalogo } from "./rutas-catalogo.ts";
import { rutas as operacion } from "./rutas-operacion.ts";
import { rutas as reportes } from "./rutas-reportes.ts";
import { cargar, guardar, restaurar, type Almacen, type Estado } from "./store.ts";

const USUARIO = { id: 1, email: "admin@fooda.com", fullName: "Dueña Fooda" };

function hoyLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const sistema: Ruta[] = [
  { metodo: "POST", patron: "/auth/login", manejar: ({ body }) =>
    body?.email === USUARIO.email && body?.password === "demo"
      ? { status: 200, body: { accessToken: "mock", expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(), user: USUARIO } }
      : { status: 401, body: { message: "Credenciales inválidas" } } },
  { metodo: "GET", patron: "/auth/me", manejar: () => ok(USUARIO) },
];

const RUTAS = [...sistema, ...catalogo, ...operacion, ...reportes];

/** Los <select> mandan ids como texto: cualquier campo "id"/"…Id" numérico en texto pasa a número (en todo el body). */
function normalizarIds(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(normalizarIds);
  if (!x || typeof x !== "object") return x;
  return Object.fromEntries(Object.entries(x).map(([k, v]) =>
    [k, (k === "id" || k.endsWith("Id")) && typeof v === "string" && /^\d+$/.test(v) ? Number(v) : normalizarIds(v)]));
}

function coincidir(patron: string, path: string): Record<string, string> | null {
  const a = patron.split("/").filter(Boolean), b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function crearServidor(opts: { storage?: Almacen; hoy?: () => string } = {}) {
  let e: Estado = cargar(opts.storage);
  const hoy = opts.hoy ?? hoyLocal;

  async function handle(method: string, path: string, query = new URLSearchParams(), body?: unknown): Promise<Respuesta> {
    const limpio = path.replace(/\/+$/, "") || "/";
    if (method === "POST" && limpio === "/mock/reset") {
      e = restaurar(opts.storage);
      return { status: 204 };
    }
    for (const ruta of RUTAS) {
      if (ruta.metodo !== method) continue;
      let params: Record<string, string> | null;
      try {
        params = coincidir(ruta.patron, limpio);
      } catch {
        return { status: 400, body: { message: "Ruta inválida" } };
      }
      if (!params) continue;
      const escritura = method !== "GET";
      const borrador = escritura ? structuredClone(e) : e;
      try {
        const r = ruta.manejar({ e: borrador, params, query, body: normalizarIds(body), hoy: hoy() });
        if (escritura && r.status < 300) {
          e = borrador;
          guardar(e, opts.storage);
        }
        return r;
      } catch (err) {
        if (err instanceof ErrorMock) {
          return { status: err.status, body: { message: err.message, ...(err.field ? { field: err.field } : {}) } };
        }
        return { status: 500, body: { message: err instanceof Error ? err.message : "Error interno del mock" } };
      }
    }
    return { status: 404, body: { message: "No encontrado" } };
  }

  return { handle, estado: () => e };
}
