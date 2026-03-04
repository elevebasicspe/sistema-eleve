"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { canAccessDashboard, normalizeRole, type ProfileRow } from "@/lib/auth/profile";
import { supabase } from "@/lib/supabase/client";

export default function WaitPage() {
  const router = useRouter();
  const [statusText, setStatusText] = useState(
    "Revisando estado de aprobacion..."
  );

  useEffect(() => {
    let cancelled = false;

    const checkStatus = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id,role,is_approved")
        .eq("id", user.id)
        .maybeSingle<Pick<ProfileRow, "id" | "role" | "is_approved">>();

      if (!profile) {
        if (!cancelled) {
          setStatusText("Tu perfil aun no esta listo. Intenta nuevamente en unos segundos.");
        }
        return;
      }

      const role = normalizeRole(profile.role);
      if (canAccessDashboard(role, profile.is_approved)) {
        router.replace("/dashboard");
        return;
      }

      if (!cancelled) {
        setStatusText("Tu cuenta sigue pendiente de aprobacion del owner o admin.");
      }
    };

    checkStatus();
    const timer = setInterval(checkStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f2e7df_0%,_#e6d3c5_34%,_#c4a793_62%,_#0a193b_100%)] px-4">
      <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 text-center shadow-[0_18px_45px_rgba(10,25,59,0.3)] sm:p-8">
        <h1 className="text-2xl font-bold text-[#0a193b]">
          Cuenta pendiente de aprobacion
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#0a193b]/80">
          Tu correo ya fue verificado, pero todavia necesitas aprobacion manual
          para ingresar al dashboard.
        </p>
        <p className="mt-2 text-xs text-[#0a193b]/65">{statusText}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e]"
        >
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
