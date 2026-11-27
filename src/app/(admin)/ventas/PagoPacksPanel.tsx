"use client";

import { useState } from "react";
import { ApiErrorBanner, Field, FormPanel, btnPrimary, btnSecondary, inputCls, selectCls, campoMal } from "@/components/ui";
import { api } from "@/lib/api";
import type { BranchResponse as SedeOpcion, SaleResponse as VentaVista, SettingsResponse as Parametros, StockRow as FilaStock } from "@/lib/api.gen";
import { toLocalISODate } from "@/lib/dateUtils";
import { feedback } from "@/lib/feedback";
import { LineasStock, lineasBody, type LineaElegida } from "./VentaPanel";

type Motivo = "paid_with_packs" | "internal_use";

/** Trueque o uso interno: descuenta stock sin mover la caja. El trueque anota un gasto pagado en packs. */
export default function PagoPacksPanel({ sedes, filas, parametros, onClose }: {
  sedes: SedeOpcion[]; filas: FilaStock[]; parametros: Parametros | null; onClose: () => void;
}) {
  const [motivo, setMotivo] = useState<Motivo>("paid_with_packs");
  const [sedeSel, setSede] = useState(0);
  const sede = sedeSel || sedes[0]?.id || 0;
  const [lineas, setLineas] = useState<LineaElegida[]>([]);
  const [notas, setNotas] = useState("");
  const tipos = parametros?.expenseTypes ?? [];
  const [tipoSel, setTipoGasto] = useState("");
  // lo que muestra el select es lo que se envía, aunque "mercadería" ya no esté en la lista
  const tipoGasto = tipos.includes(tipoSel) ? tipoSel : tipos.includes("mercadería") ? "mercadería" : tipos[0] ?? "";
  const [fecha, setFecha] = useState(toLocalISODate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const trueque = motivo === "paid_with_packs";
  const mal = campoMal(error, "notes");

  const guardar = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const v = await api.post<VentaVista>("/sales", {
        date: fecha, branchId: sede, type: motivo, method: "packs", lines: lineasBody(filas, lineas, false),
        ...(notas.trim() ? { notes: notas.trim() } : {}), ...(trueque ? { expenseType: tipoGasto } : {}),
      }, { silent: true });
      feedback.success(trueque ? `Pago con ${v.packs} packs registrado como gasto (no mueve la caja).` : `${v.packs} packs descontados por uso interno.`);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormPanel title="Pagar con packs" onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="packs-form" disabled={busy || !lineas.length} className={btnPrimary}>{busy ? "Guardando…" : "Registrar"}</button>
    </>}>
      <form id="packs-form" noValidate onSubmit={guardar} className="flex flex-col gap-4">
        <ApiErrorBanner error={error} />
        <Field label="MOTIVO">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)} className={selectCls}>
            <option value="paid_with_packs">Pago a terceros (trueque)</option>
            <option value="internal_use">Uso interno</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SEDE">
            <select value={sede} onChange={(e) => { setSede(Number(e.target.value)); setLineas([]); }} className={selectCls}>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="FECHA"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></Field>
        </div>
        <LineasStock filas={filas} sede={sede} lineas={lineas} setLineas={setLineas} conPrecio={false} />
        <Field label={trueque ? "QUÉ RECIBISTE" : "PARA QUÉ (OPCIONAL)"} hint={trueque ? "Ej: 10 kg de arroz, community manager de noviembre" : undefined}>
          <input value={notas} maxLength={120} onChange={(e) => setNotas(e.target.value)} className={`${inputCls} ${mal}`} />
        </Field>
        {trueque && (
          <Field label="TIPO DE GASTO" hint="Se anota como gasto pagado en packs: no resta caja">
            <select value={tipoGasto} onChange={(e) => setTipoGasto(e.target.value)} className={selectCls}>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        )}
      </form>
    </FormPanel>
  );
}
