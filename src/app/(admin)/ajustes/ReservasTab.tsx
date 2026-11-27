"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiErrorBanner, BotonBaja, Field, FormPanel, ListTable, btnPrimary, btnSecondary, inputCls, type Columna } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { ReserveFund as Reserva } from "@/lib/api.gen";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";
import { AnimatePresence } from "motion/react";

/** Reparto de la ganancia del mes en reservas (%). */
export default function ReservasTab() {
  const [edit, setEdit] = useState<Reserva | "nueva" | null>(null);
  const { data, error, reload } = useApiResource(() => api.getAll<Reserva>("/reserve-funds"), []);
  useReloadOnWrite(reload);
  const reservas = data ?? [];
  // el panel recibe el registro recargado (version al día), no la copia del click
  const abierta = edit && edit !== "nueva" ? reservas.find((r) => r.id === edit.id) ?? edit : edit;
  const suma = reservas.reduce((a, r) => a + r.percentage, 0);
  const columnas: Columna<Reserva>[] = [
    { key: "nombre", header: "RESERVA", className: "font-semibold text-brand-dark", render: (r) => r.name },
    { key: "pct", header: "% DE LA GANANCIA", align: "right", className: "font-mono", render: (r) => `${r.percentage} %` },
  ];
  return (
    <div className="flex flex-col gap-3">
      <ApiErrorBanner error={error} />
      <div className="flex justify-end">
        <button type="button" onClick={() => setEdit("nueva")} className={btnSecondary}><Plus className="w-3.5 h-3.5" /> Nueva reserva</button>
      </div>
      <ListTable rows={reservas} rowKey={(r) => r.id} columns={columnas} onRowClick={setEdit} empty="Sin reservas."
        footer={<span className={suma > 100 ? "text-danger" : ""}>Suman {suma} %{suma > 100 ? " — superan el 100 % de la ganancia" : ""}</span>} />
      <AnimatePresence>{abierta && <ReservaForm reserva={abierta === "nueva" ? null : abierta} onClose={() => setEdit(null)} />}</AnimatePresence>
    </div>
  );
}

function ReservaForm({ reserva, onClose }: { reserva: Reserva | null; onClose: () => void }) {
  const [nombre, setNombre] = useState(reserva?.name ?? "");
  const [porcentaje, setPorcentaje] = useState(reserva?.percentage ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const bad = (k: string) => (error instanceof ApiError && error.field === k ? "!border-danger ring-2 ring-danger/20" : "");
  const correr = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const guardar = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    const body = { name: nombre.trim(), percentage: porcentaje };
    correr(() => (reserva
      ? api.patch(`/reserve-funds/${reserva.id}`, { ...body, version: reserva.version }, { silent: true, success: "Reserva actualizada." })
      : api.post("/reserve-funds", body, { silent: true, success: "Reserva creada." })));
  };
  return (
    <FormPanel title={reserva ? `Editar ${reserva.name}` : "Nueva reserva"} onClose={onClose} footer={<>
      {reserva && <BotonBaja label="Eliminar" itemName={reserva.name} className={`${btnSecondary} md:mr-auto text-danger`}
        accion={() => api.del(`/reserve-funds/${reserva.id}`, { silent: true, success: "Reserva eliminada." })} onHecho={onClose} onError={setError} />}
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="reserva-form" disabled={busy || !nombre.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="reserva-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <Field label="NOMBRE"><input value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} className={`${inputCls} ${bad("name")}`} /></Field>
        <Field label="% DE LA GANANCIA">
          <input type="number" min={0} max={100} value={porcentaje} onChange={(e) => setPorcentaje(Math.max(0, Number(e.target.value) || 0))} className={`${inputCls} font-mono ${bad("percentage")}`} />
        </Field>
      </form>
    </FormPanel>
  );
}
