"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiErrorBanner, BotonBaja, Field, FormPanel, ListTable, btnPrimary, btnSecondary, inputCls, selectCls, type Columna, campoMal } from "@/components/ui";
import { api } from "@/lib/api";
import type { DishResponse as PlatoVista, PackResponse as PackVista, RecipeLineResponse as LineaReceta } from "@/lib/api.gen";
import type { Insumo as InsumoVista } from "@/lib/apiTypes";
import { normalizar } from "@/lib/buscar";
import { money } from "@/lib/format";
import { opcionesDe } from "@/lib/etiquetas";
import { useApiResource, useLista, useReloadOnWrite, vigente } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

export default function PlatosTab() {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<PlatoVista | "nuevo" | null>(null);
  const { data, error, reload } = useApiResource(() => Promise.all([
    api.getAll<PlatoVista>("/dishes", { sort: "name" }), api.getOne<PackVista[]>("/packs"), api.getAll<InsumoVista>("/supplies"),
  ]), []);
  useReloadOnWrite(reload);
  const [platos, packs, insumos] = data ?? [[], [], []];
  const abierto = vigente(platos, edit);
  const rows = platos.filter((p) => !q.trim() || normalizar(p.name).includes(normalizar(q)));
  const columnas: Columna<PlatoVista>[] = [
    { key: "plato", header: "PLATO", className: "font-semibold text-brand-dark", render: (p) => p.name },
    { key: "packs", header: "EN PACKS", hideBelow: "sm", className: "text-text-secondary", render: (p) => p.menus.length
      ? p.menus.map((m) => `${packs.find((x) => x.id === m.packId)?.name ?? "—"} N° ${m.number}`).join(" · ") : "—" },
    { key: "ing", header: "INGREDIENTES", align: "right", hideBelow: "md", className: "font-mono", render: (p) => p.recipe.length },
    { key: "costo", header: "COSTO", align: "right", className: "font-mono whitespace-nowrap", render: (p) => money(Math.round(p.cost)) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <ApiErrorBanner error={error} />
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar plato" aria-label="Buscar plato" className={`${inputCls} flex-1 min-w-48`} />
        <button type="button" onClick={() => setEdit("nuevo")} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Nuevo plato</button>
      </div>
      <ListTable rows={rows} rowKey={(p) => p.id} columns={columnas} onRowClick={setEdit} empty="Sin platos."
        footer={`${rows.length} platos · costo de una porción con los precios vigentes`} />
      <AnimatePresence>{abierto && <PlatoPanel plato={abierto === "nuevo" ? null : abierto} insumos={insumos} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

function PlatoPanel({ plato: abierto, insumos, onClose }: { plato: PlatoVista | null; insumos: InsumoVista[]; onClose: () => void }) {
  // el registro tal como se abrió: base del PATCH y su version (si otra pestaña lo cambió, 409 y no se pisa)
  const [plato] = useState(abierto);
  const unidades = useLista("units"); // columna angosta: el código, con el nombre de la API al pasar el mouse
  const [nombre, setNombre] = useState(plato?.name ?? "");
  const [receta, setReceta] = useState<LineaReceta[]>(plato?.recipe.map((l) => ({ ...l })) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => campoMal(error, k);
  const set = (i: number, c: Partial<LineaReceta>) => setReceta(receta.map((l, j) => (j === i ? { ...l, ...c } : l)));
  const activos = insumos.filter((i) => i.active && !i.packagingType);

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    const cambioReceta = !plato || JSON.stringify(receta) !== JSON.stringify(plato.recipe);
    const body = { ...(!plato || nombre.trim() !== plato.name ? { name: nombre.trim() } : {}), ...(cambioReceta ? { recipe: receta } : {}) };
    if (plato && !Object.keys(body).length) return onClose();
    setError(null);
    setBusy(true);
    try {
      if (plato) await api.patch(`/dishes/${plato.id}`, { ...body, version: plato.version }, { silent: true, success: `${nombre.trim()} actualizado.` });
      else await api.post("/dishes", body, { silent: true, success: `${nombre.trim()} creado.` });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title={plato ? plato.name : "Nuevo plato"} size="lg" onClose={onClose} footer={<>
      {plato && <BotonBaja itemName={plato.name} description="Si está en uso, la API no lo deja eliminar y te dice por qué."
        accion={() => api.del(`/dishes/${plato.id}`, { silent: true, success: `${plato.name} eliminado.` })} onHecho={onClose} onError={setError} />}
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="plato-form" disabled={busy || !nombre.trim() || !receta.length} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="plato-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <Field label="NOMBRE"><input value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} className={`${inputCls} ${bad("name")}`} /></Field>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.275px] text-text-label">RECETA (UNA PORCIÓN)</span>
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_88px_76px_72px_28px] gap-2 text-[10px] font-bold text-text-label font-mono">
            <span>INSUMO</span><span>CANTIDAD</span><span>UNIDAD</span><span>PORCIONES</span><span />
          </div>
          {receta.map((l, i) => (
            <div key={i} className={`grid grid-cols-3 sm:grid-cols-[minmax(0,1fr)_88px_76px_72px_28px] gap-2 items-center ${bad("recipe")}`}>
              <select value={l.supplyId} aria-label="Insumo" onChange={(e) => {
                const ins = insumos.find((x) => x.id === Number(e.target.value));
                set(i, { supplyId: Number(e.target.value), unit: ins?.unit ?? l.unit });
              }} className={`${selectCls} max-sm:col-span-3`}>
                {[...activos, ...insumos.filter((x) => x.id === l.supplyId && !activos.includes(x))].map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <input type="number" min={0} value={l.quantity} aria-label="Cantidad" onChange={(e) => set(i, { quantity: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} font-mono text-right`} />
              <select value={l.unit} aria-label="Unidad" onChange={(e) => set(i, { unit: e.target.value })} className={selectCls}>
                {opcionesDe(unidades, { actual: l.unit }).map((u) => <option key={u.value} value={u.value} title={u.label}>{u.value}</option>)}
              </select>
              <input type="number" min={1} value={l.portions} aria-label="Porciones" onChange={(e) => set(i, { portions: Math.max(1, Number(e.target.value) || 1) })} className={`${inputCls} font-mono text-right`} />
              <button type="button" aria-label="Quitar" onClick={() => setReceta(receta.filter((_, j) => j !== i))}
                className="text-text-muted hover:text-danger p-1 cursor-pointer max-sm:justify-self-end"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button type="button" disabled={!activos.length} onClick={() => setReceta([...receta, { supplyId: activos[0].id, quantity: 100, unit: activos[0].unit, portions: 1 }])}
            className={`${btnSecondary} self-start py-1 text-[11px]`}><Plus className="w-3 h-3" /> Agregar ingrediente</button>
        </div>
        <p className="text-[11px] text-text-secondary">Los cambios no alteran producciones ya planificadas: cada una guardó su copia de la receta.</p>
      </form>
    </FormPanel>
  );
}
