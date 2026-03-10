"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IngresosSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import { useProtectedSession } from "@/lib/auth/use-protected-session";
import { supabase } from "@/lib/supabase/client";

type SummaryPreset = "today" | "yesterday" | "3d" | "7d" | "month" | "custom";

type ExpenseCategory = {
  id: string;
  name: string;
  category_name?: string | null;
  subcategory_name?: string | null;
  description: string | null;
  created_at: string;
};

type ExpenseRow = {
  id: string;
  amount: number;
  category_id: string | null;
  destination_bank_account_id: string | null;
  payment_method: string | null;
  description: string | null;
  income_date: string | null;
  registered_by_name: string | null;
  registered_by_email: string | null;
  created_at: string;
};

type BankAccountOption = {
  id: string;
  name: string;
  current_balance: number;
  currency: string;
};

type PaymentMethodOption = {
  id: string;
  name: string;
  bank_account_id: string;
  bank_accounts: {
    id: string;
    name: string;
    currency: string;
  } | null;
};

type RawPaymentMethodOption = {
  id: string;
  name: string;
  bank_account_id: string;
  bank_accounts:
    | {
        id: string;
        name: string;
        currency: string;
      }
    | {
        id: string;
        name: string;
        currency: string;
      }[]
    | null;
};

type TopCategory = {
  categoryId: string;
  categoryName: string;
  total: number;
};

const PAGE_SIZE = 15;

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPen(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getPresetRange(preset: Exclude<SummaryPreset, "custom">): { from: string; to: string } {
  const today = new Date();
  const todayYmd = toYmd(today);

  if (preset === "today") return { from: todayYmd, to: todayYmd };

  if (preset === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = toYmd(yesterday);
    return { from: ymd, to: ymd };
  }

  if (preset === "3d") {
    const start = new Date(today);
    start.setDate(start.getDate() - 2);
    return { from: toYmd(start), to: todayYmd };
  }

  if (preset === "7d") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: toYmd(start), to: todayYmd };
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: toYmd(monthStart), to: todayYmd };
}

function monthDefaultRange(): { from: string; to: string } {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: toYmd(monthStart), to: toYmd(today) };
}

function dbErrorMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code === "42P01" || error.code === "42703") {
    return "Faltan tablas de ingresos/medios/categorias. Ejecuta supabase/bank_accounts.sql y supabase/incomes.sql en Supabase.";
  }
  return error.message || fallback;
}

function getCategoryLabel(category?: ExpenseCategory | null): string {
  if (!category) return "Sin categoria";
  const main = category.category_name?.trim();
  const sub = category.subcategory_name?.trim();
  if (main && sub) return `${main} / ${sub}`;
  if (category.name?.trim()) return category.name.trim();
  if (main) return main;
  return "Sin categoria";
}

function rangeLabel(from: string, to: string): string {
  if (!from || !to) return "-";
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return `${from} - ${to}`;

  return `${new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fromDate)} - ${new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(toDate)}`;
}

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${active ? "text-[#0a193b]" : "text-[#0a193b]/55"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M7 12h10" />
      <path d="M10 17h4" />
    </svg>
  );
}

export default function IngresosPage() {
  const { loading, profile, isManager } = useProtectedSession();

  const initialSummaryRange = useMemo(() => getPresetRange("month"), []);
  const initialLogRange = useMemo(() => monthDefaultRange(), []);

  const [summaryPreset, setSummaryPreset] = useState<SummaryPreset>("month");
  const [summaryFrom, setSummaryFrom] = useState(initialSummaryRange.from);
  const [summaryTo, setSummaryTo] = useState(initialSummaryRange.to);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [bankAccountsError, setBankAccountsError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);

  const [logs, setLogs] = useState<ExpenseRow[]>([]);
  const [logsCount, setLogsCount] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const [logFrom, setLogFrom] = useState(initialLogRange.from);
  const [logTo, setLogTo] = useState(initialLogRange.to);
  const [categoryFilterMode, setCategoryFilterMode] = useState<"include" | "exclude">("include");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [paymentMethodFilterMode, setPaymentMethodFilterMode] = useState<"include" | "exclude">("include");
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [destinationFilterMode, setDestinationFilterMode] = useState<"include" | "exclude">("include");
  const [selectedDestinationAccountIds, setSelectedDestinationAccountIds] = useState<string[]>([]);
  const [openLogFilter, setOpenLogFilter] = useState<
    "date" | "category" | "paymentMethod" | "destinationAccount" | null
  >(null);
  const [draftLogFrom, setDraftLogFrom] = useState(initialLogRange.from);
  const [draftLogTo, setDraftLogTo] = useState(initialLogRange.to);
  const [draftCategoryMode, setDraftCategoryMode] = useState<"include" | "exclude">("include");
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>([]);
  const [draftPaymentMethodMode, setDraftPaymentMethodMode] = useState<"include" | "exclude">("include");
  const [draftPaymentMethods, setDraftPaymentMethods] = useState<string[]>([]);
  const [draftDestinationMode, setDraftDestinationMode] = useState<"include" | "exclude">("include");
  const [draftDestinationAccountIds, setDraftDestinationAccountIds] = useState<string[]>([]);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [supportsCategoryColumns, setSupportsCategoryColumns] = useState(true);
  const [categoryActionError, setCategoryActionError] = useState<string | null>(null);
  const [categoryActionSuccess, setCategoryActionSuccess] = useState<string | null>(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(toYmd(new Date()));
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expensePaymentMethodId, setExpensePaymentMethodId] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseActionError, setExpenseActionError] = useState<string | null>(null);
  const [expenseActionSuccess, setExpenseActionSuccess] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, ExpenseCategory>();
    for (const category of categories) map.set(category.id, category);
    return map;
  }, [categories]);
  const bankAccountMap = useMemo(() => {
    const map = new Map<string, BankAccountOption>();
    for (const account of bankAccounts) map.set(account.id, account);
    return map;
  }, [bankAccounts]);
  const paymentMethodMap = useMemo(() => {
    const map = new Map<string, PaymentMethodOption>();
    for (const method of paymentMethods) map.set(method.id, method);
    return map;
  }, [paymentMethods]);

  const totalLogPages = useMemo(
    () => Math.max(1, Math.ceil((logsCount || 0) / PAGE_SIZE)),
    [logsCount]
  );
  const paymentMethodOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const method of paymentMethods) {
      const name = method.name?.trim();
      if (name) unique.add(name);
    }
    return [...unique].sort((a, b) => a.localeCompare(b, "es"));
  }, [paymentMethods]);
  const visibleLogRows = useMemo(
    () => Array.from({ length: PAGE_SIZE }, (_, index) => logs[index] ?? null),
    [logs]
  );
  const hasDateFilter =
    logFrom !== initialLogRange.from || logTo !== initialLogRange.to;
  const hasCategoryFilter = selectedCategoryIds.length > 0;
  const hasPaymentMethodFilter = selectedPaymentMethods.length > 0;
  const hasDestinationAccountFilter = selectedDestinationAccountIds.length > 0;

  const applyQuickSummaryRange = (preset: Exclude<SummaryPreset, "custom">) => {
    const range = getPresetRange(preset);
    setSummaryPreset(preset);
    setSummaryFrom(range.from);
    setSummaryTo(range.to);
  };

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);

    const modern = await supabase
      .from("income_categories")
      .select("id,name,category_name,subcategory_name,description,created_at")
      .order("category_name", { ascending: true })
      .order("subcategory_name", { ascending: true });

    if (!modern.error) {
      setSupportsCategoryColumns(true);
      setCategoriesLoading(false);
      setCategories(modern.data ?? []);
      return;
    }

    if (!modern.error.message.toLowerCase().includes("category_name")) {
      setCategoriesLoading(false);
      setCategoriesError(dbErrorMessage(modern.error, "No se pudieron cargar categorias."));
      return;
    }

    const legacy = await supabase
      .from("income_categories")
      .select("id,name,description,created_at")
      .order("name", { ascending: true });

    setCategoriesLoading(false);

    if (legacy.error) {
      setCategoriesError(dbErrorMessage(legacy.error, "No se pudieron cargar categorias."));
      return;
    }

    setSupportsCategoryColumns(false);
    setCategories(legacy.data ?? []);
  }, []);

  const loadBankAccounts = useCallback(async () => {
    setBankAccountsError(null);

    const { data, error } = await supabase
      .from("bank_accounts")
      .select("id,name,current_balance,currency")
      .order("name", { ascending: true });

    if (error) {
      setBankAccountsError(dbErrorMessage(error, "No se pudieron cargar cuentas bancarias."));
      return;
    }

    setBankAccounts((data ?? []) as BankAccountOption[]);
  }, []);

  const loadPaymentMethods = useCallback(async () => {
    setPaymentMethodsError(null);

    const { data, error } = await supabase
      .from("payment_methods")
      .select("id,name,bank_account_id,bank_accounts(id,name,currency)")
      .order("name", { ascending: true });

    if (error) {
      setPaymentMethodsError(dbErrorMessage(error, "No se pudieron cargar medios de pago."));
      return;
    }

    const methods = ((data ?? []) as RawPaymentMethodOption[]).map((item) => ({
      ...item,
      bank_accounts: Array.isArray(item.bank_accounts)
        ? item.bank_accounts[0] ?? null
        : item.bank_accounts,
    })) as PaymentMethodOption[];

    setPaymentMethods(methods);
    setExpensePaymentMethodId((current) => current || methods[0]?.id || "");
  }, []);

  const loadSummary = useCallback(async () => {
    if (!summaryFrom || !summaryTo) return;
    if (summaryFrom > summaryTo) {
      setSummaryError("El rango de resumen es invalido.");
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);

    const { data, error } = await supabase
      .from("incomes")
      .select("amount,category_id,created_at")
      .gte("created_at", `${summaryFrom}T00:00:00`)
      .lte("created_at", `${summaryTo}T23:59:59`);

    setSummaryLoading(false);

    if (error) {
      setSummaryError(dbErrorMessage(error, "No se pudo cargar resumen de ingresos."));
      return;
    }

    const rows = (data ?? []) as Array<{ amount: number; category_id: string | null }>;
    let total = 0;
    const totalsByCategory = new Map<string, number>();

    for (const row of rows) {
      const amount = Number(row.amount) || 0;
      total += amount;
      if (row.category_id) {
        totalsByCategory.set(row.category_id, (totalsByCategory.get(row.category_id) || 0) + amount);
      }
    }

    const top = [...totalsByCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([categoryId, categoryTotal]) => ({
        categoryId,
        categoryName: getCategoryLabel(categoryMap.get(categoryId)),
        total: categoryTotal,
      }));

    setSummaryTotal(total);
    setTopCategories(top);
  }, [categoryMap, summaryFrom, summaryTo]);

  const loadLogs = useCallback(async () => {
    if (!logFrom || !logTo) return;
    if (logFrom > logTo) {
      setLogsError("El rango de fechas de registro es invalido.");
      return;
    }

    setLogsLoading(true);
    setLogsError(null);

    let query = supabase
      .from("incomes")
      .select(
        "id,amount,category_id,destination_bank_account_id,payment_method,description,income_date,registered_by_name,registered_by_email,created_at",
        { count: "exact" }
      )
      .gte("created_at", `${logFrom}T00:00:00`)
      .lte("created_at", `${logTo}T23:59:59`)
      .order("created_at", { ascending: false });

    if (selectedCategoryIds.length > 0) {
      if (categoryFilterMode === "include") {
        query = query.in("category_id", selectedCategoryIds);
      } else {
        for (const categoryId of selectedCategoryIds) {
          query = query.neq("category_id", categoryId);
        }
      }
    }

    if (selectedPaymentMethods.length > 0) {
      if (paymentMethodFilterMode === "include") {
        query = query.in("payment_method", selectedPaymentMethods);
      } else {
        for (const methodName of selectedPaymentMethods) {
          query = query.neq("payment_method", methodName);
        }
      }
    }

    if (selectedDestinationAccountIds.length > 0) {
      if (destinationFilterMode === "include") {
        query = query.in("destination_bank_account_id", selectedDestinationAccountIds);
      } else {
        for (const destinationId of selectedDestinationAccountIds) {
          query = query.neq("destination_bank_account_id", destinationId);
        }
      }
    }

    const from = (logsPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await query.range(from, to);

    setLogsLoading(false);

    if (error) {
      setLogsError(dbErrorMessage(error, "No se pudo cargar el registro de ingresos."));
      return;
    }

    const safeCount = count || 0;
    const pages = Math.max(1, Math.ceil(safeCount / PAGE_SIZE));
    if (logsPage > pages) {
      setLogsPage(pages);
      return;
    }

    setLogs(data ?? []);
    setLogsCount(safeCount);
  }, [
    categoryFilterMode,
    destinationFilterMode,
    logFrom,
    logTo,
    logsPage,
    paymentMethodFilterMode,
    selectedCategoryIds,
    selectedDestinationAccountIds,
    selectedPaymentMethods,
  ]);

  const onSubmitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !isManager) return;

    const categoryName = newCategoryName.trim();
    const subcategoryName = newSubcategoryName.trim();
    const name = `${categoryName} / ${subcategoryName}`;
    const description = newCategoryDescription.trim();

    if (!categoryName) {
      setCategoryActionError("La categoria es obligatoria.");
      return;
    }

    if (!subcategoryName) {
      setCategoryActionError("La subcategoria es obligatoria.");
      return;
    }

    setSavingCategory(true);
    setCategoryActionError(null);
    setCategoryActionSuccess(null);

    const payload: Record<string, string | null> = {
      name,
      description: description || null,
      created_by: profile.id,
    };

    if (supportsCategoryColumns) {
      payload.category_name = categoryName;
      payload.subcategory_name = subcategoryName;
    }

    const { error } = await supabase.from("income_categories").insert(payload);

    setSavingCategory(false);

    if (error) {
      if (error.code === "23505") {
        setCategoryActionError("Esa combinacion de categoria y subcategoria ya existe.");
      } else {
        setCategoryActionError(dbErrorMessage(error, "No se pudo registrar categoria."));
      }
      return;
    }

    setCategoryActionSuccess("Categoria registrada.");
    setNewCategoryName("");
    setNewSubcategoryName("");
    setNewCategoryDescription("");
    setCategoryModalOpen(false);
    await loadCategories();
    await loadSummary();
  };

  const onSubmitExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    const selectedCategoryId = expenseCategoryId || categories[0]?.id || "";
    const selectedPaymentMethodId = expensePaymentMethodId || paymentMethods[0]?.id || "";
    const selectedMethod = paymentMethodMap.get(selectedPaymentMethodId);
    const amount = Number(expenseAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseActionError("El monto debe ser mayor a 0.");
      return;
    }

    if (!expenseDate) {
      setExpenseActionError("Selecciona la fecha del ingreso.");
      return;
    }

    if (!selectedCategoryId) {
      setExpenseActionError("Selecciona una categoria.");
      return;
    }

    if (!selectedPaymentMethodId || !selectedMethod) {
      setExpenseActionError("Selecciona un medio de pago.");
      return;
    }

    if (!selectedMethod.bank_account_id) {
      setExpenseActionError("El medio de pago seleccionado no tiene cuenta vinculada.");
      return;
    }

    setSavingExpense(true);
    setExpenseActionError(null);
    setExpenseActionSuccess(null);

    const { error } = await supabase.from("incomes").insert({
      amount,
      income_date: expenseDate,
      category_id: selectedCategoryId,
      payment_method_id: selectedPaymentMethodId,
      description: expenseDescription.trim() || "",
      registered_by: profile.id,
    });

    setSavingExpense(false);

    if (error) {
      setExpenseActionError(dbErrorMessage(error, "No se pudo registrar el ingreso."));
      return;
    }

    setExpenseActionSuccess("Ingreso registrado y saldo actualizado.");
    setExpenseModalOpen(false);
    setExpenseAmount("");
    setExpenseDescription("");
    setExpensePaymentMethodId(paymentMethods[0]?.id ?? "");
    setExpenseDate(toYmd(new Date()));
    await Promise.all([loadLogs(), loadSummary(), loadBankAccounts(), loadPaymentMethods()]);
  };

  useEffect(() => {
    if (loading || !profile) return;
    const timer = window.setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, profile, loadCategories]);

  useEffect(() => {
    if (loading || !profile) return;
    const timer = window.setTimeout(() => {
      void loadBankAccounts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, profile, loadBankAccounts]);

  useEffect(() => {
    if (loading || !profile) return;
    const timer = window.setTimeout(() => {
      void loadPaymentMethods();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, profile, loadPaymentMethods]);

  useEffect(() => {
    if (loading || !profile) return;
    const timer = window.setTimeout(() => {
      void loadSummary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, profile, loadSummary]);

  useEffect(() => {
    if (loading || !profile) return;
    const timer = window.setTimeout(() => {
      void loadLogs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, profile, loadLogs]);

  const openDateFilter = () => {
    setDraftLogFrom(logFrom);
    setDraftLogTo(logTo);
    setOpenLogFilter((current) => (current === "date" ? null : "date"));
  };

  const openCategoryFilter = () => {
    setDraftCategoryMode(categoryFilterMode);
    setDraftCategoryIds(selectedCategoryIds);
    setOpenLogFilter((current) => (current === "category" ? null : "category"));
  };

  const openPaymentMethodFilter = () => {
    setDraftPaymentMethodMode(paymentMethodFilterMode);
    setDraftPaymentMethods(selectedPaymentMethods);
    setOpenLogFilter((current) => (current === "paymentMethod" ? null : "paymentMethod"));
  };

  const openDestinationFilter = () => {
    setDraftDestinationMode(destinationFilterMode);
    setDraftDestinationAccountIds(selectedDestinationAccountIds);
    setOpenLogFilter((current) =>
      current === "destinationAccount" ? null : "destinationAccount"
    );
  };

  if (loading || !profile) return <IngresosSkeleton />;

  return (
    <PanelShell
      title="Ingresos"
      subtitle="Control de ventas, cobranzas y abonos en PEN (S/.)"
      profile={profile}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyQuickSummaryRange("today")}
            className={
              summaryPreset === "today"
                ? "rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white"
                : "rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]"
            }
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => applyQuickSummaryRange("yesterday")}
            className={
              summaryPreset === "yesterday"
                ? "rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white"
                : "rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]"
            }
          >
            Ayer
          </button>
          <button
            type="button"
            onClick={() => applyQuickSummaryRange("3d")}
            className={
              summaryPreset === "3d"
                ? "rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white"
                : "rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]"
            }
          >
            3 dias
          </button>
          <button
            type="button"
            onClick={() => applyQuickSummaryRange("7d")}
            className={
              summaryPreset === "7d"
                ? "rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white"
                : "rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]"
            }
          >
            7 dias
          </button>
          <button
            type="button"
            onClick={() => applyQuickSummaryRange("month")}
            className={
              summaryPreset === "month"
                ? "rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white"
                : "rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]"
            }
          >
            Este mes
          </button>

          <input
            type="date"
            value={summaryFrom}
            onChange={(event) => {
              setSummaryPreset("custom");
              setSummaryFrom(event.target.value);
            }}
            className="rounded-lg border border-[#d7b7a0]/80 bg-white px-2 py-2 text-xs text-[#0a193b]"
          />
          <input
            type="date"
            value={summaryTo}
            onChange={(event) => {
              setSummaryPreset("custom");
              setSummaryTo(event.target.value);
            }}
            className="rounded-lg border border-[#d7b7a0]/80 bg-white px-2 py-2 text-xs text-[#0a193b]"
          />
        </div>
      }
    >
      {(summaryError ||
        categoriesError ||
        bankAccountsError ||
        paymentMethodsError ||
        logsError ||
        categoryActionError ||
        expenseActionError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {summaryError ||
            categoriesError ||
            bankAccountsError ||
            paymentMethodsError ||
            logsError ||
            categoryActionError ||
            expenseActionError}
        </p>
      )}
      {categoryActionSuccess && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {categoryActionSuccess}
        </p>
      )}
      {expenseActionSuccess && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {expenseActionSuccess}
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr]">
        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <p className="text-sm text-[#0a193b]/70">Ingresos totales del periodo</p>
          {summaryLoading ? (
            <div className="eleve-skeleton mt-3 h-10 w-36 rounded-lg" />
          ) : (
            <p className="mt-3 text-3xl font-bold text-[#0a193b]">{formatPen(summaryTotal)}</p>
          )}
          <p className="mt-2 text-xs text-[#0a193b]/65">{rangeLabel(summaryFrom, summaryTo)}</p>
        </article>

        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <p className="text-sm text-[#0a193b]/70">Top 3 categorias con mas ingresos</p>
          {summaryLoading ? (
            <div className="mt-3 space-y-2">
              <div className="eleve-skeleton h-7 w-full rounded-md" />
              <div className="eleve-skeleton h-7 w-full rounded-md" />
              <div className="eleve-skeleton h-7 w-full rounded-md" />
            </div>
          ) : topCategories.length === 0 ? (
            <p className="mt-3 text-sm text-[#0a193b]/70">Sin datos en este rango.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {topCategories.map((item, index) => (
                <li
                  key={item.categoryId}
                  className="flex items-center justify-between rounded-lg border border-[#d7b7a0]/35 bg-[#faf7f5] px-3 py-2"
                >
                  <span className="text-sm font-medium text-[#0a193b]">
                    {index + 1}. {item.categoryName}
                  </span>
                  <span className="text-sm font-semibold text-[#0a193b]">{formatPen(item.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-[#0a193b]/70">Categorias</p>
              <p className="text-xs text-[#0a193b]/60">Gestion por categoria y subcategoria.</p>
              {categoriesLoading ? (
                <div className="eleve-skeleton mt-2 h-4 w-36 rounded-md" />
              ) : (
                <p className="mt-2 text-2xl font-bold text-[#0a193b]">{categories.length}</p>
              )}
              <p className="text-xs text-[#0a193b]/65">Categorias registradas</p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                disabled={categories.length === 0 || paymentMethods.length === 0}
                onClick={() => {
                  if (!expenseCategoryId && categories.length > 0) {
                    setExpenseCategoryId(categories[0].id);
                  }
                  if (!expensePaymentMethodId && paymentMethods.length > 0) {
                    setExpensePaymentMethodId(paymentMethods[0].id);
                  }
                  setExpenseModalOpen(true);
                }}
                className="rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                Registrar ingreso
              </button>
              <Link
                href="/ingresos/categorias"
                className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b] transition hover:bg-[#f6ebe3]"
              >
                Ver categorias
              </Link>
              {isManager && (
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(true)}
                  className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b] transition hover:bg-[#f6ebe3]"
                >
                  Registrar categoria
                </button>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#0a193b]">Registro de ingresos</h2>
            <p className="mt-1 text-xs text-[#0a193b]/65">
              Filtros por columna: Fecha, Categoria, Medio de pago y Destino.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-[#d7b7a0]/35">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f4ede7] text-[#0a193b]">
              <tr>
                <th className="relative px-3 py-3 font-semibold">
                  <div className="inline-flex items-center gap-1">
                    <span>Fecha</span>
                    <button
                      type="button"
                      onClick={openDateFilter}
                      className="rounded p-0.5 hover:bg-[#e8dfd8]"
                      title="Filtrar fecha"
                      aria-label="Filtrar fecha"
                    >
                      <FilterIcon active={hasDateFilter} />
                    </button>
                  </div>
                  {openLogFilter === "date" && (
                    <div className="absolute left-2 top-9 z-30 w-64 rounded-lg border border-[#d7b7a0]/70 bg-white p-3 shadow-[0_12px_30px_rgba(10,25,59,0.2)]">
                      <p className="text-xs font-semibold text-[#0a193b]">Filtrar por fecha</p>
                      <div className="mt-2 space-y-2">
                        <div className="space-y-1">
                          <label className="text-[11px] text-[#0a193b]/70">Desde</label>
                          <input
                            type="date"
                            value={draftLogFrom}
                            onChange={(event) => setDraftLogFrom(event.target.value)}
                            className="w-full rounded-md border border-[#d7b7a0]/80 bg-white px-2 py-1.5 text-xs text-[#0a193b]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-[#0a193b]/70">Hasta</label>
                          <input
                            type="date"
                            value={draftLogTo}
                            onChange={(event) => setDraftLogTo(event.target.value)}
                            className="w-full rounded-md border border-[#d7b7a0]/80 bg-white px-2 py-1.5 text-xs text-[#0a193b]"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLogFrom(draftLogFrom);
                            setLogTo(draftLogTo);
                            setLogsPage(1);
                            setOpenLogFilter(null);
                          }}
                          className="rounded-md bg-[#0a193b] px-2.5 py-1.5 text-xs font-semibold text-white"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftLogFrom(initialLogRange.from);
                            setDraftLogTo(initialLogRange.to);
                            setLogFrom(initialLogRange.from);
                            setLogTo(initialLogRange.to);
                            setLogsPage(1);
                            setOpenLogFilter(null);
                          }}
                          className="rounded-md border border-[#d7b7a0]/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0a193b]"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-3 py-3 font-semibold">Monto en S/</th>
                <th className="relative px-3 py-3 font-semibold">
                  <div className="inline-flex items-center gap-1">
                    <span>Medio de pago</span>
                    <button
                      type="button"
                      onClick={openPaymentMethodFilter}
                      className="rounded p-0.5 hover:bg-[#e8dfd8]"
                      title="Filtrar medio de pago"
                      aria-label="Filtrar medio de pago"
                    >
                      <FilterIcon active={hasPaymentMethodFilter} />
                    </button>
                  </div>
                  {openLogFilter === "paymentMethod" && (
                    <div className="absolute left-2 top-9 z-30 w-72 rounded-lg border border-[#d7b7a0]/70 bg-white p-3 shadow-[0_12px_30px_rgba(10,25,59,0.2)]">
                      <p className="text-xs font-semibold text-[#0a193b]">Filtrar medio de pago</p>
                      <div className="mt-2 flex items-center gap-3">
                        <label className="flex items-center gap-1 text-[11px] text-[#0a193b]/85">
                          <input
                            type="radio"
                            checked={draftPaymentMethodMode === "include"}
                            onChange={() => setDraftPaymentMethodMode("include")}
                          />
                          Incluir
                        </label>
                        <label className="flex items-center gap-1 text-[11px] text-[#0a193b]/85">
                          <input
                            type="radio"
                            checked={draftPaymentMethodMode === "exclude"}
                            onChange={() => setDraftPaymentMethodMode("exclude")}
                          />
                          Excluir
                        </label>
                      </div>
                      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-md border border-[#d7b7a0]/40 p-2">
                        {paymentMethodOptions.map((methodName) => {
                          const checked = draftPaymentMethods.includes(methodName);
                          return (
                            <label
                              key={methodName}
                              className="flex items-center gap-2 rounded px-1 py-1 text-xs text-[#0a193b]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setDraftPaymentMethods((current) => {
                                    if (current.includes(methodName)) {
                                      return current.filter((name) => name !== methodName);
                                    }
                                    return [...current, methodName];
                                  });
                                }}
                              />
                              <span className="truncate">{methodName}</span>
                            </label>
                          );
                        })}
                        {paymentMethodOptions.length === 0 && (
                          <p className="text-xs text-[#0a193b]/65">No hay medios de pago.</p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethodFilterMode(draftPaymentMethodMode);
                            setSelectedPaymentMethods(draftPaymentMethods);
                            setLogsPage(1);
                            setOpenLogFilter(null);
                          }}
                          className="rounded-md bg-[#0a193b] px-2.5 py-1.5 text-xs font-semibold text-white"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftPaymentMethodMode("include");
                            setDraftPaymentMethods([]);
                            setPaymentMethodFilterMode("include");
                            setSelectedPaymentMethods([]);
                            setLogsPage(1);
                            setOpenLogFilter(null);
                          }}
                          className="rounded-md border border-[#d7b7a0]/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0a193b]"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  )}
                </th>
                <th className="relative px-3 py-3 font-semibold">
                  <div className="inline-flex items-center gap-1">
                    <span>Categoria</span>
                    <button
                      type="button"
                      onClick={openCategoryFilter}
                      className="rounded p-0.5 hover:bg-[#e8dfd8]"
                      title="Filtrar categoria"
                      aria-label="Filtrar categoria"
                    >
                      <FilterIcon active={hasCategoryFilter} />
                    </button>
                  </div>
                  {openLogFilter === "category" && (
                    <div className="absolute left-2 top-9 z-30 w-72 rounded-lg border border-[#d7b7a0]/70 bg-white p-3 shadow-[0_12px_30px_rgba(10,25,59,0.2)]">
                      <p className="text-xs font-semibold text-[#0a193b]">Filtrar categoria</p>
                      <div className="mt-2 flex items-center gap-3">
                        <label className="flex items-center gap-1 text-[11px] text-[#0a193b]/85">
                          <input
                            type="radio"
                            checked={draftCategoryMode === "include"}
                            onChange={() => setDraftCategoryMode("include")}
                          />
                          Incluir
                        </label>
                        <label className="flex items-center gap-1 text-[11px] text-[#0a193b]/85">
                          <input
                            type="radio"
                            checked={draftCategoryMode === "exclude"}
                            onChange={() => setDraftCategoryMode("exclude")}
                          />
                          Excluir
                        </label>
                      </div>
                      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-md border border-[#d7b7a0]/40 p-2">
                        {categories.map((category) => {
                          const checked = draftCategoryIds.includes(category.id);
                          return (
                            <label
                              key={category.id}
                              className="flex items-center gap-2 rounded px-1 py-1 text-xs text-[#0a193b]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setDraftCategoryIds((current) => {
                                    if (current.includes(category.id)) {
                                      return current.filter((id) => id !== category.id);
                                    }
                                    return [...current, category.id];
                                  });
                                }}
                              />
                              <span className="truncate">{getCategoryLabel(category)}</span>
                            </label>
                          );
                        })}
                        {categories.length === 0 && (
                          <p className="text-xs text-[#0a193b]/65">No hay categorias.</p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryFilterMode(draftCategoryMode);
                            setSelectedCategoryIds(draftCategoryIds);
                            setLogsPage(1);
                            setOpenLogFilter(null);
                          }}
                          className="rounded-md bg-[#0a193b] px-2.5 py-1.5 text-xs font-semibold text-white"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftCategoryMode("include");
                            setDraftCategoryIds([]);
                            setCategoryFilterMode("include");
                            setSelectedCategoryIds([]);
                            setLogsPage(1);
                            setOpenLogFilter(null);
                          }}
                          className="rounded-md border border-[#d7b7a0]/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0a193b]"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-3 py-3 font-semibold">Descripcion</th>
                <th className="relative px-3 py-3 font-semibold">
                  <div className="inline-flex items-center gap-1">
                    <span>Destino (cuenta bancaria)</span>
                    <button
                      type="button"
                      onClick={openDestinationFilter}
                      className="rounded p-0.5 hover:bg-[#e8dfd8]"
                      title="Filtrar destino"
                      aria-label="Filtrar destino"
                    >
                      <FilterIcon active={hasDestinationAccountFilter} />
                    </button>
                  </div>
                  {openLogFilter === "destinationAccount" && (
                    <div className="absolute left-2 top-9 z-30 w-72 rounded-lg border border-[#d7b7a0]/70 bg-white p-3 shadow-[0_12px_30px_rgba(10,25,59,0.2)]">
                      <p className="text-xs font-semibold text-[#0a193b]">Filtrar destino</p>
                      <div className="mt-2 flex items-center gap-3">
                        <label className="flex items-center gap-1 text-[11px] text-[#0a193b]/85">
                          <input
                            type="radio"
                            checked={draftDestinationMode === "include"}
                            onChange={() => setDraftDestinationMode("include")}
                          />
                          Incluir
                        </label>
                        <label className="flex items-center gap-1 text-[11px] text-[#0a193b]/85">
                          <input
                            type="radio"
                            checked={draftDestinationMode === "exclude"}
                            onChange={() => setDraftDestinationMode("exclude")}
                          />
                          Excluir
                        </label>
                      </div>
                      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-md border border-[#d7b7a0]/40 p-2">
                        {bankAccounts.map((account) => {
                          const checked = draftDestinationAccountIds.includes(account.id);
                          return (
                            <label
                              key={account.id}
                              className="flex items-center gap-2 rounded px-1 py-1 text-xs text-[#0a193b]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setDraftDestinationAccountIds((current) => {
                                    if (current.includes(account.id)) {
                                      return current.filter((id) => id !== account.id);
                                    }
                                    return [...current, account.id];
                                  });
                                }}
                              />
                              <span className="truncate">{account.name}</span>
                            </label>
                          );
                        })}
                        {bankAccounts.length === 0 && (
                          <p className="text-xs text-[#0a193b]/65">No hay cuentas.</p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDestinationFilterMode(draftDestinationMode);
                            setSelectedDestinationAccountIds(draftDestinationAccountIds);
                            setLogsPage(1);
                            setOpenLogFilter(null);
                          }}
                          className="rounded-md bg-[#0a193b] px-2.5 py-1.5 text-xs font-semibold text-white"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftDestinationMode("include");
                            setDraftDestinationAccountIds([]);
                            setDestinationFilterMode("include");
                            setSelectedDestinationAccountIds([]);
                            setLogsPage(1);
                            setOpenLogFilter(null);
                          }}
                          className="rounded-md border border-[#d7b7a0]/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0a193b]"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-3 py-3 font-semibold">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading
                ? Array.from({ length: PAGE_SIZE }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="border-t border-[#d7b7a0]/35">
                      <td className="px-3 py-3">
                        <div className="eleve-skeleton h-5 w-28 rounded-md" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="eleve-skeleton h-5 w-20 rounded-md" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="eleve-skeleton h-5 w-36 rounded-md" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="eleve-skeleton h-5 w-28 rounded-md" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="eleve-skeleton h-5 w-full rounded-md" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="eleve-skeleton h-5 w-32 rounded-md" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="eleve-skeleton h-5 w-40 rounded-md" />
                      </td>
                    </tr>
                  ))
                : visibleLogRows.map((row, index) => (
                    <tr
                      key={row?.id ?? `empty-${logsPage}-${index}`}
                      className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90"
                    >
                      <td className="px-3 py-3">{row ? formatDateTime(row.created_at) : ""}</td>
                      <td className="px-3 py-3 font-semibold text-[#0a193b]">
                        {row ? formatPen(Number(row.amount) || 0) : ""}
                      </td>
                      <td className="px-3 py-3">
                        {row ? row.payment_method || "-" : ""}
                      </td>
                      <td className="px-3 py-3">
                        {row
                          ? row.category_id
                            ? getCategoryLabel(categoryMap.get(row.category_id))
                            : "-"
                          : ""}
                      </td>
                      <td className="px-3 py-3">
                        {row ? row.description || "-" : ""}
                      </td>
                      <td className="px-3 py-3">
                        {row
                          ? row.destination_bank_account_id
                            ? bankAccountMap.get(row.destination_bank_account_id)?.name || "Cuenta eliminada"
                            : "-"
                          : ""}
                      </td>
                      <td className="px-3 py-3">
                        {row ? row.registered_by_name || row.registered_by_email || "-" : ""}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[#0a193b]/65">
            {logsCount} registros - pagina {logsPage} de {totalLogPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={logsPage <= 1}
              onClick={() => setLogsPage((current) => Math.max(1, current - 1))}
              className="rounded-md border border-[#d7b7a0]/80 bg-white px-3 py-1.5 text-xs font-semibold text-[#0a193b] disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={logsPage >= totalLogPages}
              onClick={() => setLogsPage((current) => Math.min(totalLogPages, current + 1))}
              className="rounded-md border border-[#d7b7a0]/80 bg-white px-3 py-1.5 text-xs font-semibold text-[#0a193b] disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/55 bg-white p-5 shadow-[0_20px_45px_rgba(10,25,59,0.3)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#0a193b]">Registrar ingreso</h2>
                <p className="mt-1 text-sm text-[#0a193b]/70">
                  Selecciona el medio de pago y el sistema vincula la cuenta destino automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpenseModalOpen(false)}
                className="rounded-md border border-[#d7b7a0]/60 px-2 py-1 text-sm text-[#0a193b]"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={onSubmitExpense}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="expenseAmount">
                    Monto en S/
                  </label>
                  <input
                    id="expenseAmount"
                    inputMode="decimal"
                    value={expenseAmount}
                    onChange={(event) => setExpenseAmount(event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="expenseDate">
                    Fecha
                  </label>
                  <input
                    id="expenseDate"
                    type="date"
                    value={expenseDate}
                    onChange={(event) => setExpenseDate(event.target.value)}
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="paymentMethod">
                  Medio de pago
                </label>
                <select
                  id="paymentMethod"
                  value={expensePaymentMethodId || paymentMethods[0]?.id || ""}
                  onChange={(event) => setExpensePaymentMethodId(event.target.value)}
                  className="w-full rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-md border border-[#d7b7a0]/55 bg-[#faf4ef] px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#0a193b]/65">
                  Cuenta destino automatica
                </p>
                <p className="mt-1 text-sm font-semibold text-[#0a193b]">
                  {(() => {
                    const selected =
                      paymentMethodMap.get(expensePaymentMethodId || paymentMethods[0]?.id || "") ??
                      null;
                    if (!selected?.bank_accounts) return "-";
                    return `${selected.bank_accounts.name} (${selected.bank_accounts.currency})`;
                  })()}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="expenseCategory">
                  Categoria
                </label>
                <select
                  id="expenseCategory"
                  value={expenseCategoryId || categories[0]?.id || ""}
                  onChange={(event) => setExpenseCategoryId(event.target.value)}
                  className="w-full rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {getCategoryLabel(category)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="expenseDescription">
                  Descripcion
                </label>
                <textarea
                  id="expenseDescription"
                  value={expenseDescription}
                  onChange={(event) => setExpenseDescription(event.target.value)}
                  rows={3}
                  maxLength={220}
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingExpense || categories.length === 0 || paymentMethods.length === 0}
                  className="rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
                >
                  {savingExpense ? "Guardando..." : "Registrar ingreso"}
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="rounded-lg border border-[#d7b7a0]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[#0a193b]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/55 bg-white p-5 shadow-[0_20px_45px_rgba(10,25,59,0.3)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#0a193b]">Registrar categoria</h2>
                <p className="mt-1 text-sm text-[#0a193b]/70">
                  Registra categoria + subcategoria. La combinacion no puede repetirse.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="rounded-md border border-[#d7b7a0]/60 px-2 py-1 text-sm text-[#0a193b]"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={onSubmitCategory}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="categoryName">
                  Categoria
                </label>
                <input
                  id="categoryName"
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  maxLength={40}
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="subcategoryName">
                  Subcategoria
                </label>
                <input
                  id="subcategoryName"
                  type="text"
                  value={newSubcategoryName}
                  onChange={(event) => setNewSubcategoryName(event.target.value)}
                  maxLength={40}
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="categoryDescription">
                  Descripcion
                </label>
                <textarea
                  id="categoryDescription"
                  value={newCategoryDescription}
                  onChange={(event) => setNewCategoryDescription(event.target.value)}
                  rows={3}
                  maxLength={180}
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
                >
                  {savingCategory ? "Guardando..." : "Registrar categoria"}
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="rounded-lg border border-[#d7b7a0]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[#0a193b]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </PanelShell>
  );
}
