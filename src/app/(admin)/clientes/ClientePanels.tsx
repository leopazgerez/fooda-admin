"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, ListTable, Tag, btnPrimary, btnSecondary, inputCls, selectCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { ClienteVista, VentaVista } from "@/lib/apiTypes";
import { formatDate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource } from "@/lib/useApi";

export const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
/** "MM-DD" → "15/11" */
export const cumple = (mmdd?: string) => (mmdd ? `${mmdd.slice(3)}/${mmdd.slice(0, 2)}` : "—");

const CAMPOS = ["nombre", "apellido", "telefono", "domicilio", "cumpleanos", "notas"] as const;
type Campo = (typeof CAMPOS)[number];
const badField = "!border-danger ring-2 ring-danger/20";

/** Alta (cliente null) o edición: PATCH solo con lo cambiado; un campo vaciado va como null. */
export function ClienteForm({ cliente, onClose, onSaved }: { cliente: ClienteVista | null; onClose: () => void; onSaved?: (c: ClienteVista) => void }) {
  const [f, setF] = useState<Record<Campo, string>>(Object.fromEntries(CAMPOS.map((k) => [k, cliente?.[k] ?? ""])) as Record<Campo, string>);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: Campo) => (error instanceof ApiError && error.field === k ? badField : "");
  const [mes, dia] = f.cumpleanos ? f.cumpleanos.split("-") : ["", ""];
  const diasMes = mes ? new Date(2000, Number(mes), 0).getDate() : 31; // 2000: bisiesto, acepta 29/02
  const setCumple = (m: string, d: string) => {
    const tope = new Date(2000, Number(m), 0).getDate();
    setF({ ...f, cumpleanos: m && d ? `${m}-${String(Math.min(Number(d), tope)).padStart(2, "0")}` : "" });
  };
  const input = (k: Campo, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={`${inputCls} ${bad(k)}`} {...props} />
  );

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    const body: Record<string, string | null> = {};
    for (const k of CAMPOS) {
      const v = f[k].trim();
      if (!cliente) { if (v) body[k] = v; } else if (v !== (cliente[k] ?? "")) body[k] = v || null;
    }
    if (cliente && !Object.keys(body).length) return onClose();
    setError(null);
    setBusy(true);
    try {
      const nombre = `${f.nombre.trim()} ${f.apellido.trim()}`;
      const c = cliente
        ? await api.patch<ClienteVista>(`/clientes/${cliente.id}`, body, { silent: true, success: `${nombre} actualizado.` })
        : await api.post<ClienteVista>("/clientes", body, { silent: true, success: `${nombre} agregado.` });
      onSaved?.(c);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={cliente ? `Editar ${cliente.nombreCompleto}` : "Nuevo cliente"} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="cliente-form" disabled={busy || !f.nombre.trim() || !f.apellido.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="cliente-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="NOMBRE">{input("nombre", { maxLength: 60 })}</Field>
          <Field label="APELLIDO">{input("apellido", { maxLength: 60 })}</Field>
        </div>
        <Field label="TELÉFONO">{input("telefono", { type: "tel", maxLength: 30 })}</Field>
        <Field label="DOMICILIO">{input("domicilio", { maxLength: 120 })}</Field>
        <Field label="CUMPLEAÑOS">
          <div className="grid grid-cols-2 gap-2">
            <select value={dia} aria-label="Día" onChange={(e) => setCumple(mes || "01", e.target.value)} className={`${selectCls} ${bad("cumpleanos")}`}>
              <option value="">Día</option>
              {Array.from({ length: diasMes }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
            </select>
            <select value={mes} aria-label="Mes" onChange={(e) => setCumple(e.target.value, dia || "01")} className={`${selectCls} ${bad("cumpleanos")}`}>
              <option value="">Mes</option>
              {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
          </div>
          {f.cumpleanos && <button type="button" onClick={() => setCumple("", "")} className="self-start text-[11px] text-text-secondary underline cursor-pointer">Sin cumpleaños</button>}
        </Field>
        <Field label="NOTAS">
          <textarea value={f.notas} maxLength={300} rows={3} onChange={(e) => setF({ ...f, notas: e.target.value })} className={inputCls} />
        </Field>
      </form>
    </FormPanel>
  );
}

const compras: Columna<VentaVista>[] = [
  { key: "fecha", header: "FECHA", className: "font-mono whitespace-nowrap text-text-secondary", render: (v) => formatDate(v.fecha) },
  { key: "sede", header: "SEDE", hideBelow: "sm", render: (v) => v.sede },
  { key: "packs", header: "PACKS", className: "text-text-secondary", render: (v) => v.lineas.map((l) => `${l.cantidad} × ${l.pack} (${l.lote})`).join(", ") },
  { key: "total", header: "TOTAL", align: "right", className: "font-mono whitespace-nowrap", render: (v) => money(v.total) },
];

/** Ficha del cliente con su historial de compras. */
export function ClienteDetalle({ cliente, onClose, onEditar }: { cliente: ClienteVista; onClose: () => void; onEditar: () => void }) {
  const { data, error } = useApiResource(() => api.getAll<VentaVista>("/ventas", {
    sortBy: "fecha", sortDir: "desc", filters: [{ field: "clienteId", operator: "EQUALS", value: cliente.id }],
  }), [cliente.id]);
  const dato = (k: string, v: React.ReactNode) => (
    <div className="min-w-0"><p className="text-[10px] font-bold tracking-[0.5px] text-text-secondary font-mono">{k}</p><p className="text-sm text-text-primary truncate">{v}</p></div>
  );
  return (
    <FormPanel title={cliente.nombreCompleto} size="lg" onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cerrar</button>
      <button type="button" onClick={onEditar} className={btnPrimary}><Pencil className="w-3.5 h-3.5" /> Editar</button>
    </>}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {dato("TELÉFONO", cliente.telefono || "—")}
          {dato("CUMPLEAÑOS", cumple(cliente.cumpleanos))}
          {dato("CLIENTE", cliente.regular ? <Tag tone="success">Regular</Tag> : <Tag>Ocasional</Tag>)}
          {dato("ÚLTIMA COMPRA", cliente.ultimaCompra ? formatDate(cliente.ultimaCompra) : "—")}
          {dato("PACKS", cliente.packs)}
          {dato("TOTAL COMPRADO", money(cliente.total))}
        </div>
        {cliente.domicilio && dato("DOMICILIO", cliente.domicilio)}
        {cliente.notas && <p className="text-xs text-text-secondary">{cliente.notas}</p>}
        <ApiErrorBanner error={error} />
        <ListTable rows={data ?? []} rowKey={(v) => v.id} columns={compras} empty="Todavía no compró." footer={`${data?.length ?? 0} compras`} />
      </div>
    </FormPanel>
  );
}
