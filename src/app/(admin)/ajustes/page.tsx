"use client";

import { Suspense } from "react";
import Topbar from "@/components/layout/Topbar";
import { PageHead } from "@/components/ui";
import Tabs, { useTab } from "@/components/ui/Tabs";
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
  return (
    <>
      <PageHead title="Ajustes" subtitle="Sedes, parámetros de costo, reservas y listas del sistema" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "sedes" && <SedesTab />}
      {tab === "parametros" && <ParametrosTab />}
      {tab === "reservas" && <ReservasTab />}
      {tab === "listas" && <ListasTab />}
    </>
  );
}
