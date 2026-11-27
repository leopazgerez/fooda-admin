"use client";

import { useState } from "react";
import { Cake, PhoneCall, UserPlus, Users } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { ApiErrorBanner, Card, CardHead, ListTable, PageHead, Segmented, Stat, Tag, btnPrimary, inputCls, type Columna } from "@/components/ui";
import { api } from "@/lib/api";
import type { CustomerResponse as ClienteVista, FollowUpsResponse as Recontactos } from "@/lib/api.gen";
import { buscarClientes } from "@/lib/buscar";
import { formatDate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource, useReloadOnWrite, vigente } from "@/lib/useApi";
import { ClienteDetalle, ClienteForm, cumple } from "./ClientePanels";
import { AnimatePresence } from "motion/react";

const FILTROS = ["TODOS", "PARA RECONTACTAR", "CUMPLEN HOY"] as const;

export default function ClientesPage() {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("TODOS");
  const [q, setQ] = useState("");
  const [detalle, setDetalle] = useState<ClienteVista | null>(null);
  const [form, setForm] = useState<ClienteVista | "nuevo" | null>(null);
  const { data, error, reload } = useApiResource(() => Promise.all([
    api.getAll<ClienteVista>("/customers"), api.getOne<Recontactos>("/customers/follow-ups"),
  ]), []);
  useReloadOnWrite(reload);
  const [clientes, avisos] = data ?? [[], { followUps: [], birthdays: [] }];
  const enFicha = vigente(clientes, detalle);
  const enForm = vigente(clientes, form);
  const dias = new Map(avisos.followUps.map((r) => [r.customer.id, r.daysWithoutPurchase]));

  const base = filtro === "PARA RECONTACTAR" ? clientes.filter((c) => dias.has(c.id))
    : filtro === "CUMPLEN HOY" ? clientes.filter((c) => avisos.birthdays.some((x) => x.id === c.id)) : clientes;
  const rows = q.trim() ? buscarClientes(base, q, base.length) : base;

  const columnas: Columna<ClienteVista>[] = [
    { key: "nombre", header: "CLIENTE", className: "font-semibold text-brand-dark whitespace-nowrap", render: (c) => c.fullName },
    { key: "telefono", header: "TELÉFONO", hideBelow: "sm", className: "font-mono text-text-secondary whitespace-nowrap", render: (c) => c.phone || "—" },
    { key: "regular", header: "TIPO", render: (c) => (c.regular ? <Tag tone="success">Regular</Tag> : <Tag>Ocasional</Tag>) },
    { key: "ultima", header: "ÚLTIMA COMPRA", className: "font-mono whitespace-nowrap", render: (c) => <>
      {c.lastPurchase ? formatDate(c.lastPurchase) : "—"}
      {dias.has(c.id) && <span className="block text-[10px] text-warning-strong">hace {dias.get(c.id)} días</span>}
    </> },
    { key: "packs", header: "PACKS", align: "right", hideBelow: "md", className: "font-mono", render: (c) => c.packs },
    { key: "total", header: "TOTAL", align: "right", hideBelow: "md", className: "font-mono whitespace-nowrap", render: (c) => money(c.total) },
    { key: "cumple", header: "CUMPLEAÑOS", hideBelow: "md", className: "font-mono", render: (c) => cumple(c.birthday) },
  ];

  return (
    <>
      <Topbar section="Venta" title="Clientes" />
      <main className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full min-w-0">
        <PageHead title="Clientes" subtitle="Regular es automático: compró en cada uno de los últimos meses. Tocá un cliente para ver su historial"
          right={<button type="button" onClick={() => setForm("nuevo")} className={btnPrimary}><UserPlus className="w-3.5 h-3.5" /> Nuevo cliente</button>} />
        <ApiErrorBanner error={error} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="CLIENTES" icon={<Users className="w-3.5 h-3.5" />} value={String(clientes.length)} foot={`${clientes.filter((c) => c.regular).length} regulares`} />
          <Stat label="PARA RECONTACTAR" icon={<PhoneCall className="w-3.5 h-3.5" />} value={String(avisos.followUps.length)} foot="sin comprar hace 30 días o más" />
          <Stat label="CUMPLEN HOY" icon={<Cake className="w-3.5 h-3.5" />} value={String(avisos.birthdays.length)}
            foot={avisos.birthdays.map((c) => c.fullName).join(", ") || "Nadie hoy"} />
        </div>

        <Card className="p-4 flex flex-col gap-3">
          <CardHead title="PADRÓN" right={<Segmented options={FILTROS} value={filtro} onChange={setFiltro} />} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" aria-label="Buscar cliente" className={inputCls} />
          <ListTable rows={rows} rowKey={(c) => c.id} columns={columnas} onRowClick={setDetalle} empty="Sin clientes con este filtro." footer={`${rows.length} clientes`} />
        </Card>
      </main>
      <AnimatePresence>{enFicha && <ClienteDetalle cliente={enFicha} onClose={() => setDetalle(null)} onEditar={() => { setForm(enFicha); setDetalle(null); }} />}</AnimatePresence>
      <AnimatePresence>{enForm && <ClienteForm cliente={enForm === "nuevo" ? null : enForm} onClose={() => setForm(null)} />}</AnimatePresence>
    </>
  );
}
