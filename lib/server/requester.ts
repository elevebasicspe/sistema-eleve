import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { normalizeRole, type AppRole, type ProfileRow } from "@/lib/auth/profile";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type RequesterContext = {
  id: string;
  role: AppRole;
  isApproved: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
}

if (!anonKey) {
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabaseAuthCheck = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function getRequesterContext(
  request: NextRequest
): Promise<RequesterContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const { data: authData, error: authError } = await supabaseAuthCheck.auth.getUser(token);
  if (authError || !authData.user) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id,role,is_approved")
    .eq("id", authData.user.id)
    .maybeSingle<Pick<ProfileRow, "id" | "role" | "is_approved">>();

  if (!profile) return null;

  return {
    id: profile.id,
    role: normalizeRole(profile.role),
    isApproved: profile.is_approved,
  };
}
