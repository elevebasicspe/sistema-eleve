"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function CambiarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/cambiar-contrasena/update`;
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      setError(resetError.message);
      setIsLoading(false);
      return;
    }

    setMessage("Te enviamos un enlace para cambiar tu contraseña.");
    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f2e7df_0%,_#e6d3c5_34%,_#c4a793_62%,_#0a193b_100%)] px-4">
      <section className="w-full max-w-md rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_18px_45px_rgba(10,25,59,0.3)] sm:p-8">
        <h1 className="text-2xl font-bold text-[#0a193b]">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-[#0a193b]/75">
          Ingresa tu correo para enviarte el enlace de recuperación.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[#0a193b]">
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@empresa.com"
              className="w-full rounded-lg border border-[#d7b7a0]/50 px-3 py-2.5 text-sm text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:ring-2 focus:ring-[#d7b7a0]/40"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {message && <p className="text-xs text-emerald-700">{message}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-70"
          >
            {isLoading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-5 inline-block text-xs text-[#0a193b]/80 transition hover:text-[#7b5f4d]"
        >
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
