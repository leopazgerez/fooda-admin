"use client";

import { useState } from "react";
import { ApiErrorBanner, Field, FormPanel, btnPrimary, btnSecondary, inputCls, campoErr, campoMal } from "@/components/ui";
import { api } from "@/lib/api";
import type { SessionResponse } from "@/lib/api.gen";
import { PERFIL_CAMBIADO, useCurrentUser } from "@/lib/auth";
import { saveSession } from "@/lib/session";

/** Nombre y contraseña del usuario. Al cambiar la contraseña la API revoca las otras sesiones y devuelve una nueva: se guarda. */
export default function MiCuentaPanel({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const [nombre, setNombre] = useState(user.fullName);
  const [errNombre, setErrNombre] = useState<unknown>(null);
  const [busyNombre, setBusyNombre] = useState(false);
  const [pw, setPw] = useState({ actual: "", nueva: "", repetir: "" });
  const [errPw, setErrPw] = useState<unknown>(null);
  const [busyPw, setBusyPw] = useState(false);
  const distintas = !!pw.repetir && pw.nueva !== pw.repetir;

  const guardarNombre = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busyNombre) return;
    setErrNombre(null);
    setBusyNombre(true);
    try {
      await api.patch("/me", { fullName: nombre.trim() }, { silent: true, success: "Nombre actualizado." });
      window.dispatchEvent(new Event(PERFIL_CAMBIADO));
    } catch (err) {
      setErrNombre(err);
    } finally {
      setBusyNombre(false);
    }
  };

  const cambiarPw = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (busyPw || distintas) return;
    setErrPw(null);
    setBusyPw(true);
    try {
      saveSession(await api.put<SessionResponse>("/me/password", { currentPassword: pw.actual, newPassword: pw.nueva },
        { silent: true, success: "Contraseña cambiada." }));
      setPw({ actual: "", nueva: "", repetir: "" });
    } catch (err) {
      setErrPw(err);
    } finally {
      setBusyPw(false);
    }
  };

  return (
    <FormPanel title="Mi cuenta" onClose={onClose} footer={<button type="button" onClick={onClose} className={btnSecondary}>Cerrar</button>}>
      <div className="flex flex-col gap-8">
        <form noValidate onSubmit={guardarNombre} className="flex flex-col gap-3">
          <p className="text-[11px] font-bold tracking-[0.275px] text-text-label">NOMBRE</p>
          <ApiErrorBanner error={errNombre} />
          <Field label="NOMBRE Y APELLIDO" hint={user.email}>
            <input value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} autoComplete="name" className={`${inputCls} ${campoMal(errNombre, "fullName")}`} />
          </Field>
          <button type="submit" disabled={busyNombre || !nombre.trim() || nombre.trim() === user.fullName} className={`${btnPrimary} self-end`}>
            {busyNombre ? "Guardando…" : "Guardar nombre"}
          </button>
        </form>

        <form noValidate onSubmit={cambiarPw} className="flex flex-col gap-3 pt-6 border-t border-border-subtle">
          <p className="text-[11px] font-bold tracking-[0.275px] text-text-label">CONTRASEÑA</p>
          <ApiErrorBanner error={errPw} />
          <Field label="CONTRASEÑA ACTUAL">
            <input type="password" value={pw.actual} onChange={(e) => setPw({ ...pw, actual: e.target.value })} autoComplete="current-password"
              className={`${inputCls} ${campoMal(errPw, "currentPassword")}`} />
          </Field>
          <Field label="CONTRASEÑA NUEVA">
            <input type="password" value={pw.nueva} onChange={(e) => setPw({ ...pw, nueva: e.target.value })} autoComplete="new-password"
              className={`${inputCls} ${campoMal(errPw, "newPassword")}`} />
          </Field>
          <Field label="REPETIR CONTRASEÑA NUEVA" hint={distintas ? <span className="text-danger">Las contraseñas nuevas no coinciden</span> : undefined}>
            <input type="password" value={pw.repetir} onChange={(e) => setPw({ ...pw, repetir: e.target.value })} autoComplete="new-password"
              className={`${inputCls} ${distintas ? campoErr : ""}`} />
          </Field>
          <button type="submit" disabled={busyPw || !pw.actual || !pw.nueva || pw.nueva !== pw.repetir} className={`${btnPrimary} self-end`}>
            {busyPw ? "Cambiando…" : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </FormPanel>
  );
}
