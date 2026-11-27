"use client";

import { useState } from "react";
import ConfirmModal from "./ConfirmModal";
import { btnSecondary } from "./Erp";

export interface BotonBajaProps {
  /** Texto del botón: "Eliminar", "Anular venta", "Reabrir", … */
  label: string;
  /** La llamada a la API. Con `onError`, usar `silent: true` (el error lo muestra el panel). */
  accion: () => Promise<unknown>;
  itemName?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "neutral";
  /** Después del éxito (p. ej. cerrar el panel). */
  onHecho?: () => void;
  /** Si está, el error va al panel; si no, queda el toast que ya muestra api.ts. */
  onError?: (e: unknown) => void;
  className?: string;
}

/** Botón + confirmación para anular, eliminar o reabrir. Un 409 de la API se muestra donde corresponde y no traba el botón. */
export default function BotonBaja({ label, accion, itemName, title, description, confirmLabel, tone = "danger", onHecho, onError, className }: BotonBajaProps) {
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await accion();
      setAbierto(false);
      onHecho?.();
    } catch (e) {
      setAbierto(false);
      onError?.(e);
    } finally {
      setBusy(false);
    }
  };
  return <>
    <button type="button" onClick={() => setAbierto(true)} className={className ?? `${btnSecondary} text-danger`}>{label}</button>
    <ConfirmModal isOpen={abierto} onClose={() => setAbierto(false)} onConfirm={confirmar} isLoading={busy} tone={tone}
      itemName={itemName} title={title} description={description} confirmLabel={confirmLabel} />
  </>;
}
