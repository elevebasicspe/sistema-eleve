"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MiCuentaSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import { useProtectedSession } from "@/lib/auth/use-protected-session";
import { supabase } from "@/lib/supabase/client";

export default function MiCuentaPage() {
  const router = useRouter();
  const { loading, profile } = useProtectedSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const onSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading || !profile) return <MiCuentaSkeleton />;

  return (
    <PanelShell
      title="Mi cuenta"
      subtitle="Informacion del perfil y sesion actual."
    >
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_10px_24px_rgba(10,25,59,0.15)]">
          <h2 className="text-xl font-semibold text-[#0a193b]">Datos del usuario</h2>
          <dl className="mt-4 space-y-3 text-sm text-[#0a193b]/85">
            <div>
              <dt className="font-medium text-[#0a193b]/65">Nombre</dt>
              <dd className="mt-0.5">{profile.full_name}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#0a193b]/65">Correo</dt>
              <dd className="mt-0.5">{profile.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#0a193b]/65">Rol</dt>
              <dd className="mt-0.5 uppercase tracking-wide">{profile.role}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#0a193b]/65">Aprobacion</dt>
              <dd className="mt-0.5">
                {profile.is_approved ? "Aprobado" : "Pendiente"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_10px_24px_rgba(10,25,59,0.15)]">
          <h2 className="text-xl font-semibold text-[#0a193b]">Sesion</h2>
          <p className="mt-3 text-sm text-[#0a193b]/75">
            Cierra sesion de forma segura en este dispositivo.
          </p>
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="mt-6 rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
          >
            {isSigningOut ? "Cerrando..." : "Cerrar sesion"}
          </button>
        </article>
      </section>
    </PanelShell>
  );
}
