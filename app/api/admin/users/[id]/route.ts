import { NextRequest, NextResponse } from "next/server";
import { canAccessDashboard, normalizeRole } from "@/lib/auth/profile";
import { getRequesterContext } from "@/lib/server/requester";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: RouteParams) {
  const requester = await getRequesterContext(request);
  if (!requester) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const isManager = requester.role === "owner" || requester.role === "admin";
  if (!isManager || !canAccessDashboard(requester.role, requester.isApproved)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await context.params;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: target, error: targetError } = await supabaseAdmin
    .from("profiles")
    .select("id,role")
    .eq("id", id)
    .maybeSingle<{ id: string; role: string }>();

  if (targetError || !target) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const targetRole = normalizeRole(target.role);
  if (requester.role === "admin" && targetRole === "owner") {
    return NextResponse.json(
      { error: "Admin no puede borrar owner." },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (deleteError) {
    return NextResponse.json(
      { error: "No se pudo borrar el usuario." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
