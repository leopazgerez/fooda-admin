"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { app } from "@/config/app";
import { getAssetPath } from "@/lib/assets";
import { ApiError } from "@/lib/api";
import { login } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { ApiErrorBanner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (getSession()) router.replace("/dashboard");
  }, [router]);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-app-bg">
      {/* Left Panel - Brand Showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-sidebar-bg text-sidebar-text-active p-12 flex-col justify-between overflow-hidden">
        {/* Manchas de color, como los trazos de crayón del logo */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent/30 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-info-line/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-warning-line/25 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center shadow-lg p-0.5 border border-sidebar-hover overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getAssetPath("/fooda-logo.png")}
              alt={app.name}
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <span className="font-heading font-bold text-lg tracking-tight text-sidebar-text-active">
            {app.name}
          </span>
        </div>

        {/* Value Prop */}
        <div className="relative z-10 flex flex-col gap-4 max-w-md">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">
            {app.login.kicker}
          </span>
          <h2 className="font-heading font-extrabold text-4xl text-sidebar-text-active leading-tight">
            {app.login.headline}
          </h2>
          <p className="text-sm text-sidebar-text leading-relaxed">
            {app.login.text}
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-text-muted">
          © {new Date().getFullYear()} {app.name}
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-surface rounded-2xl border border-border-subtle p-8 shadow-xs flex flex-col gap-6">
          {/* Mobile Brand Logo */}
          <div className="lg:hidden flex items-center gap-3 pb-2 border-b border-app-bg">
            <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shadow-2xs p-0.5 border border-border-subtle overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAssetPath("/fooda-logo.png")}
                alt={app.name}
                className="w-full h-full object-contain rounded-md"
              />
            </div>
            <span className="font-heading font-bold text-base text-text-primary">
              {app.name}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="font-heading font-bold text-2xl text-text-primary tracking-tight">
              Bienvenido de nuevo
            </h3>
            <p className="text-xs text-text-secondary">
              Ingresá tus credenciales para acceder al panel
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
            {/* Email */}
            <div>
              <label className="font-medium text-text-primary block mb-1">
                Correo electrónico
              </label>
              <div className="flex items-center gap-2 bg-surface-alt border border-border-subtle rounded-xl px-3.5 py-2.5 transition-all focus-within:border-accent focus-within:bg-surface">
                <Mail className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={app.login.emailPlaceholder}
                  className="bg-transparent border-none outline-none w-full text-xs text-text-primary"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="font-medium text-text-primary block mb-1">
                Contraseña
              </label>
              <div className="flex items-center gap-2 bg-surface-alt border border-border-subtle rounded-xl px-3.5 py-2.5 transition-all focus-within:border-accent focus-within:bg-surface">
                <Lock className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-none outline-none w-full text-xs text-text-primary"
                />
              </div>
            </div>

            {error != null && (
              error instanceof ApiError && error.status === 401 ? (
                <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
                  Email o contraseña incorrectos
                </div>
              ) : (
                <ApiErrorBanner error={error} />
              )
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex disabled:opacity-60 disabled:cursor-not-allowed items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-semibold text-xs hover:bg-accent-dark transition-all shadow-xs cursor-pointer"
            >
              <span>Ingresar al panel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
