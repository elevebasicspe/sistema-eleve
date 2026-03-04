import { Suspense } from "react";
import { VerifyClient } from "./verify-client";

function VerifyFallback() {
  return (
    <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 text-center shadow-[0_18px_45px_rgba(10,25,59,0.3)] sm:p-8">
      <h1 className="text-2xl font-bold text-[#0a193b]">Verificando cuenta</h1>
      <p className="mt-3 text-sm text-[#0a193b]/80">Procesando verificación...</p>
    </section>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f2e7df_0%,_#e6d3c5_34%,_#c4a793_62%,_#0a193b_100%)] px-4">
      <Suspense fallback={<VerifyFallback />}>
        <VerifyClient />
      </Suspense>
    </main>
  );
}
