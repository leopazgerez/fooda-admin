"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { CustomerResponse as ClienteOpcion } from "@/lib/api.gen";
import { buscarClientes } from "@/lib/buscar";

/** Busca un cliente por nombre, apellido o teléfono; si no existe, lo crea ahí mismo. Sin cliente también es válido. */
export default function ClientePicker({ clientes, value, onChange }: {
  clientes: ClienteOpcion[]; value: number | null; onChange: (id: number | null, nuevo?: ClienteOpcion) => void;
}) {
  const [texto, setTexto] = useState("");
  const [nuevo, setNuevo] = useState<{ nombre: string; apellido: string; telefono: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const elegido = clientes.find((c) => c.id === value);

  if (elegido) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 border border-border-subtle rounded-xs bg-surface-alt text-sm">
        <span className="truncate text-text-primary">{elegido.fullName}{elegido.phone && <span className="ml-2 text-xs text-text-muted font-mono">{elegido.phone}</span>}</span>
        <button type="button" aria-label="Quitar cliente" onClick={() => onChange(null)} className="text-text-muted hover:text-text-primary cursor-pointer"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  const crear = async () => {
    if (!nuevo || busy) return;
    setError(null);
    setBusy(true);
    try {
      const c = await api.post<ClienteOpcion>("/customers", {
        firstName: nuevo.nombre.trim(), lastName: nuevo.apellido.trim(), ...(nuevo.telefono.trim() ? { phone: nuevo.telefono.trim() } : {}),
      }, { silent: true });
      setNuevo(null);
      setTexto("");
      onChange(c.id, c);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo crear el cliente");
    } finally {
      setBusy(false);
    }
  };

  if (nuevo) {
    const set = (k: keyof typeof nuevo) => (e: React.ChangeEvent<HTMLInputElement>) => setNuevo({ ...nuevo, [k]: e.target.value });
    return (
      <div className="flex flex-col gap-2 p-3 border border-border-subtle rounded-xs bg-surface-alt">
        <p className="text-[11px] font-bold text-text-label">NUEVO CLIENTE</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={nuevo.nombre} onChange={set("nombre")} placeholder="Nombre" aria-label="Nombre" className={inputCls} />
          <input value={nuevo.apellido} onChange={set("apellido")} placeholder="Apellido" aria-label="Apellido" className={inputCls} />
        </div>
        <input value={nuevo.telefono} onChange={set("telefono")} placeholder="Teléfono (opcional)" aria-label="Teléfono" type="tel" className={`${inputCls} font-mono`} />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setNuevo(null)} className={`${btnSecondary} py-1 text-[11px]`}>Cancelar</button>
          <button type="button" onClick={crear} disabled={busy || !nuevo.nombre.trim() || !nuevo.apellido.trim()} className={`${btnPrimary} py-1 text-[11px]`}>
            {busy ? "Creando…" : "Crear y usar"}
          </button>
        </div>
      </div>
    );
  }

  const resultados = buscarClientes(clientes, texto);
  return (
    <div className="flex flex-col gap-1">
      <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nombre o teléfono (opcional)"
        aria-label="Buscar cliente" className={inputCls} />
      {texto.trim() && (
        <ul className="border border-border-subtle rounded-xs divide-y divide-border-faint bg-surface">
          {resultados.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { onChange(c.id); setTexto(""); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-alt cursor-pointer flex justify-between gap-2">
                <span className="truncate">{c.fullName}</span>
                {c.phone && <span className="text-xs text-text-muted font-mono shrink-0">{c.phone}</span>}
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => {
              const [nombre, ...resto] = texto.trim().split(/\s+/);
              setNuevo({ nombre: /\d/.test(nombre) ? "" : nombre, apellido: resto.join(" "), telefono: /\d/.test(texto) ? texto.trim() : "" });
            }} className="w-full text-left px-3 py-2 text-sm text-brand-dark font-semibold hover:bg-surface-alt cursor-pointer flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Nuevo cliente «{texto.trim()}»
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
