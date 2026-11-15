"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, ListTable, Tag, btnPrimary, btnSecondary, inputCls, selectCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { PackVersion, PackVista, PlatoVista } from "@/lib/apiTypes";
import { formatDate, toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

const columnas: Columna<PackVista>[] = [
  { key: "pack", header: "PACK", className: "font-semibold text-brand-dark whitespace-nowrap", render: (p) => <>
    {p.nombre}{!p.activo && <span className="ml-1"><Tag>Inactivo</Tag></span>}
  </> },
  { key: "precio", header: "PRECIO", align: "right", className: "font-mono", render: (p) => money(p.precioVenta) },
  { key: "costo", header: "COSTO", align: "right", hideBelow: "sm", className: "font-mono", render: (p) => (p.costo ? money(Math.round(p.costo.total)) : "—") },
  { key: "ganancia", header: "GANANCIA", align: "right", className: "font-mono whitespace-nowrap", render: (p) => <>
    <span className={p.ganancia < 0 ? "text-danger" : "text-success"}>{money(Math.round(p.ganancia))}</span>
    <span className="block text-[10px] text-text-muted">{Math.round(p.margen * 100)} %</span>
  </> },
  { key: "version", header: "COMPOSICIÓN DESDE", hideBelow: "md", className: "font-mono text-text-secondary", render: (p) => (p.versionActual ? formatDate(p.versionActual.desde) : "Sin versión") },
];

export default function PacksTab() {
  const [edit, setEdit] = useState<PackVista | "nuevo" | null>(null);
  const { data, error, reload } = useApiResource(() => Promise.all([api.getOne<PackVista[]>("/packs"), api.getAll<PlatoVista>("/platos", { sortBy: "nombre" })]), []);
  useReloadOnWrite(reload);
  const [packs, platos] = data ?? [[], []];
  // tras crear un pack nuevo, abrirlo para cargar su composición
  const abierto = edit && edit !== "nuevo" ? packs.find((p) => p.id === edit.id) ?? edit : edit;
  return (
    <div className="flex flex-col gap-3">
      <ApiErrorBanner error={error} />
      <div className="flex justify-end">
        <button type="button" onClick={() => setEdit("nuevo")} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Nuevo pack</button>
      </div>
      <ListTable rows={packs} rowKey={(p) => p.id} columns={columnas} onRowClick={setEdit} empty="Sin packs."
        footer="Costo = recetas + aceite + envases + indirecto de referencia, con precios vigentes" />
      <AnimatePresence>{abierto && <PackPanel key={abierto === "nuevo" ? "nuevo" : `${abierto.id}-${abierto.precioVenta}`} pack={abierto === "nuevo" ? null : abierto} platos={platos} onClose={() => setEdit(null)} onCreado={setEdit} />}</AnimatePresence>
    </div>
  );
}

function PackPanel({ pack, platos, onClose, onCreado }: { pack: PackVista | null; platos: PlatoVista[]; onClose: () => void; onCreado: (p: PackVista) => void }) {
  const [f, setF] = useState({ nombre: pack?.nombre ?? "", precio: pack?.precioVenta ?? 0, activo: pack?.activo ?? true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? "!border-danger ring-2 ring-danger/20" : "");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (!pack) {
        const nuevo = await api.post<PackVista>("/packs", { nombre: f.nombre.trim() }, { silent: true, success: `${f.nombre.trim()} creado: cargá su composición.` });
        onCreado({ ...nuevo, precioVenta: f.precio, versionActual: null, costo: null, ganancia: 0, margen: 0 });
        return;
      }
      const body = Object.fromEntries(Object.entries({ nombre: f.nombre.trim(), precio: f.precio, activo: f.activo })
        .filter(([k, v]) => v !== (k === "precio" ? pack.precioVenta : pack[k as "nombre" | "activo"])));
      if (Object.keys(body).length) await api.patch(`/packs/${pack.id}`, body, { silent: true, success: `${f.nombre.trim()} actualizado.` });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={pack ? pack.nombre : "Nuevo pack"} size="lg" onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cerrar</button>
      <button type="submit" form="pack-form" disabled={busy || !f.nombre.trim()} className={btnPrimary}>{busy ? "Guardando…" : pack ? "Guardar" : "Crear pack"}</button>
    </>}>
      <form id="pack-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="NOMBRE"><input value={f.nombre} maxLength={60} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={`${inputCls} ${bad("nombre")}`} /></Field>
          {pack && <Field label="PRECIO DE VENTA ($)">
            <input type="number" min={0} value={f.precio} onChange={(e) => setF({ ...f, precio: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad("precio")}`} />
          </Field>}
        </div>
        {pack && <label className="flex items-center gap-2 text-xs text-text-body cursor-pointer">
          <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} className="accent-accent" /> Activo (se ofrece al planificar)
        </label>}
      </form>
      {pack && <Composicion pack={pack} platos={platos} />}
    </FormPanel>
  );
}

function Composicion({ pack, platos }: { pack: PackVista; platos: PlatoVista[] }) {
  const [tick, setTick] = useState(0);
  const { data: versiones } = useApiResource(() => api.getOne<PackVersion[]>(`/packs/${pack.id}/versiones`), [pack.id, tick]);
  const base = pack.versionActual?.menus ?? [];
  const [nueva, setNueva] = useState<{ desde: string; menus: { numero: number; platoId: number }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nombre = (id: number) => platos.find((p) => p.id === id)?.nombre ?? "—";

  const empezar = () => setNueva({ desde: toLocalISODate(), menus: Array.from({ length: 5 }, (_, i) => ({
    numero: base[i]?.numero ?? i + 1, platoId: base[i]?.platoId ?? platos[0]?.id ?? 0 })) });
  const guardar = async () => {
    if (!nueva) return;
    setError(null);
    try {
      await api.post(`/packs/${pack.id}/versiones`, nueva, { silent: true, success: "Nueva composición guardada. Las ventas anteriores conservan la suya." });
      setNueva(null);
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar la composición");
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-border-subtle flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold tracking-[0.275px] text-text-label">COMPOSICIÓN VIGENTE</p>
        {!nueva && <button type="button" onClick={empezar} className={`${btnSecondary} py-1 text-[11px]`}><Plus className="w-3 h-3" /> Nueva versión</button>}
      </div>
      {base.length ? (
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
          {base.map((m) => <li key={m.numero} className="flex gap-2"><span className="font-mono text-text-muted w-8">N° {m.numero}</span>{m.plato}</li>)}
        </ol>
      ) : <p className="text-xs text-text-muted">Todavía no tiene composición.</p>}

      {nueva && (
        <div className="flex flex-col gap-2 p-3 border border-border-subtle rounded-xs bg-surface-alt">
          <Field label="VIGENTE DESDE"><input type="date" value={nueva.desde} onChange={(e) => setNueva({ ...nueva, desde: e.target.value })} className={inputCls} /></Field>
          {nueva.menus.map((m, i) => (
            <div key={i} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
              <input type="number" min={1} value={m.numero} aria-label="Número de menú" className={`${inputCls} font-mono`}
                onChange={(e) => setNueva({ ...nueva, menus: nueva.menus.map((x, j) => (j === i ? { ...x, numero: Math.max(1, Number(e.target.value) || 1) } : x)) })} />
              <select value={m.platoId} aria-label="Plato" className={selectCls}
                onChange={(e) => setNueva({ ...nueva, menus: nueva.menus.map((x, j) => (j === i ? { ...x, platoId: Number(e.target.value) } : x)) })}>
                {platos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          ))}
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNueva(null)} className={`${btnSecondary} py-1 text-[11px]`}>Cancelar</button>
            <button type="button" onClick={guardar} className={`${btnPrimary} py-1 text-[11px]`}>Guardar versión</button>
          </div>
        </div>
      )}

      {!!versiones?.length && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-bold tracking-[0.275px] text-text-label">HISTORIAL</p>
          <ul className="flex flex-col gap-1 text-xs text-text-secondary">
            {[...versiones].reverse().map((v) => (
              <li key={v.id}><span className="font-mono text-text-primary">{formatDate(v.desde)}</span> · {v.menus.map((m) => `N° ${m.numero} ${nombre(m.platoId)}`).join(", ")}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
