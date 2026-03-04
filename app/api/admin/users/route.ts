import { NextRequest, NextResponse } from "next/server";
import { canAccessDashboard } from "@/lib/auth/profile";
import { getRequesterContext } from "@/lib/server/requester";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const requester = await getRequesterContext(request);
  if (!requester) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const isManager = requester.role === "owner" || requester.role === "admin";
  if (!isManager || !canAccessDashboard(requester.role, requester.isApproved)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,email,role,is_approved,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "No se pudo listar usuarios." },
      { status: 500 }
    );
  }

  return NextResponse.json({ users: data ?? [] });
}
