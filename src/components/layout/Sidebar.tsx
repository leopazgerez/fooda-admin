"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { nav, type NavLink } from "@/config/nav";
import { logout, useCurrentUser } from "@/lib/auth";
import { initials } from "@/lib/format";
import { getAssetPath } from "@/lib/assets";
import { useSidebar } from "./SidebarContext";
import { useState } from "react";
import { ConfirmModal } from "@/components/ui";

export const isUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const { isOpen, closeSidebar } = useSidebar();
  const [salir, setSalir] = useState(false);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            onClick={closeSidebar}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-brand/40 z-40 lg:hidden"
            aria-label="Cerrar menú"
          />
        )}
      </AnimatePresence>

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-bg flex flex-col h-screen select-none border-r-4 border-accent shadow-2xl transition-transform duration-300 ease-in-out
          lg:static lg:shadow-none lg:translate-x-0 lg:shrink-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-4 flex items-center justify-between border-b border-sidebar-hover shrink-0">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAssetPath("/fooda-logo.png")} alt="Fooda" className="w-11 h-11 object-contain shrink-0" />
            <span className="text-[10px] font-bold tracking-[0.6px] text-sidebar-text">EL CLUB DEL FREEZER</span>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 text-text-muted hover:text-text-primary rounded-sm transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-3 px-2 py-3 flex-1 overflow-y-auto">
          {nav.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <p className="px-2.5 pb-1.5 text-[10px] font-bold font-mono tracking-[0.5px] text-sidebar-text/60">{section.label}</p>
              {section.items.map((link) => (
                <Item key={link.href} link={link} active={isUnder(pathname, link.href)} onNavigate={closeSidebar} />
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 flex items-center justify-between gap-2 bg-sidebar-hover border-t border-sidebar-hover">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-sm bg-border-subtle border border-border-strong text-text-body flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
              {initials(user.fullName)}
            </span>
            <span className="text-xs font-bold text-sidebar-text-active truncate" title={user.email}>{user.fullName}</span>
          </div>
          <button
            type="button"
            onClick={() => setSalir(true)}
            title="Cerrar sesión"
            className="text-text-muted hover:text-danger px-1 py-2 rounded-sm transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </aside>
      <ConfirmModal tone="neutral" isOpen={salir} onClose={() => setSalir(false)}
        title="¿Cerrar sesión?" description="Vas a salir del panel y tendrás que volver a ingresar." confirmLabel="Cerrar sesión"
        onConfirm={() => {
          logout();
          closeSidebar();
          router.replace("/login");
        }} />
    </>
  );
}

function Item({ link, active, onNavigate }: { link: NavLink; active: boolean; onNavigate: () => void }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs border-l-4 transition-colors ${
        active
          ? "bg-accent/20 border-accent text-sidebar-text-active font-semibold"
          : "border-transparent text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-accent" : "text-sidebar-text"}`} />
      <span className="truncate">{link.name}</span>
    </Link>
  );
}
