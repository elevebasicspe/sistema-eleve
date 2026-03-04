"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { canAccessDashboard, normalizeRole, type ProfileRow } from "@/lib/auth/profile";
import { supabase } from "@/lib/supabase/client";

export function VerifyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verificando tu cuenta...");

  const callbackData = useMemo(
    () => ({
      code: searchParams.get("code"),
      tokenHash: searchParams.get("token_hash"),
      type: searchParams.get("type") as EmailOtpType | null,
    }),
    [searchParams]
  );

  useEffect(() => {
    let cancelled = false;

    const runVerification = async () => {
      try {
        if (callbackData.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(callbackData.code);
          if (error) throw error;
        } else if (callbackData.tokenHash && callbackData.type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: callbackData.tokenHash,
            type: callbackData.type,
          });
          if (error) throw error;
        }

        const { data: authData, error: userError } = await supabase.auth.getUser();
        if (userError || !authData.user) {
          throw new Error("No se pudo obtener el usuario verificado.");
        }

        const user = authData.user;
        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : "";
        const metadataRole = normalizeRole(user.user_metadata?.role);

        const { data: existingProfile, error: profileError } = await supabase
          .from("profiles")
          .select("id,full_name,email,role,is_approved")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>();

        if (profileError) throw profileError;

        let role = metadataRole;
        let isApproved = false;

        if (existingProfile) {
          role = normalizeRole(existingProfile.role);
          isApproved = existingProfile.is_approved;

          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              full_name: existingProfile.full_name || metadataName,
              email: existingProfile.email || user.email || "",
            })
            .eq("id", user.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from("profiles").insert({
            id: user.id,
            full_name: metadataName || "Sin nombre",
            email: user.email || "",
            role,
            is_approved: role === "owner",
          });

          if (insertError) throw insertError;
          isApproved = role === "owner";
        }

        if (cancelled) return;

        if (canAccessDashboard(role, isApproved)) {
          setMessage("Cuenta verificada. Redirigiendo al dashboard...");
          router.replace("/dashboard");
          return;
        }

        setMessage("Cuenta verificada. Pendiente de aprobacion del owner...");
        router.replace("/wait");
      } catch (error) {
        if (cancelled) return;
        setMessage(
          error instanceof Error
            ? `No se pudo verificar la cuenta: ${error.message}`
            : "No se pudo verificar la cuenta."
        );
      }
    };

    runVerification();

    return () => {
      cancelled = true;
    };
  }, [callbackData, router]);

  return (
    <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 text-center shadow-[0_18px_45px_rgba(10,25,59,0.3)] sm:p-8">
      <h1 className="text-2xl font-bold text-[#0a193b]">Verificando cuenta</h1>
      <p className="mt-3 text-sm text-[#0a193b]/80">{message}</p>
    </section>
  );
}
