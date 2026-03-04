"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { normalizeRole, type AppRole } from "@/lib/auth/profile";

const ROLE_OPTIONS: { label: string; value: AppRole }[] = [
  { label: "Admin", value: "admin" },
  { label: "Vendedor", value: "vendedor" },
  { label: "Contador", value: "contador" },
];

export default function RegistroPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("admin");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/verify`;
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const normalizedRole = normalizeRole(role);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName.trim(),
          role: normalizedRole,
          created_by: "OMNI AGENCIA S.A.C.",
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    setSuccess("Cuenta creada. Revisa tu correo para verificar tu acceso.");
    setIsLoading(false);
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("admin");
  };

  return (
    <main className="min-h-screen bg-white text-[#0a193b] lg:grid lg:grid-cols-2">
      <section className="order-1 flex min-h-screen items-center bg-white px-5 py-8 sm:px-8 lg:order-2 lg:px-14">
        <div className="mx-auto w-full max-w-md lg:max-w-xl">
          <div className="mb-5 flex justify-center lg:hidden">
            <Image
              src="/ELEVe-logo-transparente.svg"
              alt="ELEVE"
              width={190}
              height={70}
              className="h-auto w-[170px]"
              priority
            />
          </div>

          <h2 className="text-center text-4xl font-bold tracking-tight text-[#0a193b] sm:text-5xl lg:text-6xl">
            Crea tu cuenta
          </h2>
          <p className="mt-3 text-center text-sm text-[#0a193b]/70 sm:text-base">
            Completa tus datos para continuar.
          </p>

          <form className="mt-8 space-y-4 sm:mt-10 sm:space-y-5" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0a193b]" htmlFor="fullName">
                Nombre
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="Tu nombre completo"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="w-full rounded-lg border border-[#d7b7a0]/55 px-3 py-3 text-base text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:ring-2 focus:ring-[#d7b7a0]/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0a193b]" htmlFor="email">
                Correo
              </label>
              <input
                id="email"
                type="email"
                placeholder="correo@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-[#d7b7a0]/55 px-3 py-3 text-base text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:ring-2 focus:ring-[#d7b7a0]/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0a193b]" htmlFor="role">
                Rol
              </label>
              <select
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value as AppRole)}
                className="w-full rounded-lg border border-[#d7b7a0]/55 bg-white px-3 py-3 text-base text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:ring-2 focus:ring-[#d7b7a0]/40"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0a193b]" htmlFor="password">
                Contrasena
              </label>
              <input
                id="password"
                type="password"
                placeholder="Crea una contrasena"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-[#d7b7a0]/55 px-3 py-3 text-base text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:ring-2 focus:ring-[#d7b7a0]/40"
              />
              <p className="text-xs text-[#0a193b]/55">Minimo 8 caracteres.</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-700">{success}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[#0a193b] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-70"
            >
              {isLoading ? "Creando..." : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#0a193b]/75 sm:mt-7 sm:text-base">
            Ya tienes una cuenta?{" "}
            <Link href="/" className="font-semibold text-[#0a193b] hover:text-[#7b5f4d]">
              Inicia sesion
            </Link>
          </p>
        </div>
      </section>

      <section className="hidden bg-[#0a193b] px-10 py-10 text-white lg:order-1 lg:flex lg:min-h-screen lg:items-center lg:px-14">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-9 w-[250px]">
            <Image
              src="/ELEVe-logo-transparente.svg"
              alt="ELEVE"
              width={250}
              height={90}
              className="h-auto w-full brightness-0 invert"
              priority
            />
          </div>

          <p className="max-w-lg text-2xl leading-10 text-white/95">
            Gestiona inventario, productos, clientes, ventas y gastos en una sola
            plataforma.
          </p>

          <ul className="mt-11 space-y-6 text-lg leading-8 text-white/92">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v20M2 12h20" />
                </svg>
              </span>
              <span>Registro centralizado por correo y rol de trabajo.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 12h4l2-4 4 8 2-4h6" />
                </svg>
              </span>
              <span>Flujo de verificacion de correo para activar acceso.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 11V7a7 7 0 0 1 14 0v4" />
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                </svg>
              </span>
              <span>Aprobacion manual para usuarios no owner.</span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
