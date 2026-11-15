"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { feedback, type Toast } from "@/lib/feedback";

const DURATION = { success: 4000, error: 7000 };
const LEAVE_MS = 200;
// useSyncExternalStore compares snapshots by reference: the server one must be the same array every call
const NO_TOASTS: Toast[] = [];

/** Global loader (while any API call is in flight) and the top-right toasts. Mounted once in the root layout. */
export default function FeedbackLayer() {
  const pending = useSyncExternalStore(feedback.subscribe, feedback.pending, () => 0);
  const toasts = useSyncExternalStore(feedback.subscribe, feedback.toasts, () => NO_TOASTS);

  return (
    <>
      {pending > 0 && (
        <div role="progressbar" aria-label="Esperando respuesta del servidor" className="fixed inset-x-0 top-0 z-[80] pointer-events-none">
          <div className="feedback-loader-bar h-[3px] overflow-hidden bg-brand-soft">
            <div className="h-full w-1/3 bg-brand" />
          </div>
          <div className="feedback-loader-pill mx-auto mt-2 w-fit flex items-center gap-2 bg-sidebar-bg text-sidebar-text-active text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
            <span>Procesando…</span>
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
      </div>
    </>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || leaving) return;
    const t = setTimeout(() => setLeaving(true), DURATION[toast.kind]);
    return () => clearTimeout(t);
  }, [paused, leaving, toast.kind]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => feedback.dismiss(toast.id), LEAVE_MS);
    return () => clearTimeout(t);
  }, [leaving, toast.id]);

  const ok = toast.kind === "success";
  return (
    <div role={ok ? "status" : "alert"} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      className={`${leaving ? "feedback-toast-out" : "feedback-toast-in"} pointer-events-auto bg-surface rounded-2xl border shadow-xl flex items-start gap-3 p-3.5 border-l-4 ${
        ok ? "border-border-subtle border-l-success" : "border-danger/30 border-l-danger"
      }`}>
      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
        {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      </span>
      <div className="flex-1 min-w-0 text-xs">
        <p className={`font-heading font-bold text-sm ${ok ? "text-text-primary" : "text-danger"}`}>{toast.title}</p>
        <p className="text-text-secondary mt-0.5 break-words">{toast.text}</p>
      </div>
      <button type="button" onClick={() => setLeaving(true)} aria-label="Cerrar aviso"
        className="text-text-muted hover:text-text-primary p-0.5 rounded-lg cursor-pointer shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
