"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ApiErrorBanner, BotonBaja, Field, FormPanel, ListTable, Tag, btnPrimary, btnSecondary, inputCls, selectCls, type Columna, campoErr } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { CustomerResponse as ClienteVista, SaleResponse as VentaVista } from "@/lib/api.gen";
import { formatDate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource } from "@/lib/useApi";

export const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
/** "MM-DD" → "15/11" */
export const cumple = (mmdd?: string | null) => (mmdd ? `${mmdd.slice(3)}/${mmdd.slice(0, 2)}` : "—");

const CAMPOS = ["firstName", "lastName", "phone", "address", "birthday", "notes"] as const;
type Campo = (typeof CAMPOS)[number];

/** Alta (cliente null) o edición: PATCH solo con lo cambiado; un campo vaciado va como null. */
export function ClienteForm({ cliente: abierto, onClose, onSaved }: { cliente: ClienteVista | null; onClose: () => void; onSaved?: (c: ClienteVista) => void }) {
  // el registro tal como se abrió: base del PATCH y su version (si otra pestaña lo cambió, 409 y no se pisa)
  const [cliente] = useState(abierto);
  const [f, setF] = useState<Record<Campo, string>>(Object.fromEntries(CAMPOS.map((k) => [k, cliente?.[k] ?? ""])) as Record<Campo, string>);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: Campo) => (error instanceof ApiError && error.field === k ? campoErr : "");
  const [mes, dia] = f.birthday ? f.birthday.split("-") : ["", ""];
  const diasMes = mes ? new Date(2000, Number(mes), 0).getDate() : 31; // 2000: bisiesto, acepta 29/02
  const setCumple = (m: string, d: string) => {
    const tope = new Date(2000, Number(m), 0).getDate();
    setF({ ...f, birthday: m && d ? `${m}-${String(Math.min(Number(d), tope)).padStart(2, "0")}` : "" });
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
      const nombre = `${f.firstName.trim()} ${f.lastName.trim()}`;
      const c = cliente
        ? await api.patch<ClienteVista>(`/customers/${cliente.id}`, { ...body, version: cliente.version }, { silent: true, success: `${nombre} actualizado.` })
        : await api.post<ClienteVista>("/customers", body, { silent: true, success: `${nombre} agregado.` });
      onSaved?.(c);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={cliente ? `Editar ${cliente.fullName}` : "Nuevo cliente"} onClose={onClose} footer={<>
      {cliente && <BotonBaja itemName={cliente.fullName} description="Si está en uso, la API no lo deja eliminar y te dice por qué."
        accion={() => api.del(`/customers/${cliente.id}`, { silent: true, success: `${cliente.fullName} eliminado.` })} onHecho={onClose} onError={setError} />}
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="cliente-form" disabled={busy || !f.firstName.trim() || !f.lastName.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="cliente-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="NOMBRE">{input("firstName", { maxLength: 60 })}</Field>
          <Field label="APELLIDO">{input("lastName", { maxLength: 60 })}</Field>
        </div>
        <Field label="TELÉFONO">{input("phone", { type: "tel", maxLength: 30 })}</Field>
        <Field label="DOMICILIO">{input("address", { maxLength: 120 })}</Field>
        <Field label="CUMPLEAÑOS">
          <div className="grid grid-cols-2 gap-2">
            <select value={dia} aria-label="Día" onChange={(e) => setCumple(mes || "01", e.target.value)} className={`${selectCls} ${bad("birthday")}`}>
              <option value="">Día</option>
              {Array.from({ length: diasMes }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
            </select>
            <select value={mes} aria-label="Mes" onChange={(e) => setCumple(e.target.value, dia || "01")} className={`${selectCls} ${bad("birthday")}`}>
              <option value="">Mes</option>
              {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
          </div>
          {f.birthday && <button type="button" onClick={() => setCumple("", "")} className="self-start text-[11px] text-text-secondary underline cursor-pointer">Sin cumpleaños</button>}
        </Field>
        <Field label="NOTAS">
          <textarea value={f.notes} maxLength={300} rows={3} onChange={(e) => setF({ ...f, notes: e.target.value })} className={inputCls} />
        </Field>
      </form>
    </FormPanel>
  );
}

const compras: Columna<VentaVista>[] = [
  { key: "fecha", header: "FECHA", className: "font-mono whitespace-nowrap text-text-secondary", render: (v) => formatDate(v.date) },
  { key: "sede", header: "SEDE", hideBelow: "sm", render: (v) => v.branch },
  { key: "packs", header: "PACKS", className: "text-text-secondary", render: (v) => v.lines.map((l) => `${l.quantity} × ${l.pack} (${l.lot})`).join(", ") },
  { key: "total", header: "TOTAL", align: "right", className: "font-mono whitespace-nowrap", render: (v) => money(v.total) },
];

/** Ficha del cliente con su historial de compras. */
export function ClienteDetalle({ cliente, onClose, onEditar }: { cliente: ClienteVista; onClose: () => void; onEditar: () => void }) {
  const { data, error } = useApiResource(() => api.getAll<VentaVista>("/sales", { params: { customerId: cliente.id } }), [cliente.id]);
  const dato = (k: string, v: React.ReactNode) => (
    <div className="min-w-0"><p className="text-[10px] font-bold tracking-[0.5px] text-text-secondary font-mono">{k}</p><p className="text-sm text-text-primary truncate">{v}</p></div>
  );
  return (
    <FormPanel title={cliente.fullName} size="lg" onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cerrar</button>
      <button type="button" onClick={onEditar} className={btnPrimary}><Pencil className="w-3.5 h-3.5" /> Editar</button>
    </>}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {dato("TELÉFONO", cliente.phone || "—")}
          {dato("CUMPLEAÑOS", cumple(cliente.birthday))}
          {dato("CLIENTE", cliente.regular ? <Tag tone="success">Regular</Tag> : <Tag>Ocasional</Tag>)}
          {dato("ÚLTIMA COMPRA", cliente.lastPurchase ? formatDate(cliente.lastPurchase) : "—")}
          {dato("PACKS", cliente.packs)}
          {dato("TOTAL COMPRADO", money(cliente.total))}
        </div>
        {cliente.address && dato("DOMICILIO", cliente.address)}
        {cliente.notes && <p className="text-xs text-text-secondary">{cliente.notes}</p>}
        <ApiErrorBanner error={error} />
        <ListTable rows={data ?? []} rowKey={(v) => v.id} columns={compras} empty="Todavía no compró." footer={`${data?.length ?? 0} compras`} />
      </div>
    </FormPanel>
  );
}
