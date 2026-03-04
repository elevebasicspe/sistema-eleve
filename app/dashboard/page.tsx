"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import { useProtectedSession } from "@/lib/auth/use-protected-session";

type DashboardStats = {
  totalUsers: number;
  pendingUsers: number;
};

type AdminUsersResponse = {
  users?: Array<{ is_approved: boolean }>;
  error?: string;
};

function parseJsonSafe<T>(raw: string): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
      <p className="text-sm text-[#0a193b]/70">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#0a193b]">{value}</p>
      <p className="mt-2 text-sm text-[#0a193b]/70">{description}</p>
    </article>
  );
}

export default function DashboardPage() {
  const { loading, profile, accessToken, isManager } = useProtectedSession();
  const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, pendingUsers: 0 });
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !isManager) return;

    const loadStats = async () => {
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const raw = await response.text();
      const payload = parseJsonSafe<AdminUsersResponse>(raw);
      if (!response.ok) {
        setStatsError(payload.error || "No se pudo cargar resumen de usuarios.");
        return;
      }

      const users = payload.users ?? [];
      const pendingUsers = users.filter((user) => !user.is_approved).length;
      setStats({ totalUsers: users.length, pendingUsers });
      setStatsError(null);
    };

    void loadStats();
  }, [accessToken, isManager]);

  const summary = useMemo(
    () => [
      {
        label: "Ingresos del dia",
        value: "$2,430",
        description: "Consolidado diario de ventas registradas.",
      },
      {
        label: "Gastos del dia",
        value: "$1,080",
        description: "Compras, pagos operativos y costos administrativos.",
      },
      {
        label: "Productos activos",
        value: "148",
        description: "Polos basicos y estampados disponibles en inventario.",
      },
      {
        label: "Clientes activos",
        value: "64",
        description: "Clientes con movimientos recientes.",
      },
      {
        label: "Usuarios pendientes",
        value: isManager ? String(stats.pendingUsers) : "-",
        description: isManager
          ? "Cuentas esperando aprobacion de owner/admin."
          : "Visible solo para owner/admin.",
      },
    ],
    [isManager, stats.pendingUsers]
  );

  if (loading || !profile) return <DashboardSkeleton />;

  return (
    <PanelShell
      title="Dashboard"
      subtitle="Vista general de control financiero y operativo de ELEVE."
      actions={
        <>
          <button className="rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white">
            Hoy
          </button>
          <button className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]">
            7 dias
          </button>
          <button className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]">
            30 dias
          </button>
        </>
      }
    >
      {statsError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {statsError}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summary.map((item) => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            description={item.description}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-semibold text-[#0a193b]">Progreso del periodo</h2>
          <p className="text-sm text-[#0a193b]/65">Actualizado cada 10 minutos</p>
        </div>

        <div className="mt-5 rounded-xl border border-[#d7b7a0]/35 bg-[#faf7f5] p-4">
          <svg viewBox="0 0 900 280" className="h-[220px] w-full">
            <line x1="40" y1="20" x2="40" y2="240" stroke="#d7b7a0" strokeWidth="1" />
            <line x1="40" y1="240" x2="860" y2="240" stroke="#d7b7a0" strokeWidth="1" />

            <path
              d="M60 220 C120 212, 180 195, 240 182 C300 170, 360 158, 420 144 C480 132, 540 112, 600 98 C660 82, 720 62, 820 40"
              stroke="#0a193b"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />

            <path
              d="M60 236 C180 232, 260 230, 340 228 C420 226, 500 214, 600 190 C680 170, 740 150, 820 122"
              stroke="#d7b7a0"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />

            <circle cx="820" cy="40" r="5" fill="#0a193b" />
            <circle cx="820" cy="122" r="5" fill="#d7b7a0" />

            <text x="660" y="36" fill="#0a193b" fontSize="14">
              Ingresos
            </text>
            <text x="660" y="118" fill="#7b5f4d" fontSize="14">
              Gastos
            </text>
          </svg>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[#0a193b]">Movimientos recientes</h2>
          <span className="text-xs text-[#0a193b]/65">ELEVE</span>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#d7b7a0]/35">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f4ede7] text-[#0a193b]">
              <tr>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Descripcion</th>
                <th className="px-3 py-2 font-semibold">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90">
                <td className="px-3 py-2">04/03/2026</td>
                <td className="px-3 py-2">Ingreso</td>
                <td className="px-3 py-2">Venta mayorista - polos estampados</td>
                <td className="px-3 py-2 font-semibold text-emerald-700">$780</td>
              </tr>
              <tr className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90">
                <td className="px-3 py-2">04/03/2026</td>
                <td className="px-3 py-2">Gasto</td>
                <td className="px-3 py-2">Compra de tela y estampado</td>
                <td className="px-3 py-2 font-semibold text-red-700">$420</td>
              </tr>
              <tr className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90">
                <td className="px-3 py-2">03/03/2026</td>
                <td className="px-3 py-2">Ingreso</td>
                <td className="px-3 py-2">Venta ecommerce</td>
                <td className="px-3 py-2 font-semibold text-emerald-700">$320</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {isManager && (
        <p className="text-xs text-[#0a193b]/60">
          Total de usuarios registrados: {stats.totalUsers}
        </p>
      )}
    </PanelShell>
  );
}
