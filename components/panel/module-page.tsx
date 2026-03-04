"use client";

import { ModuleSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import { useProtectedSession } from "@/lib/auth/use-protected-session";

type ModulePageProps = {
  title: string;
  description: string;
};

export function ModulePage({ title, description }: ModulePageProps) {
  const { loading, profile } = useProtectedSession();

  if (loading || !profile) return <ModuleSkeleton title={title} />;

  return (
    <PanelShell title={title} subtitle={description}>
      <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
        <h2 className="text-xl font-semibold text-[#0a193b]">Seccion en construccion</h2>
        <p className="mt-2 text-sm text-[#0a193b]/75">
          Aqui podras gestionar {title.toLowerCase()} con el flujo de ELEVE.
        </p>
      </section>
    </PanelShell>
  );
}
