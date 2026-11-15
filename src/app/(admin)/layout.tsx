"use client";

import { AuthGuard } from "@/lib/auth";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "motion/react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <MotionConfig reducedMotion="user">
    <AuthGuard>
      <SidebarProvider>
        <div className="flex h-screen w-full overflow-hidden bg-app-bg">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto pb-20 lg:pb-0">
            {/* solo entrada: cada pantalla aparece con un fundido corto; ?tab= no cambia la ruta */}
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>{children}</motion.div>
          </div>
          <BottomNav />
        </div>
      </SidebarProvider>
    </AuthGuard>
    </MotionConfig>
  );
}
