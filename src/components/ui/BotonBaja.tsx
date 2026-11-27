"use client";

import { useState } from "react";
import ConfirmModal from "./ConfirmModal";
import { btnSecondary } from "./Erp";

export interface BotonBajaProps {
  /** Texto del botón; por defecto "Eliminar". */
  label?: string;
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
  /** Botón chico para una fila de tabla (si no, va a la izquierda del pie de un panel). */
  fila?: boolean;
  className?: string;
}

/** Botón + confirmación para anular, eliminar o reabrir. Un 409 de la API se muestra donde corresponde y no traba el botón. */
export default function BotonBaja({ label = "Eliminar", accion, itemName, title, description, confirmLabel, tone = "danger", onHecho, onError, fila, className }: BotonBajaProps) {
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await accion();
      onHecho?.();
    } catch (e) {
      onError?.(e);
    } finally {
      setAbierto(false);
      setBusy(false);
    }
  };
  return <>
    <button type="button" onClick={() => setAbierto(true)} className={className ?? `${btnSecondary} ${fila ? "py-0.5 px-2 text-[11px]" : "md:mr-auto"} ${tone === "danger" ? "text-danger" : ""}`}>{label}</button>
    <ConfirmModal isOpen={abierto} onClose={() => setAbierto(false)} onConfirm={confirmar} isLoading={busy} tone={tone}
      itemName={itemName} title={title} description={description} confirmLabel={confirmLabel} />
  </>;
}
