"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type MovementType = "income" | "expense";

type CategoryOption = {
  id: string;
  name: string;
  category_name?: string | null;
  subcategory_name?: string | null;
};

type PaymentMethodOption = {
  id: string;
  name: string;
  bankAccountId: string;
  bankAccountName: string;
  currency: string;
};

type BankAccountOption = {
  id: string;
  name: string;
  currency: string;
  current_balance: number;
};

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getIncomeFormLabel(category?: CategoryOption | null): string {
  if (!category) return "Sin categoria";
  return category.category_name?.trim() || category.name;
}

function getExpenseFormLabel(category?: CategoryOption | null): string {
  if (!category) return "Sin subcategoria";
  return category.subcategory_name?.trim() || category.name || category.category_name?.trim() || "Sin subcategoria";
}

export default function PublicFormPage() {
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [incomeCategories, setIncomeCategories] = useState<CategoryOption[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);

  const [type, setType] = useState<MovementType>("income");
  const [date, setDate] = useState(toYmd(new Date()));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");

  const categoryOptions = type === "income" ? incomeCategories : expenseCategories;
  const selectedMethod = useMemo(
    () => paymentMethods.find((method) => method.id === paymentMethodId) ?? null,
    [paymentMethodId, paymentMethods]
  );
  const categoryFieldLabel = type === "income" ? "Categoria" : "Subcategoria";

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setLoadingOptions(true);
      setError(null);

      const response = await fetch("/api/public/form", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            incomeCategories?: CategoryOption[];
            expenseCategories?: CategoryOption[];
            paymentMethods?: PaymentMethodOption[];
            bankAccounts?: BankAccountOption[];
          }
        | null;

      if (!active) return;

      if (!response.ok || !data) {
        setLoadingOptions(false);
        setError(data?.error || "No se pudo cargar el formulario.");
        return;
      }

      const nextIncomeCategories = data.incomeCategories ?? [];
      const nextExpenseCategories = data.expenseCategories ?? [];
      const nextPaymentMethods = data.paymentMethods ?? [];
      const nextBankAccounts = data.bankAccounts ?? [];

      setIncomeCategories(nextIncomeCategories);
      setExpenseCategories(nextExpenseCategories);
      setPaymentMethods(nextPaymentMethods);
      setBankAccounts(nextBankAccounts);
      setCategoryId(nextIncomeCategories[0]?.id ?? "");
      setPaymentMethodId(nextPaymentMethods[0]?.id ?? "");
      setBankAccountId(nextBankAccounts[0]?.id ?? "");
      setLoadingOptions(false);
    }

    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

  const changeType = (nextType: MovementType) => {
    setType(nextType);
    setSuccess(null);
    setError(null);
    const nextOptions = nextType === "income" ? incomeCategories : expenseCategories;
    setCategoryId((current) => {
      if (nextOptions.length === 0) return "";
      if (current && nextOptions.some((item) => item.id === current)) return current;
      return nextOptions[0].id;
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload =
      type === "income"
        ? {
            type,
            date,
            amount,
            categoryId,
            paymentMethodId,
            description,
          }
        : {
            type,
            date,
            amount,
            categoryId,
            bankAccountId,
            description,
          };

    const response = await fetch("/api/public/form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setSubmitting(false);

    if (!response.ok) {
      setError(data?.error || "No se pudo registrar.");
      return;
    }

    setSuccess(type === "income" ? "Ingreso registrado." : "Gasto registrado.");
    setAmount("");
    setDescription("");
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#efe4dc_0%,#f7f3f0_16%,#f8f6f4_46%,#f8f6f4_100%)] pb-28 sm:px-6 sm:py-8">
      <section className="mx-auto w-full max-w-3xl sm:rounded-[28px] sm:border sm:border-[#d7b7a0]/45 sm:bg-white sm:shadow-[0_18px_40px_rgba(10,25,59,0.12)]">
        <header className="relative overflow-hidden bg-[#0a193b] px-4 pb-6 pt-5 text-white sm:rounded-t-[28px] sm:px-6">
          <div className="absolute inset-x-0 bottom-0 h-20 bg-[radial-gradient(circle_at_bottom,_rgba(215,183,160,0.45),_transparent_62%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <Image
                src="/ELEVe-logo-transparente.svg"
                alt="ELEVE"
                width={180}
                height={60}
                priority
                className="h-auto w-[132px] brightness-0 invert sm:w-[168px]"
              />
              <p className="mt-3 max-w-[22rem] text-sm leading-5 text-white/78">
                Captura rapida para ventas y gastos desde celular.
              </p>
            </div>
            <Link
              href="/"
              className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-semibold tracking-[0.16em] text-white/92 uppercase backdrop-blur"
            >
              Login
            </Link>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-2 rounded-[22px] bg-white/12 p-1.5 backdrop-blur">
            <button
              type="button"
              onClick={() => changeType("income")}
              className={
                type === "income"
                  ? "min-h-13 rounded-[18px] bg-white px-4 py-3 text-base font-semibold text-[#0a193b] shadow-[0_10px_22px_rgba(10,25,59,0.18)]"
                  : "min-h-13 rounded-[18px] px-4 py-3 text-base font-semibold text-white/82"
              }
            >
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => changeType("expense")}
              className={
                type === "expense"
                  ? "min-h-13 rounded-[18px] bg-white px-4 py-3 text-base font-semibold text-[#0a193b] shadow-[0_10px_22px_rgba(10,25,59,0.18)]"
                  : "min-h-13 rounded-[18px] px-4 py-3 text-base font-semibold text-white/82"
              }
            >
              Gasto
            </button>
          </div>
        </header>

        <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          {loadingOptions ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[#d7b7a0]/35 bg-white p-4 shadow-[0_10px_22px_rgba(10,25,59,0.08)]">
                <div className="eleve-skeleton h-4 w-24 rounded-full" />
                <div className="mt-4 eleve-skeleton h-14 w-full rounded-2xl" />
                <div className="mt-3 eleve-skeleton h-14 w-full rounded-2xl" />
              </div>
              <div className="rounded-[24px] border border-[#d7b7a0]/35 bg-white p-4 shadow-[0_10px_22px_rgba(10,25,59,0.08)]">
                <div className="eleve-skeleton h-4 w-28 rounded-full" />
                <div className="mt-4 eleve-skeleton h-14 w-full rounded-2xl" />
                <div className="mt-3 eleve-skeleton h-14 w-full rounded-2xl" />
                <div className="mt-3 eleve-skeleton h-14 w-full rounded-2xl" />
              </div>
              <div className="rounded-[24px] border border-[#d7b7a0]/35 bg-white p-4 shadow-[0_10px_22px_rgba(10,25,59,0.08)]">
                <div className="eleve-skeleton h-4 w-22 rounded-full" />
                <div className="mt-4 eleve-skeleton h-24 w-full rounded-2xl" />
              </div>
            </div>
          ) : (
            <form id="public-movement-form" className="space-y-5" onSubmit={onSubmit}>
              <section className="rounded-[24px] border border-[#d7b7a0]/40 bg-white p-4 shadow-[0_10px_24px_rgba(10,25,59,0.08)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0a193b]/55">
                      Datos base
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold text-[#0a193b]">
                      {type === "income" ? "Registrar ingreso" : "Registrar gasto"}
                    </h1>
                  </div>
                  <div className="rounded-full bg-[#f5ebe3] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b5f4d]">
                    PEN
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="amount" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a193b]/60">
                        Monto en S/
                      </label>
                      <input
                        id="amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="0.00"
                        required
                        className="min-h-16 w-full rounded-2xl border border-[#d7b7a0]/60 bg-[#fcfaf8] px-4 text-[1.15rem] font-semibold text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="date" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a193b]/60">
                        Fecha
                      </label>
                      <input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        required
                        className="min-h-16 w-full rounded-2xl border border-[#d7b7a0]/60 bg-[#fcfaf8] px-4 text-base text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-[#d7b7a0]/40 bg-white p-4 shadow-[0_10px_24px_rgba(10,25,59,0.08)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0a193b]/55">
                  Clasificacion
                </p>

                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="categoryId" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a193b]/60">
                      {categoryFieldLabel}
                    </label>
                    <select
                      id="categoryId"
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                      required
                      className="min-h-14 w-full rounded-2xl border border-[#d7b7a0]/60 bg-[#fcfaf8] px-4 text-base text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:bg-white"
                    >
                      {categoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {type === "income" ? getIncomeFormLabel(category) : getExpenseFormLabel(category)}
                        </option>
                      ))}
                    </select>
                    {type === "expense" && (
                      <p className="text-xs text-[#0a193b]/62">
                        Se registra usando la subcategoria del gasto.
                      </p>
                    )}
                    {type === "income" && (
                      <p className="text-xs text-[#0a193b]/62">
                        Las ventas se registran usando la categoria principal.
                      </p>
                    )}
                  </div>

                  {type === "income" ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label htmlFor="paymentMethodId" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a193b]/60">
                          Medio de pago
                        </label>
                        <select
                          id="paymentMethodId"
                          value={paymentMethodId}
                          onChange={(event) => setPaymentMethodId(event.target.value)}
                          required
                          className="min-h-14 w-full rounded-2xl border border-[#d7b7a0]/60 bg-[#fcfaf8] px-4 text-base text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:bg-white"
                        >
                          {paymentMethods.map((method) => (
                            <option key={method.id} value={method.id}>
                              {method.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-2xl border border-[#d7b7a0]/35 bg-[#f7f2ee] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b5f4d]">
                          Destino automatico
                        </p>
                        <p className="mt-1 text-base font-semibold text-[#0a193b]">
                          {selectedMethod?.bankAccountName || "-"}
                        </p>
                        <p className="text-sm text-[#0a193b]/65">
                          {selectedMethod?.currency ? `Cuenta en ${selectedMethod.currency}` : "Sin cuenta vinculada"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label htmlFor="bankAccountId" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a193b]/60">
                        Cuenta bancaria
                      </label>
                      <select
                        id="bankAccountId"
                        value={bankAccountId}
                        onChange={(event) => setBankAccountId(event.target.value)}
                        required
                        className="min-h-14 w-full rounded-2xl border border-[#d7b7a0]/60 bg-[#fcfaf8] px-4 text-base text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:bg-white"
                      >
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} ({account.currency})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-[#d7b7a0]/40 bg-white p-4 shadow-[0_10px_24px_rgba(10,25,59,0.08)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0a193b]/55">
                  Detalle
                </p>
                <div className="mt-4 space-y-1.5">
                  <label htmlFor="description" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a193b]/60">
                    Descripcion
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Detalle corto del movimiento"
                    rows={4}
                    maxLength={220}
                    className="w-full rounded-2xl border border-[#d7b7a0]/60 bg-[#fcfaf8] px-4 py-3 text-base text-[#0a193b] outline-none transition focus:border-[#0a193b] focus:bg-white"
                  />
                </div>
              </section>

              {(error || success) && (
                <section className="space-y-3">
                  {error && (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                  {success && (
                    <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {success}
                    </p>
                  )}
                </section>
              )}

              <div className="hidden sm:block">
                <button
                  type="submit"
                  disabled={submitting || categoryOptions.length === 0}
                  className="w-full rounded-[22px] bg-[#0a193b] px-5 py-4 text-base font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-55"
                >
                  {submitting ? "Guardando..." : type === "income" ? "Registrar ingreso" : "Registrar gasto"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {!loadingOptions && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d7b7a0]/45 bg-white/92 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_28px_rgba(10,25,59,0.1)] backdrop-blur sm:hidden">
          <button
            type="submit"
            form="public-movement-form"
            disabled={submitting || categoryOptions.length === 0}
            className="w-full rounded-[20px] bg-[#0a193b] px-5 py-4 text-base font-semibold text-white transition disabled:opacity-55"
          >
            {submitting ? "Guardando..." : type === "income" ? "Registrar ingreso" : "Registrar gasto"}
          </button>
        </div>
      )}
    </main>
  );
}
