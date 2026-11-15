"use client";

import { useState } from "react";
import { HandCoins, Plus, TrendingUp, Wallet } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { ApiErrorBanner, Card, CardHead, ConfirmDeleteModal, ListTable, PageHead, Stat, Tag, btnPrimary, btnSecondary, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { Gasto, MesFinanzas, Parametros } from "@/lib/apiTypes";
import { formatDate, toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource, useReloadOnWrite } from "@/lib/useApi";
import GastoPanel from "./GastoPanel";
import { AnimatePresence } from "motion/react";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const pct = (n: number) => `${Math.round(n * 100)} %`;

export default function FinanzasPage() {
  const [panel, setPanel] = useState<Gasto | "nuevo" | null>(null);
  const [cerrar, setCerrar] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const { data, error, reload } = useApiResource(() => Promise.all([
    api.getOne<MesFinanzas[]>("/finanzas/mensual"),
    api.getAll<Gasto>("/gastos", { sortBy: "fecha", sortDir: "desc" }),
    api.getOne<Parametros>("/parametros"),
  ]), []);
  useReloadOnWrite(reload);
  const [meses, gastos, parametros] = data ?? [[], [], null];
  const hoy = toLocalISODate().slice(0, 7);
  const actual = meses.find((m) => m.mes === hoy);

  const colMeses: Columna<MesFinanzas>[] = [
    { key: "mes", header: "MES", className: "font-semibold text-brand-dark whitespace-nowrap capitalize", render: (m) => nombreMes(m.mes) },
    { key: "prod", header: "PRODUCIDOS", align: "right", hideBelow: "md", className: "font-mono", render: (m) => m.producidos },
    { key: "vend", header: "VENDIDOS", align: "right", hideBelow: "md", className: "font-mono", render: (m) => `${m.vendidos} · ${pct(m.pctVendido)}` },
    { key: "ventas", header: "VENTAS", align: "right", hideBelow: "sm", className: "font-mono", render: (m) => money(m.ventas) },
    { key: "gastos", header: "GASTOS", align: "right", hideBelow: "sm", className: "font-mono", render: (m) => money(m.gastosPagados) },
    { key: "caja", header: "CAJA", align: "right", className: "font-mono", render: (m) =>
      <span className={m.resultadoCaja < 0 ? "text-danger" : ""}>{money(m.resultadoCaja)}</span> },
    { key: "ganancia", header: "GANANCIA", align: "right", className: "font-mono whitespace-nowrap", render: (m) => <>
      <span className={m.ganancia < 0 ? "text-danger" : "text-success"}>{money(Math.round(m.ganancia))}</span>
      <span className="block text-[10px] text-text-muted">{m.gananciaEnPacks} packs</span>
    </> },
    { key: "ind", header: "INDIRECTO / PACK", align: "right", hideBelow: "md", className: "font-mono whitespace-nowrap", render: (m) => <>
      {money(Math.round(m.indirecto.valor))}
      <span className="block">{m.indirecto.esReferencia ? <Tag>Referencia</Tag> : m.indirecto.provisorio ? <Tag tone="warning">Provisorio</Tag> : <Tag tone="solid">Cerrado</Tag>}</span>
    </> },
    { key: "estado", header: "", align: "right", render: (m) => m.cerrado ? <Tag tone="solid">Cerrado</Tag> : m.mes < hoy
      ? <button type="button" onClick={() => setCerrar(m.mes)} className={`${btnSecondary} py-1 text-[11px]`}>Cerrar mes</button> : <Tag>En curso</Tag> },
  ];

  const colGastos: Columna<Gasto>[] = [
    { key: "fecha", header: "FECHA", className: "font-mono whitespace-nowrap text-text-secondary", render: (g) => formatDate(g.fecha) },
    { key: "detalle", header: "DETALLE", className: "text-brand-dark", render: (g) => <>
      {g.detalle}
      <span className="block mt-0.5 flex flex-wrap gap-1">
        <Tag>{g.tipo}</Tag>
        {g.medio === "packs" && <Tag tone="info">Pagado con packs</Tag>}
        {g.origen && <Tag>Automático</Tag>}
        {!g.pagado && <Tag tone="warning">Sin pagar</Tag>}
      </span>
    </> },
    { key: "medio", header: "MEDIO", hideBelow: "sm", className: "text-text-secondary capitalize", render: (g) => g.medio.replace("_", " ") },
    { key: "monto", header: "MONTO", align: "right", className: "font-mono whitespace-nowrap", render: (g) => money(g.monto) },
  ];

  const confirmarCierre = async () => {
    if (!cerrar) return;
    setCerrando(true);
    try {
      await api.post("/finanzas/cierres", { mes: cerrar }, { success: `${nombreMes(cerrar)} cerrado: el indirecto queda fijo.` });
      setCerrar(null);
    } catch {
      // el toast de error ya lo muestra api
    } finally {
      setCerrando(false);
    }
  };

  return (
    <>
      <Topbar section="Gestión" title="Finanzas y caja" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Finanzas y caja" subtitle="Los ingresos salen de las ventas cobradas. Acá se registran los gastos"
          right={<button type="button" onClick={() => setPanel("nuevo")} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Registrar gasto</button>} />
        <ApiErrorBanner error={error} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="COBRADO DEL MES" icon={<HandCoins className="w-3.5 h-3.5" />} value={money(actual?.cobros ?? 0)} foot={`${actual?.vendidos ?? 0} packs vendidos`} />
          <Stat label="CAJA DEL MES" icon={<Wallet className="w-3.5 h-3.5" />} value={money(actual?.resultadoCaja ?? 0)}
            foot={`cobrado − ${money(actual?.gastosPagados ?? 0)} de gastos`} />
          <Stat label="GANANCIA DEL MES" icon={<TrendingUp className="w-3.5 h-3.5" />} value={money(Math.round(actual?.ganancia ?? 0))}
            foot={`${actual?.gananciaEnPacks ?? 0} packs · costo real descontado`} />
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="MESES" caption="Cerrá un mes terminado para fijar su indirecto por pack" />
          <ListTable rows={meses} rowKey={(m) => m.mes} columns={colMeses} empty="Sin movimientos." />
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="GASTOS" caption="Los pagados con packs no restan caja. Los automáticos vienen de compras y pagos con packs" />
          <ListTable rows={gastos} rowKey={(g) => g.id} columns={colGastos} onRowClick={setPanel} empty="Sin gastos." footer={`${gastos.length} gastos`} />
        </Card>
      </main>
      <AnimatePresence>{panel && <GastoPanel gasto={panel === "nuevo" ? null : panel} tipos={parametros?.tiposGasto ?? []} onClose={() => setPanel(null)} />}</AnimatePresence>
      <ConfirmDeleteModal isOpen={!!cerrar} onClose={() => setCerrar(null)} onConfirm={confirmarCierre} isLoading={cerrando}
        title={cerrar ? `Cerrar ${nombreMes(cerrar)}` : ""} confirmLabel="Cerrar mes"
        description={cerrar ? `El indirecto por pack de ${nombreMes(cerrar)} queda fijo y deja de cambiar con nuevos gastos. No se puede deshacer.` : ""} />
    </>
  );
}
