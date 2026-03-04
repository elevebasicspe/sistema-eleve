"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { canAccessDashboard, normalizeRole, type AppRole, type ProfileRow } from "@/lib/auth/profile";
import { supabase } from "@/lib/supabase/client";

export type ProtectedProfile = ProfileRow & { role: AppRole };

type ProtectedSessionState = {
  loading: boolean;
  profile: ProtectedProfile | null;
  accessToken: string | null;
};

export function useProtectedSession() {
  const router = useRouter();
  const [state, setState] = useState<ProtectedSessionState>({
    loading: true,
    profile: null,
    accessToken: null,
  });

  const loadSession = useCallback(async () => {
    const [{ data: authData }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);

    const user = authData.user;
    const token = sessionData.session?.access_token ?? null;

    if (!user || !token) {
      router.replace("/");
      return;
    }

    const primary = await supabase
      .from("profiles")
      .select("id,full_name,email,role,is_approved,avatar_url")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    const fallback =
      primary.error && primary.error.message.toLowerCase().includes("avatar_url")
        ? await supabase
            .from("profiles")
            .select("id,full_name,email,role,is_approved")
            .eq("id", user.id)
            .maybeSingle<ProfileRow>()
        : null;

    const profile = fallback?.data ?? primary.data;

    if (!profile) {
      router.replace("/wait");
      return;
    }

    const role = normalizeRole(profile.role);
    if (!canAccessDashboard(role, profile.is_approved)) {
      router.replace("/wait");
      return;
    }

    setState({
      loading: false,
      profile: { ...profile, role },
      accessToken: token,
    });
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadSession]);

  return {
    ...state,
    isManager: state.profile?.role === "owner" || state.profile?.role === "admin",
    refresh: loadSession,
  };
}
