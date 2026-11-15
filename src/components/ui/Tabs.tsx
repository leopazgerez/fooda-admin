"use client";

import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";

/** Pestañas de sección guardadas en ?tab= (export estático: sin rutas dinámicas). Usar dentro de <Suspense>. */
export function useTab<K extends string>(keys: readonly K[]): [K, (k: K) => void] {
  const router = useRouter();
  const raw = useSearchParams().get("tab");
  const tab = (keys as readonly string[]).includes(raw ?? "") ? (raw as K) : keys[0];
  return [tab, (k) => router.replace(`?tab=${k}`, { scroll: false })];
}

export default function Tabs<K extends string>({ tabs, value, onChange }: {
  tabs: readonly { key: K; label: string }[]; value: K; onChange: (k: K) => void;
}) {
  const id = useId(); // un subrayado por instancia: dos Tabs en la misma pantalla no se mezclan
  return (
    <div role="tablist" className="flex gap-1 border-b border-border-subtle overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={t.key === value} onClick={() => onChange(t.key)}
          className={`relative -mb-px px-3 py-2 text-sm whitespace-nowrap cursor-pointer ${
            t.key === value ? "text-text-primary font-semibold" : "text-text-secondary hover:text-text-primary"}`}>
          {t.label}
          {t.key === value && <motion.span layoutId={id} className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" transition={{ type: "spring", bounce: 0, duration: 0.25 }} />}
        </button>
      ))}
    </div>
  );
}
