"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ApiErrorBanner, Field, FormPanel, ListTable, btnPrimary, btnSecondary, inputCls, selectCls, type Columna, campoMal } from "@/components/ui";
import { api } from "@/lib/api";
import type { SettingsResponse as Parametros, SupplyResponse } from "@/lib/api.gen";
import { money } from "@/lib/format";
import { useApiResource, useOptions, useReloadOnWrite } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

type Num = Exclude<keyof Parametros, "saleReasons" | "expenseTypes" | "oilSupplyId" | "version">;
const CAMPOS: { k: Num; label: string; ver: (v: number) => string; paso?: number }[] = [
  { k: "packPrice", label: "Precio del pack", ver: money },
  { k: "oilMlPerPack", label: "Aceite por pack (ml)", ver: (v) => `${v} ml` },
  { k: "traysPerPack", label: "Bandejas por pack", ver: String },
  { k: "stickersPerPack", label: "Stickers por pack", ver: String },
  { k: "referenceOverhead", label: "Indirecto de referencia por pack", ver: money },
  { k: "regularMonths", label: "Meses seguidos comprando para ser regular", ver: String },
  { k: "recontactDays", label: "Días sin comprar para recontactar", ver: (v) => `${v} días` },
  { k: "priceRiseAlert", label: "Alerta si un precio sube más de", ver: (v) => `${Math.round(v * 100)} %`, paso: 0.01 },
];
interface Fila { key: string; label: string; valor: string }

export default function ParametrosTab() {
  const [editar, setEditar] = useState(false);
  const { data, error, reload } = useApiResource(() => api.getOne<Parametros>("/settings"), []);
  useReloadOnWrite(reload);
  const { options: insumos } = useOptions<SupplyResponse>("/supplies");
  const filas: Fila[] = data ? [
    ...CAMPOS.map((c) => ({ key: c.k, label: c.label, valor: c.ver(data[c.k]) })),
    { key: "aceite", label: "Insumo usado como aceite", valor: insumos.find((i) => i.id === data.oilSupplyId)?.name ?? "—" },
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

function ParametrosForm({ actual: abierto, insumos, onClose }: { actual: Parametros; insumos: SupplyResponse[]; onClose: () => void }) {
  // el registro tal como se abrió: base del PATCH y su version (si otra pestaña lo cambió, 409 y no se pisa)
  const [actual] = useState(abierto);
  const [f, setF] = useState(actual);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => campoMal(error, k);
  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    // PUT: la API pide todos los campos; version para no pisar un cambio de otra pestaña
    if (![...CAMPOS.map((c) => c.k), "oilSupplyId" as const].some((k) => f[k] !== actual[k])) return onClose();
    setError(null);
    setBusy(true);
    try {
      await api.put("/settings", f, { silent: true, success: "Parámetros guardados." });
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
          <Field key={c.k} label={c.label.toUpperCase()} hint={c.k === "priceRiseAlert" ? "0,15 = 15 %" : undefined}>
            <input type="number" min={0} step={c.paso ?? 1} value={f[c.k]} onChange={(e) => setF({ ...f, [c.k]: Math.max(0, Number(e.target.value) || 0) })}
              className={`${inputCls} font-mono ${bad(c.k)}`} />
          </Field>
        ))}
        <Field label="INSUMO USADO COMO ACEITE">
          <select value={f.oilSupplyId ?? ""} onChange={(e) => setF({ ...f, oilSupplyId: e.target.value ? Number(e.target.value) : null })} className={selectCls}>
            <option value="">Sin aceite</option>
            {insumos.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
      </form>
    </FormPanel>
  );
}
