"use client";

import React, { useEffect } from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemName?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "¿Confirmar eliminación?",
  itemName,
  description,
  confirmLabel = "Eliminar definitivamente",
  cancelLabel = "Cancelar",
  isLoading = false,
}: ConfirmDeleteModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
    {isOpen && <Fondo onClose={onClose}>
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
        className="bg-surface rounded-2xl border border-border-subtle w-full max-w-md overflow-hidden shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-bg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-danger-soft text-danger flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-base text-text-primary">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-3 text-xs text-text-secondary">
          {description ? (
            <p className="leading-relaxed">{description}</p>
          ) : (
            <p className="leading-relaxed">
              ¿Estás seguro de que deseas eliminar{" "}
              {itemName ? (
                <strong className="text-text-primary font-semibold">&quot;{itemName}&quot;</strong>
              ) : (
                "este elemento"
              )}
              ? Esta acción no se puede deshacer y se removerá del sistema.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-surface-alt border-t border-border-subtle text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-text-secondary hover:bg-surface hover:border-border-subtle border border-transparent font-medium transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={isLoading}
            className="bg-danger text-white px-5 py-2 rounded-xl font-semibold hover:bg-danger-strong transition-all shadow-xs cursor-pointer flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </motion.div>
    </Fondo>}
    </AnimatePresence>
  );
}

/** Mientras sale no recibe clics: si no, un doble clic en Confirmar lo ejecutaría dos veces. */
function Fondo({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const presente = useIsPresent();
  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs ${presente ? "" : "pointer-events-none"}`}
    >
      {children}
    </motion.div>
  );
}
