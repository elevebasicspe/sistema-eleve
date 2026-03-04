"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { canAccessDashboard, normalizeRole, type ProfileRow } from "@/lib/auth/profile";
import { supabase } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError || !data.user) {
      setIsLoading(false);
      setError("Credenciales invalidas o cuenta no verificada.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,email,role,is_approved")
      .eq("id", data.user.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      setIsLoading(false);
      setError("No se pudo leer tu perfil.");
      return;
    }

    let resolvedProfile = profile;
    if (!resolvedProfile) {
      const metadataName =
        typeof data.user.user_metadata?.full_name === "string"
          ? data.user.user_metadata.full_name.trim()
          : "";
      const safeName =
        metadataName || data.user.email?.split("@")[0] || "Usuario";
      const requestedRole = normalizeRole(data.user.user_metadata?.role);

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          full_name: safeName,
          email: data.user.email || email,
          role: requestedRole,
          is_approved: requestedRole === "owner",
          created_by_app: "OMNI AGENCIA S.A.C.",
        })
        .select("id,full_name,email,role,is_approved")
        .single<ProfileRow>();

      if (insertError) {
        const { data: fetchedAfterInsert } = await supabase
          .from("profiles")
          .select("id,full_name,email,role,is_approved")
          .eq("id", data.user.id)
          .maybeSingle<ProfileRow>();

        if (!fetchedAfterInsert) {
          setIsLoading(false);
          setError("No se pudo crear tu perfil en profiles.");
          return;
        }

        resolvedProfile = fetchedAfterInsert;
      } else {
        resolvedProfile = inserted;
      }
    }

    const role = normalizeRole(resolvedProfile.role);
    if (canAccessDashboard(role, resolvedProfile.is_approved)) {
      router.push("/dashboard");
    } else {
      router.push("/wait");
    }

    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f2e7df_0%,_#e6d3c5_34%,_#c4a793_62%,_#0a193b_100%)] px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_18px_45px_rgba(10,25,59,0.3)] sm:p-8">
        <div className="mb-2 flex justify-center">
          <Image
            src="/ELEVe-logo-transparente.svg"
            alt="ELEVE"
            width={210}
            height={75}
            priority
            className="h-auto w-[170px] sm:w-[210px]"
          />
        </div>

        <p className="mb-6 text-center text-sm text-[#7b5f4d]">Plataforma de gestion y metricas</p>

        <form className="space-y-4" onSubmit={onLogin}>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-[#0a193b]">
              Usuario
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="correo@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-[#d7b7a0]/50 px-3 py-2.5 text-sm text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:ring-2 focus:ring-[#d7b7a0]/40"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-[#0a193b]">
              Contrasena
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Escribe tu contrasena"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-[#d7b7a0]/50 px-3 py-2.5 text-sm text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:ring-2 focus:ring-[#d7b7a0]/40"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e]"
          >
            {isLoading ? "Ingresando..." : "Iniciar sesion"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3">
          <Link
            href="/cambiar-contrasena"
            className="text-xs text-[#0a193b]/80 transition hover:text-[#d7b7a0]"
          >
            Olvide mi contrasena
          </Link>
          <Link
            href="/registro"
            className="text-xs text-[#0a193b]/80 transition hover:text-[#d7b7a0]"
          >
            Crear cuenta
          </Link>
        </div>

      </section>
    </main>
  );
}
