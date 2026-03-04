"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function CambiarContrasenaUpdatePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
      return;
    }

    router.push("/");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f2e7df_0%,_#e6d3c5_34%,_#c4a793_62%,_#0a193b_100%)] px-4">
      <section className="w-full max-w-md rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_18px_45px_rgba(10,25,59,0.3)] sm:p-8">
        <h1 className="text-2xl font-bold text-[#0a193b]">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-[#0a193b]/75">
          Define una nueva contraseña para tu cuenta.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[#0a193b]">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-lg border border-[#d7b7a0]/50 px-3 py-2.5 text-sm text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:ring-2 focus:ring-[#d7b7a0]/40"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-70"
          >
            {isLoading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}
