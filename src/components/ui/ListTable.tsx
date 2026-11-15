"use client";

import { Fragment } from "react";
import { tdCls, thCls } from "./Erp";

export interface Columna<T> {
  key: string; header: string; align?: "left" | "right" | "center";
  render: (r: T) => React.ReactNode; className?: string; hideBelow?: "sm" | "md";
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;
const OCULTA = { sm: "max-sm:hidden", md: "max-md:hidden" } as const;

/** Lista estándar de las secciones: tabla con columnas; en mobile la primera columna queda fija. */
export default function ListTable<T>({ columns, rows, rowKey, empty, onRowClick, expand, footer }: {
  columns: Columna<T>[]; rows: T[]; rowKey: (r: T) => string | number; empty: string;
  onRowClick?: (r: T) => void;
  /** contenido opcional debajo de la fila (detalle expandible) */
  expand?: (r: T) => React.ReactNode | null;
  footer?: React.ReactNode;
}) {
  const cls = (c: Columna<T>, i: number, base: string) =>
    [base, ALIGN[c.align ?? "left"], c.hideBelow ? OCULTA[c.hideBelow] : "", i === 0 ? "max-md:sticky max-md:left-0 max-md:z-[1] bg-inherit" : "", c.className ?? ""].join(" ");

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="border border-border-subtle rounded-xs overflow-x-auto bg-surface">
        <table className="w-full">
          <thead className="bg-surface-alt border-b border-border-subtle">
            <tr className="bg-surface-alt">{columns.map((c, i) => <th key={c.key} className={cls(c, i, thCls)}>{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border-faint">
            {rows.map((r) => {
              const extra = expand?.(r);
              return (
                <Fragment key={rowKey(r)}>
                  <tr onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className={`bg-surface ${onRowClick ? "cursor-pointer hover:bg-surface-alt" : ""}`}>
                    {columns.map((c, i) => <td key={c.key} className={cls(c, i, tdCls)}>{c.render(r)}</td>)}
                  </tr>
                  {extra && <tr><td colSpan={columns.length} className="bg-surface-alt px-4 py-3">{extra}</td></tr>}
                </Fragment>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-xs text-text-muted">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {footer && <p className="text-[11px] text-text-secondary font-mono">{footer}</p>}
    </div>
  );
}
