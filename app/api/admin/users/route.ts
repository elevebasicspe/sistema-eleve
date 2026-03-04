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

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,email,role,is_approved")
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `No se pudo listar usuarios: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ users: data ?? [] });
}
