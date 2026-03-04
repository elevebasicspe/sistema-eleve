import { NextRequest, NextResponse } from "next/server";
import { canAccessDashboard, normalizeApproveRole, normalizeRole } from "@/lib/auth/profile";
import { getRequesterContext } from "@/lib/server/requester";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ApprovePayload = {
  userId?: string;
  role?: string;
};

export async function POST(request: NextRequest) {
  const requester = await getRequesterContext(request);
  if (!requester) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const isManager = requester.role === "owner" || requester.role === "admin";
  if (!isManager || !canAccessDashboard(requester.role, requester.isApproved)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  let payload: ApprovePayload;
  try {
    payload = (await request.json()) as ApprovePayload;
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalido. Usa { userId, role }." },
      { status: 400 }
    );
  }
  if (!payload.userId) {
    return NextResponse.json({ error: "Falta userId." }, { status: 400 });
  }

  const approvedRole = normalizeApproveRole(payload.role);
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo inicializar el cliente admin.",
      },
      { status: 500 }
    );
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from("profiles")
    .select("id,role")
    .eq("id", payload.userId)
    .maybeSingle<{ id: string; role: string }>();

  if (targetError || !target) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const targetRole = normalizeRole(target.role);
  if (requester.role === "admin" && targetRole === "owner") {
    return NextResponse.json(
      { error: "Admin no puede modificar owner." },
      { status: 403 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ role: approvedRole, is_approved: true })
    .eq("id", payload.userId);

  if (updateError) {
    return NextResponse.json(
      { error: `No se pudo aprobar el usuario: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
