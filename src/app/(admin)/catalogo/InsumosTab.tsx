"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, ListTable, Tag, btnPrimary, inputCls, selectCls, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { InsumoVista, Proveedor } from "@/lib/apiTypes";
import { normalizar } from "@/lib/buscar";
import { money } from "@/lib/format";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";
import InsumoPanel from "./InsumoPanel";
import { AnimatePresence } from "motion/react";

const unidad = (u: string) => (u === "u" ? "u" : u);
const costo = (i: InsumoVista) => (i.unidad === "u" ? money(Math.round(i.costoUnitario)) : `${money(Math.round(i.costoUnitario * 1000))}/${i.unidad === "g" ? "kg" : "l"}`);

const columnas: Columna<InsumoVista>[] = [
  { key: "nombre", header: "INSUMO", className: "font-semibold text-brand-dark", render: (i) => <>
    {i.nombre}
    {(i.compuesto || i.esEnvase) && <span className="ml-1"><Tag>{i.compuesto ? "Compuesto" : "Envase"}</Tag></span>}
  </> },
  { key: "proveedor", header: "PROVEEDOR", hideBelow: "sm", className: "text-text-secondary", render: (i) => i.proveedor },
  { key: "envase", header: "ENVASE", hideBelow: "md", className: "font-mono whitespace-nowrap text-text-secondary", render: (i) => (i.compuesto ? "—" : `${i.contenido} ${unidad(i.unidad)}`) },
  { key: "precio", header: "PRECIO ENVASE", align: "right", hideBelow: "md", className: "font-mono", render: (i) => (i.precioEnvase === null ? "—" : money(i.precioEnvase)) },
  { key: "costo", header: "COSTO", align: "right", className: "font-mono whitespace-nowrap", render: costo },
  { key: "activo", header: "", align: "right", hideBelow: "sm", render: (i) => (i.activo ? null : <Tag>Inactivo</Tag>) },
];

export default function InsumosTab() {
  const [q, setQ] = useState("");
  const [prov, setProv] = useState(0);
  const [edit, setEdit] = useState<InsumoVista | "nuevo" | null>(null);
  const { data, error, reload } = useApiResource(() => Promise.all([
    api.getAll<InsumoVista>("/insumos", { sortBy: "nombre" }), api.getAll<Proveedor>("/proveedores", { sortBy: "orden" }),
  ]), []);
  useReloadOnWrite(reload);
  const [insumos, proveedores] = data ?? [[], []];
  const rows = insumos.filter((i) => (!prov || i.proveedorId === prov) && (!q.trim() || normalizar(i.nombre).includes(normalizar(q))));

  return (
    <div className="flex flex-col gap-3">
      <ApiErrorBanner error={error} />
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo" aria-label="Buscar insumo" className={`${inputCls} flex-1 min-w-48`} />
        <select value={prov} onChange={(e) => setProv(Number(e.target.value))} aria-label="Proveedor" className={`${selectCls} w-auto`}>
          <option value={0}>Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <button type="button" onClick={() => setEdit("nuevo")} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Nuevo insumo</button>
      </div>
      <ListTable rows={rows} rowKey={(i) => i.id} columns={columnas} onRowClick={setEdit} empty="Sin insumos con este filtro."
        footer={`${rows.length} insumos · costo por kg/l (o por unidad) con el último precio`} />
      <AnimatePresence>{edit && <InsumoPanel insumo={edit === "nuevo" ? null : edit} proveedores={proveedores} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}
