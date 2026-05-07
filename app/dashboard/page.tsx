"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import { useProtectedSession } from "@/lib/auth/use-protected-session";
import { supabase } from "@/lib/supabase/client";

type Period = "today" | "7d" | "30d";

type DashboardStats = {
  totalUsers: number;
  pendingUsers: number;
};

type AdminUsersResponse = {
  users?: Array<{ is_approved: boolean }>;
  error?: string;
};

type IncomeRow = {
  id: string;
  income_date: string | null;
  amount: number;
  description: string | null;
  payment_method: string | null;
  registered_by_name: string | null;
  registered_by_email: string | null;
  created_at: string;
};

type ExpenseRow = {
  id: string;
  expense_date: string | null;
  amount: number;
  description: string | null;
  registered_by_name: string | null;
  registered_by_email: string | null;
  created_at: string;
};

type ProductRow = {
  id: string;
  name: string;
  stock: number;
  sales_total: number;
  is_active: boolean;
};

type Movement = {
  id: string;
  date: string;
  type: "Ingreso" | "Gasto";
  description: string;
  amount: number;
};

type DashboardData = {
  incomes: IncomeRow[];
  expenses: ExpenseRow[];
  products: ProductRow[];
  recentIncomes: IncomeRow[];
  recentExpenses: ExpenseRow[];
};

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoy",
  "7d": "7 dias",
  "30d": "30 dias",
};

function parseJsonSafe<T>(raw: string): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodStart(period: Period): string {
  const today = new Date();
  if (period === "today") return toYmd(today);

  const start = new Date(today);
  start.setDate(today.getDate() - (period === "7d" ? 6 : 29));
  return toYmd(start);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatPen(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value: string): string {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function metricDescription(period: Period, label: string): string {
  if (period === "today") return `${label} registrados hoy.`;
  return `${label} acumulados en los ultimos ${period === "7d" ? "7" : "30"} dias.`;
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

function PeriodButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white"
          : "rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]"
      }
    >
      {children}
    </button>
  );
}

export default function DashboardPage() {
  const { loading, profile, accessToken, isManager } = useProtectedSession();
  const [period, setPeriod] = useState<Period>("today");
  const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, pendingUsers: 0 });
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    incomes: [],
    expenses: [],
    products: [],
    recentIncomes: [],
    recentExpenses: [],
  });
  const [statsError, setStatsError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

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

  useEffect(() => {
    if (loading || !profile) return;

    let ignore = false;
    const periodStart = getPeriodStart(period);

    const loadDashboardData = async () => {
      setDashboardError(null);

      const [incomesResult, expensesResult, productsResult, recentIncomesResult, recentExpensesResult] =
        await Promise.all([
        supabase
          .from("incomes")
          .select("id,income_date,amount,description,payment_method,registered_by_name,registered_by_email,created_at")
          .gte("income_date", periodStart)
          .order("income_date", { ascending: false })
          .limit(120),
        supabase
          .from("expenses")
          .select("id,expense_date,amount,description,registered_by_name,registered_by_email,created_at")
          .gte("expense_date", periodStart)
          .order("expense_date", { ascending: false })
          .limit(120),
        supabase
          .from("products")
          .select("id,name,stock,sales_total,is_active")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("incomes")
          .select("id,income_date,amount,description,payment_method,registered_by_name,registered_by_email,created_at")
          .order("income_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("expenses")
          .select("id,expense_date,amount,description,registered_by_name,registered_by_email,created_at")
          .order("expense_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      if (ignore) return;

      const errors = [
        incomesResult.error,
        expensesResult.error,
        productsResult.error,
        recentIncomesResult.error,
        recentExpensesResult.error,
      ].filter(Boolean);
      if (errors.length > 0) {
        setDashboardData({
          incomes: [],
          expenses: [],
          products: [],
          recentIncomes: [],
          recentExpenses: [],
        });
        setDashboardError("No se pudieron cargar todas las metricas reales desde Supabase.");
        return;
      }

      const incomes = ((incomesResult.data ?? []) as IncomeRow[]).map((item) => ({
        ...item,
        amount: Number(item.amount) || 0,
      }));
      const expenses = ((expensesResult.data ?? []) as ExpenseRow[]).map((item) => ({
        ...item,
        amount: Number(item.amount) || 0,
      }));
      const products = ((productsResult.data ?? []) as ProductRow[]).map((item) => ({
        ...item,
        stock: Number(item.stock) || 0,
        sales_total: Number(item.sales_total) || 0,
      }));
      const recentIncomes = ((recentIncomesResult.data ?? []) as IncomeRow[]).map((item) => ({
        ...item,
        amount: Number(item.amount) || 0,
      }));
      const recentExpenses = ((recentExpensesResult.data ?? []) as ExpenseRow[]).map((item) => ({
        ...item,
        amount: Number(item.amount) || 0,
      }));

      setDashboardData({ incomes, expenses, products, recentIncomes, recentExpenses });
    };

    void loadDashboardData();

    return () => {
      ignore = true;
    };
  }, [loading, period, profile]);

  const dashboardSummary = useMemo(() => {
    const incomeTotal = dashboardData.incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const expenseTotal = dashboardData.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const activeProducts = dashboardData.products.filter((item) => item.is_active).length;
    const clientKeys = new Set<string>();

    for (const item of [...dashboardData.incomes, ...dashboardData.expenses]) {
      const key = item.registered_by_email || item.registered_by_name;
      if (key) clientKeys.add(key);
    }

    return [
      {
        label: "Ingresos del periodo",
        value: formatPen(incomeTotal),
        description: metricDescription(period, "Ingresos"),
      },
      {
        label: "Gastos del periodo",
        value: formatPen(expenseTotal),
        description: metricDescription(period, "Gastos"),
      },
      {
        label: "Utilidad estimada",
        value: formatPen(incomeTotal - expenseTotal),
        description: "Ingresos menos gastos registrados.",
      },
      {
        label: "Productos activos",
        value: String(activeProducts),
        description: "Productos disponibles segun catalogo.",
      },
      {
        label: "Usuarios pendientes",
        value: isManager ? String(stats.pendingUsers) : "-",
        description: isManager
          ? "Cuentas esperando aprobacion de owner/admin."
          : "Visible solo para owner/admin.",
      },
      {
        label: "Responsables activos",
        value: String(clientKeys.size),
        description: "Personas con movimientos en el periodo.",
      },
    ];
  }, [dashboardData, isManager, period, stats.pendingUsers]);

  const chart = useMemo(() => {
    const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
    const start = new Date(`${getPeriodStart(period)}T00:00:00`);
    const points = Array.from({ length: days }, (_, index) => {
      const date = toYmd(addDays(start, index));
      const incomes = dashboardData.incomes
        .filter((item) => item.income_date === date)
        .reduce((sum, item) => sum + item.amount, 0);
      const expenses = dashboardData.expenses
        .filter((item) => item.expense_date === date)
        .reduce((sum, item) => sum + item.amount, 0);
      return { date, incomes, expenses };
    });
    const max = Math.max(1, ...points.flatMap((item) => [item.incomes, item.expenses]));
    const xStep = days === 1 ? 0 : 760 / (days - 1);
    const x = (index: number) => (days === 1 ? 450 : 70 + index * xStep);
    const y = (value: number) => 230 - (value / max) * 180;
    const barWidth = days === 1 ? 72 : Math.max(8, Math.min(18, xStep * 0.28));

    return { points, x, y, barWidth };
  }, [dashboardData.expenses, dashboardData.incomes, period]);

  const recentMovements = useMemo<Movement[]>(() => {
    const incomes: Movement[] = dashboardData.recentIncomes.map((item) => ({
      id: `income-${item.id}`,
      date: item.income_date || item.created_at.slice(0, 10),
      type: "Ingreso",
      description: item.description?.trim() || item.payment_method || "Ingreso registrado",
      amount: item.amount,
    }));
    const expenses: Movement[] = dashboardData.recentExpenses.map((item) => ({
      id: `expense-${item.id}`,
      date: item.expense_date || item.created_at.slice(0, 10),
      type: "Gasto",
      description: item.description?.trim() || "Gasto registrado",
      amount: item.amount,
    }));

    return [...incomes, ...expenses]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
  }, [dashboardData.recentExpenses, dashboardData.recentIncomes]);

  if (loading || !profile) return <DashboardSkeleton />;

  return (
    <PanelShell
      title="Dashboard"
      subtitle="Vista general de control financiero y operativo de ELEVE."
      profile={profile}
      actions={
        <>
          {(["today", "7d", "30d"] as Period[]).map((item) => (
            <PeriodButton key={item} active={period === item} onClick={() => setPeriod(item)}>
              {PERIOD_LABELS[item]}
            </PeriodButton>
          ))}
        </>
      }
    >
      {statsError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {statsError}
        </p>
      )}

      {dashboardError && (
        <p className="rounded-lg border border-[#d7b7a0]/45 bg-[#faf7f5] px-3 py-2 text-sm text-[#0a193b]/75">
          {dashboardError}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {dashboardSummary.map((item) => (
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
          <p className="text-sm text-[#0a193b]/65">Fuente: Supabase</p>
        </div>

        <div className="mt-5 rounded-xl border border-[#d7b7a0]/35 bg-[#faf7f5] p-4">
          <svg viewBox="0 0 900 280" className="h-[220px] w-full">
            <line x1="40" y1="20" x2="40" y2="240" stroke="#d7b7a0" strokeWidth="1" />
            <line x1="40" y1="240" x2="860" y2="240" stroke="#d7b7a0" strokeWidth="1" />

            {chart.points.map((point, index) => {
              const pointX = chart.x(index);
              const incomeY = chart.y(point.incomes);
              const expenseY = chart.y(point.expenses);
              return (
                <g key={point.date}>
                  <rect
                    x={pointX - chart.barWidth - 2}
                    y={incomeY}
                    width={chart.barWidth}
                    height={240 - incomeY}
                    rx="3"
                    fill="#0a193b"
                  />
                  <rect
                    x={pointX + 2}
                    y={expenseY}
                    width={chart.barWidth}
                    height={240 - expenseY}
                    rx="3"
                    fill="#d7b7a0"
                  />
                  <circle cx={pointX} cy="240" r="2.5" fill="#d7b7a0" />
                  {(index === 0 || index === chart.points.length - 1) && (
                    <text x={pointX - 28} y="264" fill="#7b5f4d" fontSize="12">
                      {formatDate(point.date).slice(0, 5)}
                    </text>
                  )}
                </g>
              );
            })}

            <text x="650" y="36" fill="#0a193b" fontSize="14">
              Ingresos
            </text>
            <text x="650" y="58" fill="#7b5f4d" fontSize="14">
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
              {recentMovements.map((item) => (
                <tr key={item.id} className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90">
                  <td className="px-3 py-2">{formatDate(item.date)}</td>
                  <td className="px-3 py-2">{item.type}</td>
                  <td className="px-3 py-2">{item.description}</td>
                  <td
                    className={`px-3 py-2 font-semibold ${
                      item.type === "Ingreso" ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {formatPen(item.amount)}
                  </td>
                </tr>
              ))}
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
