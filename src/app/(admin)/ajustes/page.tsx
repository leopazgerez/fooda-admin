"use client";

import { Suspense, useState } from "react";
import { RotateCcw } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { ConfirmDeleteModal, PageHead, btnSecondary } from "@/components/ui";
import Tabs, { useTab } from "@/components/ui/Tabs";
import { env } from "@/config/env";
import { api } from "@/lib/api";
import ListasTab from "./ListasTab";
import ParametrosTab from "./ParametrosTab";
import ReservasTab from "./ReservasTab";
import SedesTab from "./SedesTab";

const TABS = [
  { key: "sedes", label: "Sedes" }, { key: "parametros", label: "Parámetros" },
  { key: "reservas", label: "Reservas" }, { key: "listas", label: "Listas" },
] as const;

export default function AjustesPage() {
  return (
    <>
      <Topbar section="Configuración" title="Ajustes" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <Suspense>
          <Ajustes />
        </Suspense>
      </main>
    </>
  );
}

function Ajustes() {
  const [tab, setTab] = useTab(TABS.map((t) => t.key));
  const [restaurar, setRestaurar] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    try {
      await api.post("/mock/reset", undefined, { success: "Datos de ejemplo restaurados." });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHead title="Ajustes" subtitle="Sedes, parámetros de costo, reservas y listas del sistema"
        right={env.isMock && <button type="button" onClick={() => setRestaurar(true)} className={btnSecondary}><RotateCcw className="w-3.5 h-3.5" /> Restaurar datos de ejemplo</button>} />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "sedes" && <SedesTab />}
      {tab === "parametros" && <ParametrosTab />}
      {tab === "reservas" && <ReservasTab />}
      {tab === "listas" && <ListasTab />}
      <ConfirmDeleteModal isOpen={restaurar} onClose={() => setRestaurar(false)} onConfirm={reset} isLoading={busy}
        title="¿Restaurar datos de ejemplo?" confirmLabel="Restaurar"
        description="Se borra todo lo cargado en este navegador (ventas, producciones, compras, gastos, clientes) y vuelven los datos de ejemplo. No se puede deshacer." />
    </>
  );
}
