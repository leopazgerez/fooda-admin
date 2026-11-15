"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, Card, CardHead, ConfirmDeleteModal, Field, FormPanel, ListTable, Tag, btnPrimary, btnSecondary, inputCls, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { Parametros } from "@/lib/apiTypes";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

type Lista = "tiposGasto" | "motivos";
const LISTAS: { k: Lista; titulo: string; caption: string }[] = [
  { k: "tiposGasto", titulo: "TIPOS DE GASTO", caption: "\"fijo\" es el que entra al indirecto por pack" },
  { k: "motivos", titulo: "MOTIVOS DE VENTA", caption: "Por qué compró: sirve para medir recontactos" },
];
interface Item { i: number; valor: string }

/** Listas simples guardadas en /parametros. Renombrar o borrar no toca los registros que ya usan el valor. */
export default function ListasTab() {
  const [edit, setEdit] = useState<{ lista: Lista; i: number | null } | null>(null);
  const { data, error, reload } = useApiResource(() => api.getOne<Parametros>("/parametros"), []);
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
            onRowClick={(x) => { if (!(l.k === "tiposGasto" && x.valor === "fijo")) setEdit({ lista: l.k, i: x.i }); }} empty="Vacía." />
        </Card>
      ))}
      <AnimatePresence>{edit && data && <ItemForm valores={data[edit.lista]} lista={edit.lista} i={edit.i} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

function ItemForm({ valores, lista, i, onClose }: { valores: string[]; lista: Lista; i: number | null; onClose: () => void }) {
  const [valor, setValor] = useState(i === null ? "" : valores[i]);
  const [borrar, setBorrar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const repetido = valores.some((v, j) => j !== i && v.toLowerCase() === valor.trim().toLowerCase());
  const guardar = async (nuevos: string[], success: string) => {
    setError(null);
    setBusy(true);
    try {
      await api.put("/parametros", { [lista]: nuevos }, { silent: true, success });
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
      {i !== null && <ConfirmDeleteModal isOpen={borrar} onClose={() => setBorrar(false)} itemName={valores[i]} isLoading={busy}
        description="Deja de ofrecerse en los formularios. Los registros que ya lo usan no cambian."
        onConfirm={() => guardar(valores.filter((_, j) => j !== i), "Valor eliminado.")} />}
    </FormPanel>
  );
}
