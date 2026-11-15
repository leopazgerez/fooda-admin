"use client";

import { useState } from "react";
import { ApiErrorBanner, ConfirmModal, Field, FormPanel, btnPrimary, btnSecondary, inputCls, tdCls, thCls } from "@/components/ui";
import { api } from "@/lib/api";
import type { PackVista, ProduccionResumen, RecetarioPack, SedeOpcion } from "@/lib/apiTypes";
import { toLocalISODate } from "@/lib/dateUtils";
import { money } from "@/lib/format";
import { useApiResource } from "@/lib/useApi";

const num = `${inputCls} font-mono w-24 text-right`;

function useGuardar(onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** Planificar: solo cantidades por pack. El costo lo calcula el sistema con recetas y precios vigentes y queda congelado. */
export function NuevaProduccionPanel({ packs, onClose }: { packs: PackVista[]; onClose: () => void }) {
  const activos = packs.filter((p) => p.activo);
  const [cant, setCant] = useState<Record<number, number>>({});
  const [inicio, setInicio] = useState(toLocalISODate());
  const { busy, error, run } = useGuardar(onClose);
  const total = activos.reduce((a, p) => a + (cant[p.id] ?? 0) * (p.costo?.total ?? 0), 0);
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
        run(() => api.post<ProduccionResumen>("/producciones",
          { inicio, lineas: activos.map((p) => ({ packId: p.id, planificada: cant[p.id] ?? 0 })) },
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
                <td className={tdCls}>{p.nombre}</td>
                <td className={`${tdCls} font-mono text-right`}>{money(Math.round(p.costo?.total ?? 0))}</td>
                <td className={`${tdCls} text-right`}>
                  <input type="number" min={0} value={cant[p.id] ?? 0} aria-label={`Cantidad ${p.nombre}`}
                    onChange={(e) => setCant({ ...cant, [p.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={num} />
                </td>
                <td className={`${tdCls} font-mono text-right max-sm:hidden`}>{money(Math.round((cant[p.id] ?? 0) * (p.costo?.total ?? 0)))}</td>
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
  const destinos = sedes.filter((s) => !s.esCocina);
  const [real, setReal] = useState<Record<number, number>>(Object.fromEntries(produccion.detallePacks.map((p) => [p.packId, p.planificada])));
  const [reparto, setReparto] = useState<Record<string, number>>({});
  const [fecha, setFecha] = useState(toLocalISODate());
  const { busy, error, run } = useGuardar(onClose);
  const [confirmar, setConfirmar] = useState(false);
  const entero = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const cerrar = () => run(() => api.post(`/producciones/${produccion.id}/cerrar`, {
    fecha,
    lineas: produccion.detallePacks.map((p) => ({ packId: p.packId, real: real[p.packId] ?? 0 })),
    reparto: Object.entries(reparto).filter(([, c]) => c > 0).map(([k, cantidad]) => {
      const [sedeId, packId] = k.split("|").map(Number);
      return { sedeId, packId, cantidad };
    }),
  }, { silent: true, success: `Producción ${produccion.codigo} cerrada: el stock ya está en las sedes.` }));

  // el popup va como hermano del panel: dentro de un ancestro animado (transform) quedaría recortado
  return (<>
    <FormPanel title={`Cerrar producción ${produccion.codigo}`} size="lg" onClose={onClose} footer={<>
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
              {destinos.map((s) => <th key={s.id} className={`${thCls} text-right`}>A {s.nombre.toUpperCase()}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-border-faint">
              {produccion.detallePacks.map((p) => (
                <tr key={p.packId}>
                  <td className={tdCls}>{p.nombre}</td>
                  <td className={`${tdCls} font-mono text-right text-text-secondary`}>{p.planificada}</td>
                  <td className={`${tdCls} text-right`}>
                    <input type="number" min={0} value={real[p.packId] ?? 0} aria-label={`Salieron ${p.nombre}`}
                      onChange={(e) => setReal({ ...real, [p.packId]: entero(e.target.value) })} className={num} />
                  </td>
                  {destinos.map((s) => (
                    <td key={s.id} className={`${tdCls} text-right`}>
                      <input type="number" min={0} value={reparto[`${s.id}|${p.packId}`] ?? 0} aria-label={`${p.nombre} a ${s.nombre}`}
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
      title={`¿Cerrar producción ${produccion.codigo}?`} confirmLabel="Cerrar producción"
      description="Los packs que salieron pasan al stock de las sedes según el reparto. No se puede deshacer." />
  </>);
}

const cantidad = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: n < 10 ? 1 : 0 });

/** Recetario para cocinar el lote: ingredientes de cada menú ya multiplicados por los packs planificados. Solo lectura. */
export function RecetarioPanel({ produccion, onClose }: { produccion: ProduccionResumen; onClose: () => void }) {
  const { data, error } = useApiResource(() => api.getOne<RecetarioPack[]>(`/producciones/${produccion.id}/recetario`), [produccion.id]);
  const nombre = (packId: number) => produccion.detallePacks.find((d) => d.packId === packId)?.nombre ?? `Pack ${packId}`;
  return (
    <FormPanel title={`Recetario · ${produccion.codigo}`} size="lg" onClose={onClose}
      footer={<button type="button" onClick={onClose} className={btnSecondary}>Cerrar</button>}>
      <div className="flex flex-col gap-6">
        <ApiErrorBanner error={error} />
        {!data && !error && <p className="text-xs text-text-muted">Cargando…</p>}
        {data?.map((r) => (
          <section key={r.packId} className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-text-primary">{nombre(r.packId)} <span className="font-mono font-normal text-text-secondary">· {r.cantidad} packs</span></h3>
            {r.menus.map((m) => (
              <div key={m.numero} className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-brand-dark"><span className="font-mono text-text-muted">N° {m.numero}</span> {m.plato}</p>
                {m.compartidoCon && <p className="text-[11px] text-info">También va en {m.compartidoCon.nombre} ({m.compartidoCon.cantidad} packs): cociná {m.totalCombinado} porciones juntas.</p>}
                <table className="w-full">
                  <tbody className="divide-y divide-border-faint">
                    {m.ingredientes.map((i) => (
                      <tr key={i.nombre}>
                        <td className={`${tdCls} py-1`}>{i.nombre}</td>
                        <td className={`${tdCls} py-1 text-right font-mono whitespace-nowrap`}>{cantidad(i.cantidad)} {i.unidad}</td>
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
