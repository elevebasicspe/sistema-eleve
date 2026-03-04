import Link from "next/link";

export default function WaitPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f2e7df_0%,_#e6d3c5_34%,_#c4a793_62%,_#0a193b_100%)] px-4">
      <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 text-center shadow-[0_18px_45px_rgba(10,25,59,0.3)] sm:p-8">
        <h1 className="text-2xl font-bold text-[#0a193b]">
          Cuenta pendiente de aprobación
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#0a193b]/80">
          Tu correo ya fue verificado, pero todavía necesitas aprobación manual
          del owner para ingresar al dashboard.
        </p>
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
