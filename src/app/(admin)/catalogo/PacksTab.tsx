"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, BotonBaja, Field, FormPanel, ListTable, Tag, btnPrimary, btnSecondary, inputCls, selectCls, type Columna, campoMal } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { DishResponse as PlatoVista, PackResponse as PackVista, VersionResponse as PackVersion } from "@/lib/api.gen";
import { formatDate, toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource, useReloadOnWrite, vigente } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

const columnas: Columna<PackVista>[] = [
  { key: "pack", header: "PACK", className: "font-semibold text-brand-dark whitespace-nowrap", render: (p) => <>
    {p.name}{!p.active && <span className="ml-1"><Tag>Inactivo</Tag></span>}
  </> },
  { key: "precio", header: "PRECIO", align: "right", className: "font-mono", render: (p) => money(p.salePrice) },
  { key: "costo", header: "COSTO", align: "right", hideBelow: "sm", className: "font-mono", render: (p) => (p.cost ? money(Math.round(p.cost.total)) : "—") },
  { key: "ganancia", header: "GANANCIA", align: "right", className: "font-mono whitespace-nowrap", render: (p) => <>
    <span className={p.profit < 0 ? "text-danger" : "text-success"}>{money(Math.round(p.profit))}</span>
    <span className="block text-[10px] text-text-muted">{Math.round(p.margin * 100)} %</span>
  </> },
  { key: "version", header: "COMPOSICIÓN DESDE", hideBelow: "md", className: "font-mono text-text-secondary", render: (p) => (p.currentVersion ? formatDate(p.currentVersion.validFrom) : "Sin versión") },
];

export default function PacksTab() {
  const [edit, setEdit] = useState<PackVista | "nuevo" | null>(null);
  const { data, error, reload } = useApiResource(() => Promise.all([api.getOne<PackVista[]>("/packs"), api.getAll<PlatoVista>("/dishes", { sort: "name" })]), []);
  useReloadOnWrite(reload);
  const [packs, platos] = data ?? [[], []];
  // registro recargado (version al día); tras crear un pack nuevo, se abre para cargar su composición
  const abierto = vigente(packs, edit);
  return (
    <div className="flex flex-col gap-3">
      <ApiErrorBanner error={error} />
      <div className="flex justify-end">
        <button type="button" onClick={() => setEdit("nuevo")} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Nuevo pack</button>
      </div>
      <ListTable rows={packs} rowKey={(p) => p.id} columns={columnas} onRowClick={setEdit} empty="Sin packs."
        footer="Costo = recetas + aceite + envases + indirecto de referencia, con precios vigentes" />
      <AnimatePresence>{abierto && <PackPanel key={abierto === "nuevo" ? "nuevo" : `${abierto.id}-${abierto.salePrice}`} pack={abierto === "nuevo" ? null : abierto} platos={platos} onClose={() => setEdit(null)} onCreado={setEdit} />}</AnimatePresence>
    </div>
  );
}

function PackPanel({ pack, platos, onClose, onCreado }: { pack: PackVista | null; platos: PlatoVista[]; onClose: () => void; onCreado: (p: PackVista) => void }) {
  const [f, setF] = useState({ nombre: pack?.name ?? "", precio: pack?.salePrice ?? 0, activo: pack?.active ?? true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => campoMal(error, k);

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (!pack) {
        onCreado(await api.post<PackVista>("/packs", { name: f.nombre.trim() }, { silent: true, success: `${f.nombre.trim()} creado: cargá su composición.` }));
        return;
      }
      // price: el precio propio del pack; salePrice es el que rige (propio o el general de Ajustes)
      const body = Object.fromEntries(Object.entries({ name: f.nombre.trim(), price: f.precio, active: f.activo })
        .filter(([k, v]) => v !== (k === "price" ? pack.salePrice : pack[k as "name" | "active"])));
      if (Object.keys(body).length) await api.patch(`/packs/${pack.id}`, { ...body, version: pack.version }, { silent: true, success: `${f.nombre.trim()} actualizado.` });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={pack ? pack.name : "Nuevo pack"} size="lg" onClose={onClose} footer={<>
      {pack && <BotonBaja itemName={pack.name} description="Si está en uso, la API no lo deja eliminar y te dice por qué."
        accion={() => api.del(`/packs/${pack.id}`, { silent: true, success: `${pack.name} eliminado.` })} onHecho={onClose} onError={setError} />}
      <button type="button" onClick={onClose} className={btnSecondary}>Cerrar</button>
      <button type="submit" form="pack-form" disabled={busy || !f.nombre.trim()} className={btnPrimary}>{busy ? "Guardando…" : pack ? "Guardar" : "Crear pack"}</button>
    </>}>
      <form id="pack-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="NOMBRE"><input value={f.nombre} maxLength={60} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={`${inputCls} ${bad("name")}`} /></Field>
          {pack && <Field label="PRECIO DE VENTA ($)">
            <input type="number" min={0} value={f.precio} onChange={(e) => setF({ ...f, precio: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono ${bad("price")}`} />
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
  const { data: versiones } = useApiResource(() => api.getOne<PackVersion[]>(`/packs/${pack.id}/versions`), [pack.id, tick]);
  const base = pack.currentVersion?.menus ?? [];
  const [nueva, setNueva] = useState<{ validFrom: string; menus: { number: number; dishId: number }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nombre = (id: number) => platos.find((p) => p.id === id)?.name ?? "—";

  const empezar = () => setNueva({ validFrom: toLocalISODate(), menus: Array.from({ length: 5 }, (_, i) => ({
    number: base[i]?.number ?? i + 1, dishId: base[i]?.dishId ?? platos[0]?.id ?? 0 })) });
  const guardar = async () => {
    if (!nueva) return;
    setError(null);
    try {
      await api.post(`/packs/${pack.id}/versions`, nueva, { silent: true, success: "Nueva composición guardada. Las ventas anteriores conservan la suya." });
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
          {base.map((m) => <li key={m.number} className="flex gap-2"><span className="font-mono text-text-muted w-8">N° {m.number}</span>{m.dish}</li>)}
        </ol>
      ) : <p className="text-xs text-text-muted">Todavía no tiene composición.</p>}

      {nueva && (
        <div className="flex flex-col gap-2 p-3 border border-border-subtle rounded-xs bg-surface-alt">
          <Field label="VIGENTE DESDE"><input type="date" value={nueva.validFrom} onChange={(e) => setNueva({ ...nueva, validFrom: e.target.value })} className={inputCls} /></Field>
          {nueva.menus.map((m, i) => (
            <div key={i} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
              <input type="number" min={1} value={m.number} aria-label="Número de menú" className={`${inputCls} font-mono`}
                onChange={(e) => setNueva({ ...nueva, menus: nueva.menus.map((x, j) => (j === i ? { ...x, number: Math.max(1, Number(e.target.value) || 1) } : x)) })} />
              <select value={m.dishId} aria-label="Plato" className={selectCls}
                onChange={(e) => setNueva({ ...nueva, menus: nueva.menus.map((x, j) => (j === i ? { ...x, dishId: Number(e.target.value) } : x)) })}>
                {platos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
              <li key={v.id}><span className="font-mono text-text-primary">{formatDate(v.validFrom)}</span> · {v.menus.map((m) => `N° ${m.number} ${nombre(m.dishId)}`).join(", ")}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
