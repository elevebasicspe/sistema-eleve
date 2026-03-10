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

let protectedSessionCache: ProtectedSessionState | null = null;

export function useProtectedSession() {
  const router = useRouter();
  const [state, setState] = useState<ProtectedSessionState>(
    () =>
      protectedSessionCache ?? {
        loading: true,
        profile: null,
        accessToken: null,
      }
  );

  const loadSession = useCallback(async (force = false) => {
    if (!force && protectedSessionCache?.profile && protectedSessionCache.accessToken) {
      setState(protectedSessionCache);
      return;
    }

    setState((current) => ({ ...current, loading: true }));

    const [{ data: authData }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);

    const user = authData.user;
    const token = sessionData.session?.access_token ?? null;

    if (!user || !token) {
      protectedSessionCache = null;
      setState({ loading: false, profile: null, accessToken: null });
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
      protectedSessionCache = null;
      setState({ loading: false, profile: null, accessToken: null });
      router.replace("/wait");
      return;
    }

    const role = normalizeRole(profile.role);
    if (!canAccessDashboard(role, profile.is_approved)) {
      protectedSessionCache = null;
      setState({ loading: false, profile: null, accessToken: null });
      router.replace("/wait");
      return;
    }

    const nextState: ProtectedSessionState = {
      loading: false,
      profile: { ...profile, role },
      accessToken: token,
    };

    protectedSessionCache = nextState;
    setState(nextState);
  }, [router]);

  useEffect(() => {
    if (protectedSessionCache?.profile && protectedSessionCache.accessToken) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadSession]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        protectedSessionCache = null;
        setState({ loading: false, profile: null, accessToken: null });
        return;
      }

      if (event === "TOKEN_REFRESHED" && protectedSessionCache) {
        protectedSessionCache = {
          ...protectedSessionCache,
          accessToken: session.access_token ?? protectedSessionCache.accessToken,
        };
        setState(protectedSessionCache);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    ...state,
    isManager: state.profile?.role === "owner" || state.profile?.role === "admin",
    refresh: () => loadSession(true),
  };
}
