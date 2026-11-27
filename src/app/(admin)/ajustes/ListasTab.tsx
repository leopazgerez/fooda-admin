"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, Card, CardHead, ConfirmModal, Field, FormPanel, ListTable, Tag, btnPrimary, btnSecondary, campoMal, inputCls, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { LookupItem, SettingsResponse as Parametros } from "@/lib/api.gen";
import { useApiResource, useGuardar, useReloadOnWrite, type TipoLista } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

type Lista = "expenseTypes" | "saleReasons";
const LISTAS: { k: Lista; titulo: string; caption: string }[] = [
  { k: "expenseTypes", titulo: "TIPOS DE GASTO", caption: "\"fijo\" es el que entra al indirecto por pack" },
  { k: "saleReasons", titulo: "MOTIVOS DE VENTA", caption: "Por qué compró: sirve para medir recontactos" },
];
interface Item { i: number; valor: string }

/** Listas simples guardadas en /settings. Renombrar o borrar no toca los registros que ya usan el valor. */
export default function ListasTab() {
  const [edit, setEdit] = useState<{ lista: Lista; i: number | null } | null>(null);
  const { data, error, reload } = useApiResource(() => api.getOne<Parametros>("/settings"), []);
  useReloadOnWrite(reload);
  const columnas: Columna<Item>[] = [{ key: "valor", header: "VALOR", className: "text-brand-dark", render: (x) => <>
    {x.valor}{x.valor === "fijo" && <span className="ml-2"><Tag>Calcula el indirecto · no se edita</Tag></span>}
  </> }];
  return (
    <div className="flex flex-col gap-4">
      <ApiErrorBanner error={error} />
      {LISTAS.map((l) => (
        <Card key={l.k} className="p-4 flex flex-col gap-3">
          <CardHead title={l.titulo} caption={l.caption}
            right={<button type="button" onClick={() => setEdit({ lista: l.k, i: null })} className={btnSecondary}><Plus className="w-3.5 h-3.5" /> Agregar</button>} />
          <ListTable rows={(data?.[l.k] ?? []).map((valor, i) => ({ i, valor }))} rowKey={(x) => x.i} columns={columnas}
            onRowClick={(x) => { if (!(l.k === "expenseTypes" && x.valor === "fijo")) setEdit({ lista: l.k, i: x.i }); }} empty="Vacía." />
        </Card>
      ))}
      {LOOKUPS.map((l) => <ListaApi key={l.tipo} {...l} />)}
      <AnimatePresence>{edit && data && <ItemForm ajustes={data} lista={edit.lista} i={edit.i} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

function ItemForm({ ajustes, lista, i, onClose }: { ajustes: Parametros; lista: Lista; i: number | null; onClose: () => void }) {
  const valores = ajustes[lista];
  const [valor, setValor] = useState(i === null ? "" : valores[i]);
  const [borrar, setBorrar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const repetido = valores.some((v, j) => j !== i && v.toLowerCase() === valor.trim().toLowerCase());
  const guardar = async (nuevos: string[], success: string) => {
    setError(null);
    setBusy(true);
    try {
      // PUT: la API pide el objeto completo (con version)
      await api.put("/settings", { ...ajustes, [lista]: nuevos }, { silent: true, success });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy || repetido || !valor.trim()) return;
    guardar(i === null ? [...valores, valor.trim()] : valores.map((v, j) => (j === i ? valor.trim() : v)), "Lista actualizada.");
  };
  return (
    <FormPanel title={i === null ? "Agregar valor" : "Editar valor"} onClose={onClose} footer={<>
      {i !== null && <button type="button" onClick={() => setBorrar(true)} className={`${btnSecondary} md:mr-auto text-danger`}>Eliminar</button>}
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="lista-form" disabled={busy || repetido || !valor.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="lista-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <Field label="VALOR" hint={repetido ? "Ya existe en la lista" : "Los registros que ya lo usan conservan el texto que tenían"}>
          <input value={valor} maxLength={40} onChange={(e) => setValor(e.target.value)} className={inputCls} />
        </Field>
      </form>
      {i !== null && <ConfirmModal isOpen={borrar} onClose={() => setBorrar(false)} itemName={valores[i]} isLoading={busy}
        description="Deja de ofrecerse en los formularios. Los registros que ya lo usan no cambian."
        onConfirm={() => guardar(valores.filter((_, j) => j !== i), "Valor eliminado.")} />}
    </FormPanel>
  );
}

// Listas de la API (/lookups): los códigos los usa la lógica, así que no hay alta ni baja; se edita cómo se ven.
const LOOKUPS: { tipo: TipoLista; titulo: string; caption: string }[] = [
  { tipo: "sale-types", titulo: "TIPOS DE VENTA", caption: "Uso interno y pago con packs se cargan desde \"Pagar con packs\"" },
  { tipo: "payment-methods", titulo: "MEDIOS DE PAGO", caption: "\"Packs\" es solo para gastos pagados con packs" },
  { tipo: "units", titulo: "UNIDADES", caption: "En las recetas se ve el código; el nombre, al pasar el mouse" },
];

function ListaApi({ tipo, titulo, caption }: { tipo: TipoLista; titulo: string; caption: string }) {
  const [edit, setEdit] = useState<LookupItem | null>(null);
  const { data, error, reload } = useApiResource(() => api.getOne<LookupItem[]>(`/lookups/${tipo}`), [tipo]);
  useReloadOnWrite(reload);
  const items = data ?? [];
  const abierto = edit && (items.find((x) => x.code === edit.code) ?? edit); // por código: estas listas no tienen id
  const columnas: Columna<LookupItem>[] = [
    { key: "nombre", header: "NOMBRE", className: "text-brand-dark", render: (x) => <>
      {x.name}{!x.active && <span className="ml-2"><Tag>Oculto en formularios</Tag></span>}
    </> },
    { key: "codigo", header: "CÓDIGO", hideBelow: "sm", className: "font-mono text-text-muted", render: (x) => x.code },
    { key: "orden", header: "ORDEN", align: "right", className: "font-mono text-text-secondary", render: (x) => x.sortOrder },
  ];
  return (
    <Card className="p-4 flex flex-col gap-3">
      <CardHead title={titulo} caption={caption} />
      <ApiErrorBanner error={error} />
      <ListTable rows={items} rowKey={(x) => x.code} columns={columnas} onRowClick={setEdit} empty="Vacía." />
      <AnimatePresence>{abierto && <LookupForm tipo={tipo} item={abierto} onClose={() => setEdit(null)} />}</AnimatePresence>
    </Card>
  );
}

function LookupForm({ tipo, item: abierto, onClose }: { tipo: TipoLista; item: LookupItem; onClose: () => void }) {
  const [item] = useState(abierto); // base del PATCH y su version, tal como se abrió
  const [f, setF] = useState({ name: item.name, sortOrder: item.sortOrder, active: item.active });
  const { busy, error, run } = useGuardar(onClose);
  const submit = (e: React.SubmitEvent) => {
    e.preventDefault();
    const todo = { ...f, name: f.name.trim() };
    const cambios = Object.fromEntries(Object.entries(todo).filter(([k, v]) => v !== item[k as keyof typeof todo]));
    if (!Object.keys(cambios).length) return onClose();
    run(() => api.patch(`/lookups/${tipo}/${item.code}`, { ...cambios, version: item.version }, { silent: true, success: `${todo.name} actualizado.` }));
  };
  return (
    <FormPanel title={item.name} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="lookup-form" disabled={busy || !f.name.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="lookup-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <Field label="NOMBRE" hint={<>Código <span className="font-mono">{item.code}</span>: no cambia, lo usa el sistema</>}>
          <input value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} className={`${inputCls} ${campoMal(error, "name")}`} />
        </Field>
        <Field label="ORDEN" hint="Menor va primero en las listas">
          <input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Math.floor(Number(e.target.value) || 0) })}
            className={`${inputCls} font-mono ${campoMal(error, "sortOrder")}`} />
        </Field>
        <label className="flex items-center gap-2 text-xs text-text-body">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          Ofrecer en los formularios (lo ya cargado sigue mostrando su nombre)
        </label>
      </form>
    </FormPanel>
  );
}
