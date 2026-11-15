"use client";

import { ChevronRight, Menu, UserRound } from "lucide-react";
import { useSidebar } from "./SidebarContext";

interface TopbarProps {
  /** Last breadcrumb step (the current screen). */
  title: string;
  /** Middle breadcrumb step, e.g. "Operación Central". */
  section?: string;
  /** Right side of the bar (buttons, search, ...). */
  actions?: React.ReactNode;
  className?: string;
}

export default function Topbar({ title, section, actions, className = "" }: TopbarProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className={`sticky top-0 h-14 bg-surface/90 backdrop-blur-sm border-b border-border-subtle px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 ${className}`}>
      <div className="flex items-center gap-2 min-w-0 text-xs">
        <button
          type="button"
          onClick={toggleSidebar}
          className="lg:hidden p-1.5 -ml-1 text-text-primary hover:bg-brand-soft rounded-xs transition-colors shrink-0"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="w-4 h-4" />
        </button>
        <span className="font-medium text-text-muted">ERP</span>
        {section && (
          <span className="hidden sm:contents">
            <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
            <span className="font-semibold text-brand-dark truncate">{section}</span>
          </span>
        )}
        <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
        <h1 className="font-medium text-text-label truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <span className="w-8 h-8 rounded-full bg-brand-soft border border-border-subtle flex items-center justify-center text-text-secondary">
          <UserRound className="w-4 h-4" />
        </span>
      </div>
    </header>
  );
}
