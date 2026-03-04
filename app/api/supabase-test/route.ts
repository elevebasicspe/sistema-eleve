import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        ok: false,
        message: "Faltan variables de entorno de Supabase.",
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
      cache: "no-store",
    });

    const payload = await response.text();

    return NextResponse.json(
      {
        ok: response.ok,
        status: response.status,
        message: response.ok
          ? "Conexion con Supabase correcta."
          : "Supabase respondio con error.",
        responsePreview: payload.slice(0, 400),
      },
      { status: response.ok ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "No se pudo conectar a Supabase.",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
