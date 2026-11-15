import { esIngreso } from "./ventas.ts";
import type { Cliente, Venta } from "./types.ts";

const dia = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };
/** "YYYY-MM" de k meses antes. */
export const mesAnterior = (ym: string, k = 1) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const comprasDe = (clienteId: number, ventas: Venta[]) => ventas.filter((v) => v.clienteId === clienteId && esIngreso(v));

/** Regular: al menos una compra en cada uno de los `meses` meses completos anteriores al de `hoy`. Nunca manual. */
export function esRegular(clienteId: number, ventas: Venta[], hoy: string, meses: number): boolean {
  const conCompra = new Set(comprasDe(clienteId, ventas).map((v) => v.fecha.slice(0, 7)));
  for (let k = 1; k <= meses; k++) if (!conCompra.has(mesAnterior(hoy.slice(0, 7), k))) return false;
  return true;
}

/** Clientes cuya última compra fue hace >= dias; los que nunca compraron no aparecen. */
export function recontactos(clientes: Cliente[], ventas: Venta[], hoy: string, dias: number) {
  return clientes.flatMap((cliente) => {
    const ultima = comprasDe(cliente.id, ventas).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    if (!ultima) return [];
    const diasSinComprar = dia(hoy) - dia(ultima.fecha);
    return diasSinComprar >= dias
      ? [{ cliente, ultimaCompra: ultima.fecha, diasSinComprar, packIds: [...new Set(ultima.lineas.map((l) => l.packId))] }]
      : [];
  }).sort((a, b) => b.diasSinComprar - a.diasSinComprar);
}

export const cumpleanosHoy = (clientes: Cliente[], hoy: string): Cliente[] => clientes.filter((c) => c.cumpleanos === hoy.slice(5));
