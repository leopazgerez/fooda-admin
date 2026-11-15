"use client";

import { Suspense } from "react";
import Topbar from "@/components/layout/Topbar";
import { PageHead } from "@/components/ui";
import Tabs, { useTab } from "@/components/ui/Tabs";
import InsumosTab from "./InsumosTab";
import PacksTab from "./PacksTab";
import PlatosTab from "./PlatosTab";
import ProveedoresTab from "./ProveedoresTab";

const TABS = [
  { key: "insumos", label: "Insumos" }, { key: "platos", label: "Platos" },
  { key: "packs", label: "Packs" }, { key: "proveedores", label: "Proveedores" },
] as const;

export default function CatalogoPage() {
  return (
    <>
      <Topbar section="Gestión" title="Catálogo" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <Suspense>
          <Catalogo />
        </Suspense>
      </main>
    </>
  );
}

function Catalogo() {
  const [tab, setTab] = useTab(TABS.map((t) => t.key));
  return (
    <>
      <PageHead title="Catálogo" subtitle="Insumos con sus precios, recetas de cada plato, packs y lugares de compra" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "insumos" && <InsumosTab />}
      {tab === "platos" && <PlatosTab />}
      {tab === "packs" && <PacksTab />}
      {tab === "proveedores" && <ProveedoresTab />}
    </>
  );
}
