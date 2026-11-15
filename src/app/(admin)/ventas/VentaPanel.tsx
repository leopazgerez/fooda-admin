"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, btnPrimary, btnSecondary, inputCls, selectCls } from "@/components/ui";
import { api } from "@/lib/api";
import type { ClienteOpcion, FilaStock, MedioPago, Parametros, SedeOpcion, TipoVenta, VentaVista } from "@/lib/apiTypes";
import { toLocalISODate } from "@/lib/dateUtils";
import { feedback } from "@/lib/feedback";
import { money } from "@/lib/format";
import ClientePicker from "./ClientePicker";

export const TIPOS: { value: TipoVenta; label: string }[] = [
  { value: "minorista", label: "Minorista" }, { value: "mayorista", label: "Mayorista" }, { value: "consignacion", label: "Consignación" },
  { value: "uso_interno", label: "Uso interno" }, { value: "pago_con_packs", label: "Pago con packs" },
];
export const MEDIOS: { value: MedioPago; label: string }[] = [
  { value: "transferencia", label: "Transferencia" }, { value: "efectivo", label: "Efectivo" },
  { value: "mercado_pago", label: "Mercado Pago" }, { value: "otro", label: "Otro" },
];
const TIPOS_VENTA = TIPOS.slice(0, 3);
export const entero = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
export const clave = (f: Pick<FilaStock, "produccionId" | "packId">) => `${f.produccionId}|${f.packId}`;

export interface LineaElegida { k: string; cantidad: number; precio: number }

/**
 * Líneas de packs a sacar de una sede: solo ofrece lo que hay, del lote más viejo al más nuevo.
 * Precio inicial = el del pack; `todo` arranca cada línea con todo lo disponible (despachos).
 */
export function LineasStock({ filas, sede, lineas, setLineas, conPrecio, todo = false }: {
  filas: FilaStock[]; sede: number; lineas: LineaElegida[]; setLineas: (l: LineaElegida[]) => void; conPrecio: boolean; todo?: boolean;
}) {
  const disponibles = filas.filter((f) => f.sedeId === sede && f.cantidad > 0);
  const fila = (k: string) => disponibles.find((f) => clave(f) === k);
  const set = (i: number, c: Partial<LineaElegida>) => setLineas(lineas.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const nueva = (f: FilaStock, cantidad = todo ? f.cantidad : 1): LineaElegida => ({ k: clave(f), cantidad: Math.min(cantidad, f.cantidad), precio: f.precio });
  const agregar = () => {
    const f = disponibles.find((x) => !lineas.some((l) => l.k === clave(x)));
    if (f) setLineas([...lineas, nueva(f)]);
  };
  const cols = conPrecio ? "grid-cols-[minmax(0,1fr)_64px_96px_28px]" : "grid-cols-[minmax(0,1fr)_64px_28px]";
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold tracking-[0.275px] text-text-label">PACKS</span>
      {lineas.map((l, i) => (
        <div key={i} className={`grid ${cols} gap-2 items-center`}>
          <select value={l.k} aria-label="Lote y pack" className={`${selectCls} text-xs`} onChange={(e) => { const f = fila(e.target.value); if (f) set(i, nueva(f, l.cantidad)); }}>
            {disponibles.map((f) => <option key={clave(f)} value={clave(f)}>{f.pack} · {f.lote} ({f.cantidad})</option>)}
          </select>
          <input type="number" min={1} value={l.cantidad} aria-label="Cantidad" className={`${inputCls} font-mono text-right`}
            onChange={(e) => set(i, { cantidad: Math.min(entero(e.target.value), fila(l.k)?.cantidad ?? 0) })} />
          {conPrecio && <input type="number" min={0} value={l.precio} aria-label="Precio por pack" className={`${inputCls} font-mono text-right`}
            onChange={(e) => set(i, { precio: entero(e.target.value) })} />}
          <button type="button" aria-label="Quitar" onClick={() => setLineas(lineas.filter((_, j) => j !== i))}
            className="text-text-muted hover:text-danger p-1 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={agregar} disabled={lineas.length >= disponibles.length} className={`${btnSecondary} self-start py-1 text-[11px]`}>
        <Plus className="w-3 h-3" /> Agregar pack
      </button>
      {!disponibles.length && <p className="text-xs text-text-muted">No hay stock en esta sede.</p>}
    </div>
  );
}

/** Convierte las líneas elegidas al body de POST /ventas. */
export const lineasBody = (filas: FilaStock[], lineas: LineaElegida[], conPrecio: boolean) => lineas.map((l) => {
  const f = filas.find((x) => clave(x) === l.k);
  return { produccionId: f?.produccionId, packId: f?.packId, cantidad: l.cantidad, ...(conPrecio ? { precioUnitario: l.precio } : {}) };
});

/** Nueva venta: siempre cobrada completa (primero se paga, después se entrega). */
export default function VentaPanel({ sedes, filas, clientes, parametros, onClose }: {
  sedes: SedeOpcion[]; filas: FilaStock[]; clientes: ClienteOpcion[]; parametros: Parametros | null; onClose: () => void;
}) {
  // sedes y clientes pueden llegar después de abrir el panel: se derivan, no se copian al estado
  const [sedeSel, setSede] = useState(0);
  const sede = sedeSel || sedes[0]?.id || 0;
  const [lineas, setLineas] = useState<LineaElegida[]>([]);
  const [nuevos, setNuevos] = useState<ClienteOpcion[]>([]);
  const lista = [...clientes, ...nuevos.filter((n) => !clientes.some((c) => c.id === n.id))];
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoVenta>("minorista");
  const [motivo, setMotivo] = useState("");
  const [medio, setMedio] = useState<MedioPago>("transferencia");
  const [descuento, setDescuento] = useState(0);
  const [envio, setEnvio] = useState(0);
  const [fecha, setFecha] = useState(toLocalISODate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const total = lineas.reduce((a, l) => a + l.cantidad * l.precio, 0) - descuento + envio;

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const v = await api.post<VentaVista>("/ventas", {
        fecha, sedeId: sede, tipo, medio, descuento, envio, lineas: lineasBody(filas, lineas, true),
        ...(clienteId ? { clienteId } : {}), ...(motivo ? { motivo } : {}),
      }, { silent: true });
      feedback.success(`Venta de ${v.packs} packs por ${money(v.total)}.`);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title="Nueva venta" size="lg" onClose={onClose} footer={<>
      <p className="mr-auto max-md:basis-full font-mono text-sm"><span className="text-[11px] font-bold text-text-label">COBRADO: </span>
        <span className="font-bold text-text-primary">{money(total)}</span></p>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="venta-form" disabled={busy || !lineas.length} className={btnPrimary}>{busy ? "Guardando…" : "Registrar venta"}</button>
    </>}>
      <form id="venta-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="SEDE">
            <select value={sede} onChange={(e) => { setSede(Number(e.target.value)); setLineas([]); }} className={selectCls}>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Field>
          <Field label="FECHA"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="CLIENTE">
          <ClientePicker clientes={lista} value={clienteId} onChange={(id, nuevo) => { if (nuevo) setNuevos([...nuevos, nuevo]); setClienteId(id); }} />
        </Field>
        <LineasStock filas={filas} sede={sede} lineas={lineas} setLineas={setLineas} conPrecio />
        <div className="grid grid-cols-2 gap-3">
          <Field label="TIPO">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoVenta)} className={selectCls}>
              {TIPOS_VENTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="MEDIO DE PAGO">
            <select value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)} className={selectCls}>
              {MEDIOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="DESCUENTO ($)"><input type="number" min={0} value={descuento} onChange={(e) => setDescuento(entero(e.target.value))} className={`${inputCls} font-mono`} /></Field>
          <Field label="ENVÍO COBRADO ($)"><input type="number" min={0} value={envio} onChange={(e) => setEnvio(entero(e.target.value))} className={`${inputCls} font-mono`} /></Field>
          <Field label="MOTIVO (OPCIONAL)">
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={selectCls}>
              <option value="">—</option>
              {parametros?.motivos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
      </form>
    </FormPanel>
  );
}
