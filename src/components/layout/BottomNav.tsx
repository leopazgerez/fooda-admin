"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { bottomNav } from "@/config/nav";
import { isUnder } from "./Sidebar";
import { useSidebar } from "./SidebarContext";

const tabCls = (active: boolean) =>
  `flex-1 h-13 flex flex-col items-center justify-center gap-1 rounded-sm text-[11px] ${
    active ? "bg-success-soft text-accent font-bold" : "text-text-secondary"
  }`;

/** Mobile-only tab bar; "Más" opens the full sidebar. */
export default function BottomNav() {
  const pathname = usePathname();
  const { openSidebar } = useSidebar();

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 flex bg-surface border-t border-border-subtle px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {bottomNav.map(({ name, href, icon: Icon }) => (
        <Link key={href} href={href} className={tabCls(isUnder(pathname, href))}>
          <Icon className="w-5 h-5" />
          {name}
        </Link>
      ))}
      <button type="button" onClick={openSidebar} className={`${tabCls(false)} cursor-pointer`}>
        <Menu className="w-5 h-5" />
        Más
      </button>
    </nav>
  );
}
