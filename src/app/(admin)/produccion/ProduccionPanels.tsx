"use client";

import { useState } from "react";
import { ApiErrorBanner, ConfirmModal, Field, FormPanel, btnPrimary, btnSecondary, inputCls, tdCls, thCls } from "@/components/ui";
import { api } from "@/lib/api";
import type { BranchResponse as SedeOpcion, DetailResponse, PackResponse as PackVista, ProductionResponse as ProduccionResumen, RecipeBookResponse as RecetarioPack, ShoppingGroupResponse, SupplyResponse } from "@/lib/api.gen";
import { toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { insumosSobrantes, mapaSobrantes } from "@/lib/sobrantes";
import { useApiResource, useGuardar, useOptions } from "@/lib/useApi";

const num = `${inputCls} font-mono w-24 text-right`;

/** Planificar: solo cantidades por pack. El costo lo calcula el sistema con recetas y precios vigentes y queda congelado. */
export function NuevaProduccionPanel({ packs, onClose }: { packs: PackVista[]; onClose: () => void }) {
  const activos = packs.filter((p) => p.active);
  const [cant, setCant] = useState<Record<number, number>>({});
  const [inicio, setInicio] = useState(toLocalISODate());
  const { busy, error, run } = useGuardar(onClose);
  const total = activos.reduce((a, p) => a + (cant[p.id] ?? 0) * (p.cost?.total ?? 0), 0);
  const packsTotal = activos.reduce((a, p) => a + (cant[p.id] ?? 0), 0);

  return (
    <FormPanel title="Nueva producción" size="lg" onClose={onClose} footer={<>
      <div className="mr-auto max-md:basis-full font-mono">
        <p className="text-sm"><span className="text-[11px] font-bold text-text-label">COSTO ESTIMADO: </span>
          <span className="font-bold text-text-primary">{money(Math.round(total))}</span></p>
        <p className="text-[10px] text-text-secondary">{packsTotal} packs · con indirecto de referencia</p>
      </div>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="produccion-form" disabled={busy || !packsTotal} className={btnPrimary}>{busy ? "Guardando…" : "Planificar"}</button>
    </>}>
      <form id="produccion-form" noValidate className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        run(() => api.post<ProduccionResumen>("/productions",
          { start: inicio, lines: activos.map((p) => ({ packId: p.id, planned: cant[p.id] ?? 0 })) },
          { silent: true, success: "Producción planificada. Ya tenés las listas de compra por proveedor en Compras." }));
      }}>
        <ApiErrorBanner error={error} />
        <Field label="FECHA DE INICIO"><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={inputCls} /></Field>
        <table className="w-full">
          <thead><tr className="border-b border-border-subtle">
            <th className={thCls}>PACK</th><th className={`${thCls} text-right`}>COSTO / PACK</th>
            <th className={`${thCls} text-right`}>CANTIDAD</th><th className={`${thCls} text-right max-sm:hidden`}>SUBTOTAL</th>
          </tr></thead>
          <tbody className="divide-y divide-border-faint">
            {activos.map((p) => (
              <tr key={p.id}>
                <td className={tdCls}>{p.name}</td>
                <td className={`${tdCls} font-mono text-right`}>{money(Math.round(p.cost?.total ?? 0))}</td>
                <td className={`${tdCls} text-right`}>
                  <input type="number" min={0} value={cant[p.id] ?? 0} aria-label={`Cantidad ${p.name}`}
                    onChange={(e) => setCant({ ...cant, [p.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={num} />
                </td>
                <td className={`${tdCls} font-mono text-right max-sm:hidden`}>{money(Math.round((cant[p.id] ?? 0) * (p.cost?.total ?? 0)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </form>
    </FormPanel>
  );
}

/** Cerrar: packs que salieron de verdad y cuántos se mandan a cada sede (el resto queda en la cocina). */
export function CerrarProduccionPanel({ produccion, sedes, onClose }: { produccion: ProduccionResumen; sedes: SedeOpcion[]; onClose: () => void }) {
  const destinos = sedes.filter((s) => !s.kitchen);
  const [real, setReal] = useState<Record<number, number>>(Object.fromEntries(produccion.packLines.map((p) => [p.packId, p.planned])));
  const [reparto, setReparto] = useState<Record<string, number>>({});
  const [fecha, setFecha] = useState(toLocalISODate());
  const { busy, error, run } = useGuardar(onClose);
  const [confirmar, setConfirmar] = useState(false);
  const entero = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const cerrar = () => run(() => api.post(`/productions/${produccion.id}/close`, {
    date: fecha,
    lines: produccion.packLines.map((p) => ({ packId: p.packId, actual: real[p.packId] ?? 0 })),
    distribution: Object.entries(reparto).filter(([, c]) => c > 0).map(([k, quantity]) => {
      const [branchId, packId] = k.split("|").map(Number);
      return { branchId, packId, quantity };
    }),
  }, { silent: true, success: `Producción ${produccion.code} cerrada: el stock ya está en las sedes.` }));

  // el popup va como hermano del panel: dentro de un ancestro animado (transform) quedaría recortado
  return (<>
    <FormPanel title={`Cerrar producción ${produccion.code}`} size="lg" onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="cerrar-form" disabled={busy} className={btnPrimary}>{busy ? "Guardando…" : "Cerrar producción"}</button>
    </>}>
      <form id="cerrar-form" noValidate className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        setConfirmar(true);
      }}>
        <ApiErrorBanner error={error} />
        <Field label="FECHA DE CIERRE"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></Field>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead><tr className="border-b border-border-subtle">
              <th className={thCls}>PACK</th><th className={`${thCls} text-right`}>PLANIF.</th><th className={`${thCls} text-right`}>SALIERON</th>
              {destinos.map((s) => <th key={s.id} className={`${thCls} text-right`}>A {s.name.toUpperCase()}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-border-faint">
              {produccion.packLines.map((p) => (
                <tr key={p.packId}>
                  <td className={tdCls}>{p.name}</td>
                  <td className={`${tdCls} font-mono text-right text-text-secondary`}>{p.planned}</td>
                  <td className={`${tdCls} text-right`}>
                    <input type="number" min={0} value={real[p.packId] ?? 0} aria-label={`Salieron ${p.name}`}
                      onChange={(e) => setReal({ ...real, [p.packId]: entero(e.target.value) })} className={num} />
                  </td>
                  {destinos.map((s) => (
                    <td key={s.id} className={`${tdCls} text-right`}>
                      <input type="number" min={0} value={reparto[`${s.id}|${p.packId}`] ?? 0} aria-label={`${p.name} a ${s.name}`}
                        onChange={(e) => setReparto({ ...reparto, [`${s.id}|${p.packId}`]: entero(e.target.value) })} className={num} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </FormPanel>
    <ConfirmModal tone="neutral" isOpen={confirmar} onClose={() => setConfirmar(false)} onConfirm={cerrar}
      title={`¿Cerrar producción ${produccion.code}?`} confirmLabel="Cerrar producción"
      description="Los packs que salieron pasan al stock de las sedes según el reparto. No se puede deshacer." />
  </>);
}

const cantidad = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: n < 10 ? 1 : 0 });

/** Recetario para cocinar el lote: ingredientes de cada menú ya multiplicados por los packs planificados. Solo lectura. */
export function RecetarioPanel({ produccion, onClose }: { produccion: ProduccionResumen; onClose: () => void }) {
  const { data, error } = useApiResource(() => api.getOne<RecetarioPack[]>(`/productions/${produccion.id}/recipe-book`), [produccion.id]);
  const nombre = (packId: number) => produccion.packLines.find((d) => d.packId === packId)?.name ?? `Pack ${packId}`;
  return (
    <FormPanel title={`Recetario · ${produccion.code}`} size="lg" onClose={onClose}
      footer={<button type="button" onClick={onClose} className={btnSecondary}>Cerrar</button>}>
      <div className="flex flex-col gap-6">
        <ApiErrorBanner error={error} />
        {!data && !error && <p className="text-xs text-text-muted">Cargando…</p>}
        {data?.map((r) => (
          <section key={r.packId} className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-text-primary">{nombre(r.packId)} <span className="font-mono font-normal text-text-secondary">· {r.quantity} packs</span></h3>
            {r.menus.map((m) => (
              <div key={m.number} className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-brand-dark"><span className="font-mono text-text-muted">N° {m.number}</span> {m.dish}</p>
                {m.sharedWith && <p className="text-[11px] text-info">También va en {m.sharedWith.name} ({m.sharedWith.quantity} packs): cociná {m.combinedTotal} porciones juntas.</p>}
                <table className="w-full">
                  <tbody className="divide-y divide-border-faint">
                    {m.ingredients.map((i) => (
                      <tr key={i.name}>
                        <td className={`${tdCls} py-1`}>{i.name}</td>
                        <td className={`${tdCls} py-1 text-right font-mono whitespace-nowrap`}>{cantidad(i.quantity)} {i.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        ))}
        <p className="text-[11px] text-text-secondary">Cantidades con las recetas congeladas al planificar, multiplicadas por los packs planificados.</p>
      </div>
    </FormPanel>
  );
}

/** Sobrantes de la producción anterior: la lista de súper los descuenta. La API reemplaza el mapa entero: se manda completo. */
export function SobrantesPanel({ produccion, onClose }: { produccion: ProduccionResumen; onClose: () => void }) {
  const id = produccion.id;
  const { data, error: errorCarga } = useApiResource(() => Promise.all([
    api.getOne<DetailResponse>(`/productions/${id}`),
    api.getOne<ShoppingGroupResponse[]>(`/productions/${id}/shopping-list`),
  ]), [id]);
  const { options: insumos } = useOptions<SupplyResponse>("/supplies");
  const [editados, setEditados] = useState<Record<number, string>>({});
  const { busy, error, run } = useGuardar(onClose);
  const [detalle, lista] = data ?? [null, []];
  const actuales = detalle?.leftovers ?? {};
  const filas = insumosSobrantes(lista, actuales, insumos);
  const valor = (supplyId: number) => editados[supplyId] ?? (actuales[supplyId] ? String(actuales[supplyId]) : "");
  const guardar = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!detalle) return;
    run(() => api.patch(`/productions/${id}/leftovers`, { leftovers: mapaSobrantes(actuales, editados), version: detalle.version },
      { silent: true, success: "Sobrantes guardados. La lista de súper ya los descuenta." }));
  };
  return (
    <FormPanel title={`Sobrantes · ${produccion.code}`} onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
      <button type="submit" form="sobrantes-form" disabled={busy || !detalle} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
    </>}>
      <form id="sobrantes-form" noValidate onSubmit={guardar} className="flex flex-col gap-3">
        <p className="text-xs text-text-secondary">Lo que te sobró de la producción anterior. La lista de súper descuenta estas cantidades.</p>
        <ApiErrorBanner error={errorCarga ?? error} />
        {!data && !errorCarga && <p className="text-xs text-text-muted">Cargando…</p>}
        {data && !filas.length && <p className="text-xs text-text-muted">Esta producción no tiene insumos para comprar.</p>}
        {filas.map((f) => (
          <label key={f.supplyId} className="grid grid-cols-[minmax(0,1fr)_7rem_2.5rem] items-center gap-2 text-xs">
            <span className="text-text-body truncate">{f.nombre}</span>
            <input type="number" min={0} inputMode="decimal" value={valor(f.supplyId)} placeholder="0" aria-label={`Sobrante de ${f.nombre}`}
              onChange={(e) => setEditados({ ...editados, [f.supplyId]: e.target.value })} className={`${inputCls} font-mono text-right`} />
            <span className="text-text-muted font-mono">{f.unit}</span>
          </label>
        ))}
      </form>
    </FormPanel>
  );
}
