"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, ListTable, btnPrimary, btnSecondary, inputCls, selectCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { InsumoOpcion, Parametros } from "@/lib/apiTypes";
import { money } from "@/lib/format";
import { useApiResource, useOptions, useReloadOnWrite } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

type Num = Exclude<keyof Parametros, "motivos" | "tiposGasto" | "aceiteInsumoId">;
const CAMPOS: { k: Num; label: string; ver: (v: number) => string; paso?: number }[] = [
  { k: "precioPack", label: "Precio del pack", ver: money },
  { k: "aceiteMlPorPack", label: "Aceite por pack (ml)", ver: (v) => `${v} ml` },
  { k: "bandejasPorPack", label: "Bandejas por pack", ver: String },
  { k: "stickersPorPack", label: "Stickers por pack", ver: String },
  { k: "indirectoReferencia", label: "Indirecto de referencia por pack", ver: money },
  { k: "mesesRegular", label: "Meses seguidos comprando para ser regular", ver: String },
  { k: "diasRecontacto", label: "Días sin comprar para recontactar", ver: (v) => `${v} días` },
  { k: "alertaSubaPrecio", label: "Alerta si un precio sube más de", ver: (v) => `${Math.round(v * 100)} %`, paso: 0.01 },
];
interface Fila { key: string; label: string; valor: string }

export default function ParametrosTab() {
  const [editar, setEditar] = useState(false);
  const { data, error, reload } = useApiResource(() => api.getOne<Parametros>("/parametros"), []);
  useReloadOnWrite(reload);
  const { options: insumos } = useOptions<InsumoOpcion>("/insumos");
  const filas: Fila[] = data ? [
    ...CAMPOS.map((c) => ({ key: c.k, label: c.label, valor: c.ver(data[c.k]) })),
    { key: "aceite", label: "Insumo usado como aceite", valor: insumos.find((i) => i.id === data.aceiteInsumoId)?.nombre ?? "—" },
  ] : [];
  const columnas: Columna<Fila>[] = [
    { key: "label", header: "PARÁMETRO", className: "text-text-body", render: (f) => f.label },
    { key: "valor", header: "VALOR", align: "right", className: "font-mono font-semibold text-brand-dark whitespace-nowrap", render: (f) => f.valor },
  ];
  return (
    <div className="flex flex-col gap-3">
      <ApiErrorBanner error={error} />
      <div className="flex justify-end">
        <button type="button" onClick={() => setEditar(true)} disabled={!data} className={btnSecondary}><Pencil className="w-3.5 h-3.5" /> Editar parámetros</button>
      </div>
      <ListTable rows={filas} rowKey={(f) => f.key} columns={columnas} empty="Cargando…"
        footer="Los cambios valen para lo que se planifique desde ahora: las producciones ya planificadas guardan su copia" />
      <AnimatePresence>{editar && data && <ParametrosForm actual={data} insumos={insumos} onClose={() => setEditar(false)} />}</AnimatePresence>
    </div>
  );
}

function ParametrosForm({ actual, insumos, onClose }: { actual: Parametros; insumos: InsumoOpcion[]; onClose: () => void }) {
  const [f, setF] = useState(actual);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? "!border-danger ring-2 ring-danger/20" : "");
  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    const body = Object.fromEntries([...CAMPOS.map((c) => c.k), "aceiteInsumoId" as const]
      .filter((k) => f[k] !== actual[k]).map((k) => [k, f[k]]));
    if (!Object.keys(body).length) return onClose();
    setError(null);
    setBusy(true);
    try {
      await api.put("/parametros", body, { silent: true, success: "Parámetros guardados." });
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormPanel title="Editar parámetros" onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="parametros-form" disabled={busy} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="parametros-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        {CAMPOS.map((c) => (
          <Field key={c.k} label={c.label.toUpperCase()} hint={c.k === "alertaSubaPrecio" ? "0,15 = 15 %" : undefined}>
            <input type="number" min={0} step={c.paso ?? 1} value={f[c.k]} onChange={(e) => setF({ ...f, [c.k]: Math.max(0, Number(e.target.value) || 0) })}
              className={`${inputCls} font-mono ${bad(c.k)}`} />
          </Field>
        ))}
        <Field label="INSUMO USADO COMO ACEITE">
          <select value={f.aceiteInsumoId} onChange={(e) => setF({ ...f, aceiteInsumoId: Number(e.target.value) })} className={selectCls}>
            {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </Field>
      </form>
    </FormPanel>
  );
}
