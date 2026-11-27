"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputCls } from "./Erp";

/** Input de contraseña con el ojo para mostrarla u ocultarla. */
export default function CampoPassword({ className = "", ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [ver, setVer] = useState(false);
  const texto = ver ? "Ocultar contraseña" : "Mostrar contraseña";
  return (
    <div className="relative">
      <input {...props} type={ver ? "text" : "password"} className={`${inputCls} pr-8 ${className}`} />
      <button type="button" onClick={() => setVer((v) => !v)} aria-label={texto} aria-pressed={ver} title={texto}
        className="absolute inset-y-0 right-0 px-2.5 text-text-muted hover:text-text-primary cursor-pointer">
        {ver ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
