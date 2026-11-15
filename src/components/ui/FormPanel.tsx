"use client";

import { useEffect, useId, useRef } from "react";
import { ArrowLeft, X } from "lucide-react";
import { motion, useIsPresent } from "motion/react";
import { crearBloqueo } from "@/lib/scrollLock";

let bloquearScroll: ReturnType<typeof crearBloqueo> | undefined; // se crea en el cliente (el prerender no tiene document)

const ANCHO = { md: "md:w-[480px]", lg: "md:w-[720px]" } as const;

/**
 * Formulario estándar: panel lateral derecho en desktop (≥ md) y pantalla completa en mobile.
 * Montarlo solo mientras está abierto, dentro de <AnimatePresence> para que anime al cerrarse.
 * El botón primario del footer apunta al form con form="<id>".
 */
export default function FormPanel({ title, onClose, size = "md", footer, children }: {
  title: string; onClose: () => void; size?: keyof typeof ANCHO; footer: React.ReactNode; children: React.ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  // mientras sale (animación de cierre) sigue montado: no debe recibir clics ni Esc, o se guardaría dos veces
  const presente = useIsPresent();

  useEffect(() => {
    if (!presente) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, presente]);

  useEffect(() => (bloquearScroll ??= crearBloqueo(document.body.style))(), []);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])")?.focus();
  }, []);

  // el fondo cierra solo en desktop: en mobile el panel ocupa toda la pantalla
  const fondo = () => { if (window.matchMedia("(min-width: 768px)").matches) onClose(); };

  return (
    <motion.div className={`fixed inset-0 z-50 flex justify-end md:bg-brand/20 ${presente ? "" : "pointer-events-none"}`} onClick={fondo}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", bounce: 0, duration: 0.25 }}
        className={`w-full ${ANCHO[size]} h-dvh bg-surface md:shadow-2xl flex flex-col`}>
        <header className="h-14 px-4 md:px-6 flex items-center gap-2 border-b border-border-subtle shrink-0">
          <button type="button" onClick={onClose} aria-label="Volver"
            className="md:hidden w-8 h-8 -ml-1 flex items-center justify-center rounded-full hover:bg-brand-soft text-text-secondary cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 id={titleId} className="flex-1 min-w-0 truncate text-base font-semibold text-text-primary">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-full hover:bg-brand-soft text-text-secondary cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 py-5">{children}</div>
        <footer className="shrink-0 px-4 md:px-6 py-3 border-t border-border-subtle bg-surface flex flex-wrap items-center justify-end gap-2 [&>button]:max-md:flex-1">
          {footer}
        </footer>
      </motion.div>
    </motion.div>
  );
}
