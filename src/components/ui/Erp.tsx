// Piezas de las pantallas de Fooda: tarjetas, indicadores, etiquetas y campos de formulario.

import React from "react";

export const inputCls =
  "w-full bg-surface border border-border-strong rounded-xs px-2.5 py-1.5 text-xs text-brand-dark outline-none focus:border-accent placeholder:text-text-muted";
export const selectCls = `${inputCls} cursor-pointer`;
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 bg-accent text-white text-xs font-bold px-3.5 py-2 rounded-xs shadow-xs hover:bg-accent-dark transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 bg-surface border border-border-strong text-text-body text-xs px-3 py-1.5 rounded-xs shadow-xs hover:bg-surface-alt transition-colors cursor-pointer";
export const thCls = "px-3 py-2 text-left text-[10px] font-bold tracking-[0.5px] text-text-label font-mono whitespace-nowrap";
export const tdCls = "px-3 py-3 text-xs text-text-body";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`bg-surface border border-border-subtle rounded-sm shadow-xs ${className}`}>{children}</section>;
}

/** Screen title under the Topbar. */
export function PageHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-border-subtle">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-[-0.45px] text-text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-text-secondary">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** Card title row: caps title, optional caption, icon and right-side slot. */
export function CardHead({ title, caption, icon, right }: {
  title: string; caption?: string; icon?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-border-faint">
      <div className="flex-1 min-w-48">
        <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-[0.6px] text-brand-dark">
          {icon}
          {title}
        </h3>
        {caption && <p className="text-[11px] text-text-secondary font-mono">{caption}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/** Compact KPI tile. */
export function Stat({ label, tag, icon, value, unit, foot }: {
  label: string; tag?: React.ReactNode; icon?: React.ReactNode; value: string; unit?: string; foot?: React.ReactNode;
}) {
  return (
    <Card className="p-3.5 flex flex-col gap-1 flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold tracking-[0.5px] text-text-secondary font-mono min-w-0 pt-0.5">{label}</span>
        {tag ?? <span className="text-text-muted shrink-0">{icon}</span>}
      </div>
      <p className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-text-primary font-mono">{value}</span>
        {unit && <span className="text-xs text-text-secondary font-mono">{unit}</span>}
      </p>
      {foot && <div className="text-[11px] text-text-secondary">{foot}</div>}
    </Card>
  );
}

const tones = {
  neutral: "bg-brand-soft text-text-label border-border-subtle",
  success: "bg-success-soft text-success border-success-line",
  solid: "bg-success-tint text-success-strong border-transparent",
  info: "bg-info-soft text-info border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  warning: "bg-warning-tint text-warning-strong border-transparent",
};
export type Tone = keyof typeof tones;

export function Tag({ tone = "neutral", dot, mono, children }: {
  tone?: Tone; dot?: boolean; mono?: boolean; children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs border text-[11px] whitespace-nowrap ${tones[tone]} ${mono ? "font-mono" : "font-semibold"}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${tone === "success" ? "bg-accent" : "bg-text-muted"}`} />}
      {children}
    </span>
  );
}

/** Small pill switch (filtros de lista). */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-brand-soft border border-border-subtle rounded-sm">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-2 py-0.5 rounded-xs text-[11px] font-mono cursor-pointer ${
            o === value ? "bg-surface text-text-primary shadow-xs" : "text-text-secondary hover:text-text-primary"
          }`}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-bold tracking-[0.275px] text-text-label">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-text-secondary font-mono">{hint}</span>}
    </label>
  );
}
