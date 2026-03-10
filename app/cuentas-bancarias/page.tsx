"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CuentasBancariasSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import { useProtectedSession } from "@/lib/auth/use-protected-session";
import { supabase } from "@/lib/supabase/client";

type BankAccount = {
  id: string;
  name: string;
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  cci: string | null;
  currency: string;
  holder_name: string | null;
  holder_dni: string | null;
  current_balance?: number | string | null;
  created_at: string;
};

type PaymentMethod = {
  id: string;
  name: string;
  bank_account_id: string;
  created_at: string;
  bank_accounts: {
    id: string;
    name: string;
    currency: string;
  } | null;
};

type RawPaymentMethod = {
  id: string;
  name: string;
  bank_account_id: string;
  created_at: string;
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

const BANK_OPTIONS = ["BCP", "Interbank", "Scotiabank", "BBVA", "Banbif", "Santander"] as const;
const ACCOUNT_TYPE_OPTIONS = ["Ahorros", "Corriente"] as const;
const CURRENCY_OPTIONS = ["PEN", "USD", "EUR"] as const;

type OptionMode = "preset" | "other";

type AccountFormState = {
  name: string;
  initialBalance: string;
  bankMode: OptionMode;
  bankPreset: string;
  bankOther: string;
  typeMode: OptionMode;
  typePreset: string;
  typeOther: string;
  accountNumber: string;
  cci: string;
  currencyMode: OptionMode;
  currencyPreset: string;
  currencyOther: string;
  holderName: string;
  holderDni: string;
};

type AdjustmentMode = "add" | "subtract";

const INITIAL_FORM: AccountFormState = {
  name: "",
  initialBalance: "0",
  bankMode: "preset",
  bankPreset: "BCP",
  bankOther: "",
  typeMode: "preset",
  typePreset: "Ahorros",
  typeOther: "",
  accountNumber: "",
  cci: "",
  currencyMode: "preset",
  currencyPreset: "PEN",
  currencyOther: "",
  holderName: "",
  holderDni: "",
};

function onlyDigits(value: string) {
  return value.replace(/\D+/g, "");
}

function normalizeDecimal(value: string) {
  return value.replace(",", ".").trim();
}

function formatBalance(value: number | string | null | undefined, currency: string) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;

  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: currency || "PEN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue);
  } catch {
    return `${safeValue.toFixed(2)} ${currency || "PEN"}`;
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function OptionGroup({
  title,
  mode,
  onModeChange,
  preset,
  onPresetChange,
  presets,
  otherValue,
  onOtherChange,
  otherMaxLength,
}: {
  title: string;
  mode: OptionMode;
  onModeChange: (value: OptionMode) => void;
  preset: string;
  onPresetChange: (value: string) => void;
  presets: readonly string[];
  otherValue: string;
  onOtherChange: (value: string) => void;
  otherMaxLength: number;
}) {
  const SELECT_OTHER_VALUE = "__other__";
  const selectValue = mode === "other" ? SELECT_OTHER_VALUE : preset;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[#0a193b]">{title}</legend>
      <select
        value={selectValue}
        onChange={(event) => {
          const value = event.target.value;
          if (value === SELECT_OTHER_VALUE) {
            onModeChange("other");
            return;
          }
          onModeChange("preset");
          onPresetChange(value);
        }}
        className="w-full rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
      >
        {presets.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={SELECT_OTHER_VALUE}>Otro...</option>
      </select>

      {mode === "other" && (
        <input
          type="text"
          maxLength={otherMaxLength}
          value={otherValue}
          onChange={(event) => onOtherChange(event.target.value)}
          placeholder={`Escribe otro (max ${otherMaxLength})`}
          className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
        />
      )}
    </fieldset>
  );
}

export default function CuentasBancariasPage() {
  const { loading, profile, isManager } = useProtectedSession();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPaymentMethod, setIsSavingPaymentMethod] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingPaymentMethodId, setDeletingPaymentMethodId] = useState<string | null>(null);
  const [paymentMethodName, setPaymentMethodName] = useState("");
  const [paymentMethodBankAccountId, setPaymentMethodBankAccountId] = useState("");
  const [transferOriginId, setTransferOriginId] = useState("");
  const [transferDestinationId, setTransferDestinationId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode>("add");
  const [adjustmentAccountId, setAdjustmentAccountId] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentDescription, setAdjustmentDescription] = useState("");
  const [form, setForm] = useState<AccountFormState>(INITIAL_FORM);

  const loadAccounts = async () => {
    const { data, error: queryError } = await supabase
      .from("bank_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(`No se pudo cargar cuentas bancarias: ${queryError.message}`);
      return;
    }

    setAccounts((data ?? []) as BankAccount[]);
  };

  const loadPaymentMethods = async () => {
    const { data, error: queryError } = await supabase
      .from("payment_methods")
      .select("id,name,bank_account_id,created_at,bank_accounts(id,name,currency)")
      .order("name", { ascending: true });

    if (queryError) {
      setError(`No se pudo cargar medios de pago: ${queryError.message}`);
      return;
    }

    const normalized = ((data ?? []) as RawPaymentMethod[]).map((item) => ({
      ...item,
      bank_accounts: Array.isArray(item.bank_accounts)
        ? item.bank_accounts[0] ?? null
        : item.bank_accounts,
    }));

    setPaymentMethods(normalized as PaymentMethod[]);
  };

  useEffect(() => {
    if (loading || !profile) return;
    const timer = window.setTimeout(() => {
      void Promise.all([loadAccounts(), loadPaymentMethods()]);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading, profile]);

  const cashAccount = useMemo(
    () => accounts.find((account) => account.name.trim().toLowerCase() === "efectivo"),
    [accounts]
  );
  const totalBalance = useMemo(
    () =>
      accounts.reduce((sum, account) => {
        const parsed =
          typeof account.current_balance === "number"
            ? account.current_balance
            : Number(account.current_balance ?? 0);
        return sum + (Number.isFinite(parsed) ? parsed : 0);
      }, 0),
    [accounts]
  );

  const resolvedBankName = useMemo(
    () => (form.bankMode === "preset" ? form.bankPreset : form.bankOther.trim()),
    [form.bankMode, form.bankPreset, form.bankOther]
  );

  const resolvedAccountType = useMemo(
    () => (form.typeMode === "preset" ? form.typePreset : form.typeOther.trim()),
    [form.typeMode, form.typePreset, form.typeOther]
  );

  const resolvedCurrency = useMemo(
    () =>
      form.currencyMode === "preset"
        ? form.currencyPreset
        : form.currencyOther.trim().toUpperCase(),
    [form.currencyMode, form.currencyPreset, form.currencyOther]
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const name = form.name.trim();
    const initialBalanceRaw = normalizeDecimal(form.initialBalance);
    const holderName = form.holderName.trim();
    const accountNumber = form.accountNumber.trim();
    const cci = form.cci.trim();
    const holderDni = form.holderDni.trim();
    const initialBalance = Number(initialBalanceRaw);

    if (!name || name.length > 15) {
      setError("Nombre es obligatorio y maximo 15 caracteres.");
      return;
    }

    if (!resolvedBankName || resolvedBankName.length > 15) {
      setError("Banco es obligatorio y maximo 15 caracteres.");
      return;
    }

    if (!resolvedAccountType || resolvedAccountType.length > 15) {
      setError("Tipo de cuenta es obligatorio y maximo 15 caracteres.");
      return;
    }

    if (!resolvedCurrency || resolvedCurrency.length > 6) {
      setError("Divisa es obligatoria y maximo 6 caracteres.");
      return;
    }

    if (!/^\d+$/.test(accountNumber)) {
      setError("Numero de cuenta debe contener solo numeros.");
      return;
    }

    if (!/^\d+$/.test(cci)) {
      setError("CCI debe contener solo numeros.");
      return;
    }

    if (!holderName) {
      setError("Titular es obligatorio.");
      return;
    }

    if (!/^\d{8}$/.test(holderDni)) {
      setError("DNI debe tener 8 digitos.");
      return;
    }

    if (!Number.isFinite(initialBalance)) {
      setError("Saldo inicial debe ser un numero valido.");
      return;
    }

    setIsSaving(true);
    const { error: insertError } = await supabase.from("bank_accounts").insert({
      name,
      current_balance: initialBalance,
      bank_name: resolvedBankName,
      account_type: resolvedAccountType,
      account_number: accountNumber,
      cci,
      currency: resolvedCurrency,
      holder_name: holderName,
      holder_dni: holderDni,
      created_by: profile?.id ?? null,
    });

    if (insertError) {
      setIsSaving(false);
      if (insertError.code === "23505") {
        setError("El nombre ya existe. Debe ser unico e irrepetible.");
      } else {
        setError(`No se pudo registrar la cuenta: ${insertError.message}`);
      }
      return;
    }

    setIsSaving(false);
    setIsModalOpen(false);
    setForm(INITIAL_FORM);
    setSuccess("Cuenta bancaria registrada.");
    await loadAccounts();
  };

  const onDeleteAccount = async (account: BankAccount) => {
    if (!isManager) return;
    if (account.name.trim().toLowerCase() === "efectivo") {
      setError('La cuenta "Efectivo" es base del sistema y no se puede borrar.');
      return;
    }

    const confirmed = window.confirm(
      `Vas a borrar la cuenta bancaria "${account.name}". Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    setDeletingId(account.id);

    const { error: deleteError } = await supabase.from("bank_accounts").delete().eq("id", account.id);

    setDeletingId(null);

    if (deleteError) {
      setError(`No se pudo borrar la cuenta: ${deleteError.message}`);
      return;
    }

    setAccounts((current) => current.filter((item) => item.id !== account.id));
    setSuccess(`Cuenta bancaria "${account.name}" eliminada.`);
  };

  const onCreateCashAccount = async () => {
    if (!isManager) return;
    if (cashAccount) {
      setSuccess('La cuenta "Efectivo" ya existe.');
      return;
    }

    setError(null);
    setSuccess(null);

    const { error: insertError } = await supabase.from("bank_accounts").insert({
      name: "Efectivo",
      current_balance: 0,
      bank_name: null,
      account_type: "Efectivo",
      account_number: null,
      cci: null,
      currency: "PEN",
      holder_name: null,
      holder_dni: null,
      created_by: profile?.id ?? null,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        setSuccess('La cuenta "Efectivo" ya existe.');
      } else {
        setError(
          `No se pudo crear la cuenta Efectivo: ${insertError.message}. Si persiste, ejecuta el SQL actualizado.`
        );
      }
      return;
    }

    setSuccess('Cuenta "Efectivo" creada.');
    await loadAccounts();
  };

  const onSubmitPaymentMethod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isManager) return;

    setError(null);
    setSuccess(null);

    const name = paymentMethodName.trim();
    const bankAccountId = paymentMethodBankAccountId || accounts[0]?.id || "";

    if (!name || name.length > 30) {
      setError("El nombre del medio de pago es obligatorio (max 30 caracteres).");
      return;
    }

    if (!bankAccountId) {
      setError("Selecciona una cuenta vinculada.");
      return;
    }

    setIsSavingPaymentMethod(true);

    const { error: insertError } = await supabase.from("payment_methods").insert({
      name,
      bank_account_id: bankAccountId,
      created_by: profile?.id ?? null,
    });

    setIsSavingPaymentMethod(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("Ese medio de pago ya existe.");
      } else {
        setError(`No se pudo registrar medio de pago: ${insertError.message}`);
      }
      return;
    }

    setPaymentMethodName("");
    setPaymentMethodBankAccountId("");
    setIsPaymentMethodModalOpen(false);
    setSuccess("Medio de pago registrado.");
    await loadPaymentMethods();
  };

  const onDeletePaymentMethod = async (method: PaymentMethod) => {
    if (!isManager) return;

    const confirmed = window.confirm(
      `Vas a borrar el medio de pago "${method.name}". Esta accion no se puede deshacer.`
    );
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    setDeletingPaymentMethodId(method.id);

    const { error: deleteError } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", method.id);

    setDeletingPaymentMethodId(null);

    if (deleteError) {
      setError(`No se pudo borrar medio de pago: ${deleteError.message}`);
      return;
    }

    setPaymentMethods((current) => current.filter((item) => item.id !== method.id));
    setSuccess(`Medio de pago "${method.name}" eliminado.`);
  };

  const openTransferModal = () => {
    if (!accounts.length) return;
    const origin = accounts[0]?.id ?? "";
    const destination =
      accounts.find((account) => account.id !== origin)?.id ?? accounts[0]?.id ?? "";

    setTransferOriginId(origin);
    setTransferDestinationId(destination);
    setTransferAmount("");
    setTransferDescription("");
    setIsTransferModalOpen(true);
  };

  const openAdjustModal = () => {
    if (!accounts.length) return;
    setAdjustmentMode("add");
    setAdjustmentAccountId(accounts[0]?.id ?? "");
    setAdjustmentAmount("");
    setAdjustmentDescription("");
    setIsAdjustModalOpen(true);
  };

  const onSubmitTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isManager) return;

    setError(null);
    setSuccess(null);

    const amount = Number(normalizeDecimal(transferAmount));
    if (!transferOriginId || !transferDestinationId) {
      setError("Selecciona origen y destino.");
      return;
    }

    if (transferOriginId === transferDestinationId) {
      setError("Origen y destino deben ser diferentes.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Monto invalido para transferir.");
      return;
    }

    setIsSavingTransfer(true);

    const { error: rpcError } = await supabase.rpc("transfer_bank_balance", {
      p_origin_account_id: transferOriginId,
      p_destination_account_id: transferDestinationId,
      p_amount: amount,
      p_description: transferDescription.trim() || null,
    });

    setIsSavingTransfer(false);

    if (rpcError) {
      setError(`No se pudo transferir: ${rpcError.message}`);
      return;
    }

    setIsTransferModalOpen(false);
    setTransferAmount("");
    setTransferDescription("");
    setSuccess("Transferencia registrada.");
    await loadAccounts();
  };

  const onSubmitAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isManager) return;

    setError(null);
    setSuccess(null);

    const amount = Number(normalizeDecimal(adjustmentAmount));
    if (!adjustmentAccountId) {
      setError("Selecciona una cuenta para ajustar.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Monto invalido para ajustar.");
      return;
    }

    setIsSavingAdjustment(true);

    const { error: rpcError } = await supabase.rpc("adjust_bank_balance", {
      p_bank_account_id: adjustmentAccountId,
      p_adjustment_type: adjustmentMode,
      p_amount: amount,
      p_description: adjustmentDescription.trim() || null,
    });

    setIsSavingAdjustment(false);

    if (rpcError) {
      setError(`No se pudo ajustar saldo: ${rpcError.message}`);
      return;
    }

    setIsAdjustModalOpen(false);
    setAdjustmentAmount("");
    setAdjustmentDescription("");
    setSuccess(
      adjustmentMode === "add" ? "Ajuste de suma registrado." : "Ajuste de resta registrado."
    );
    await loadAccounts();
  };

  if (loading || !profile) return <CuentasBancariasSkeleton />;

  return (
    <PanelShell
      title="Cuentas bancarias"
      subtitle="Gestiona las cuentas bancarias que usara ELEVE."
      profile={profile}
      actions={
        isManager ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white"
            >
              Registrar cuenta bancaria
            </button>
            <button
              type="button"
              onClick={() => {
                if (!paymentMethodBankAccountId && accounts.length > 0) {
                  setPaymentMethodBankAccountId(accounts[0].id);
                }
                setIsPaymentMethodModalOpen(true);
              }}
              disabled={accounts.length === 0}
              className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b] disabled:opacity-60"
            >
              Registrar medio de pago
            </button>
            <button
              type="button"
              onClick={() => void onCreateCashAccount()}
              className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]"
            >
              Crear cuenta Efectivo
            </button>
            <button
              type="button"
              onClick={openTransferModal}
              disabled={accounts.length < 2}
              className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b] disabled:opacity-60"
            >
              Transferir
            </button>
            <button
              type="button"
              onClick={openAdjustModal}
              disabled={accounts.length === 0}
              className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b] disabled:opacity-60"
            >
              Ajustar
            </button>
          </div>
        ) : undefined
      }
    >
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
        <p className="text-sm text-[#0a193b]/70">Saldo total (todas las cuentas)</p>
        <p className="mt-2 text-3xl font-bold text-[#0a193b]">S/ {formatNumber(totalBalance)}</p>
      </section>

      <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
        <div className="overflow-x-auto rounded-lg border border-[#d7b7a0]/35">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f4ede7] text-[#0a193b]">
              <tr>
                <th className="px-3 py-2 font-semibold">Nombre</th>
                <th className="px-3 py-2 text-right font-semibold">Saldo actual</th>
                <th className="px-3 py-2 font-semibold">Banco</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">Nro cuenta</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">CCI</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">Divisa</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">Titular</th>
                <th className="hidden px-3 py-2 font-semibold sm:table-cell">DNI</th>
                <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90">
                  <td className="px-3 py-2 font-semibold">{account.name}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#0a193b]">
                    {formatBalance(account.current_balance, account.currency)}
                  </td>
                  <td className="px-3 py-2">{account.bank_name || "-"}</td>
                  <td className="px-3 py-2">{account.account_type || "-"}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{account.account_number || "-"}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{account.cci || "-"}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{account.currency}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{account.holder_name || "-"}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{account.holder_dni || "-"}</td>
                  <td className="hidden px-3 py-2 text-center sm:table-cell">
                    {isManager ? (
                      <button
                        type="button"
                        onClick={() => void onDeleteAccount(account)}
                        disabled={deletingId === account.id || account.name.trim().toLowerCase() === "efectivo"}
                        className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        {account.name.trim().toLowerCase() === "efectivo"
                          ? "Protegida"
                          : deletingId === account.id
                          ? "Borrando..."
                          : "Borrar"}
                      </button>
                    ) : (
                      <span className="text-xs text-[#0a193b]/45">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-sm text-[#0a193b]/70">
                    No hay cuentas bancarias registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
        <h2 className="mb-4 text-xl font-semibold text-[#0a193b]">Medios de pago</h2>
        <div className="overflow-x-auto rounded-lg border border-[#d7b7a0]/35">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f4ede7] text-[#0a193b]">
              <tr>
                <th className="px-3 py-2 font-semibold">Nombre</th>
                <th className="px-3 py-2 font-semibold">Cuenta vinculada</th>
                <th className="px-3 py-2 font-semibold">Divisa</th>
                <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.map((method) => (
                <tr key={method.id} className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90">
                  <td className="px-3 py-2 font-semibold">{method.name}</td>
                  <td className="px-3 py-2">{method.bank_accounts?.name || "-"}</td>
                  <td className="px-3 py-2">{method.bank_accounts?.currency || "-"}</td>
                  <td className="hidden px-3 py-2 text-center sm:table-cell">
                    {isManager ? (
                      <button
                        type="button"
                        onClick={() => void onDeletePaymentMethod(method)}
                        disabled={deletingPaymentMethodId === method.id}
                        className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        {deletingPaymentMethodId === method.id ? "Borrando..." : "Borrar"}
                      </button>
                    ) : (
                      <span className="text-xs text-[#0a193b]/45">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {paymentMethods.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-[#0a193b]/70">
                    No hay medios de pago registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#d7b7a0]/55 bg-white p-5 shadow-[0_20px_45px_rgba(10,25,59,0.3)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#0a193b]">Registrar cuenta bancaria</h2>
                <p className="mt-1 text-sm text-[#0a193b]/70">
                  El nombre es unico e irrepetible y funcionara como identificador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md border border-[#d7b7a0]/60 px-2 py-1 text-sm text-[#0a193b]"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="name">
                  Nombre (max 15)
                </label>
                <input
                  id="name"
                  type="text"
                  maxLength={15}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="inversion, gastos, cobros..."
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="initialBalance">
                  Saldo inicial
                </label>
                <input
                  id="initialBalance"
                  inputMode="decimal"
                  value={form.initialBalance}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, initialBalance: event.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                />
              </div>

              <OptionGroup
                title="Banco"
                mode={form.bankMode}
                onModeChange={(value) => setForm((current) => ({ ...current, bankMode: value }))}
                preset={form.bankPreset}
                onPresetChange={(value) => setForm((current) => ({ ...current, bankPreset: value }))}
                presets={BANK_OPTIONS}
                otherValue={form.bankOther}
                onOtherChange={(value) => setForm((current) => ({ ...current, bankOther: value.slice(0, 15) }))}
                otherMaxLength={15}
              />

              <OptionGroup
                title="Tipo de cuenta"
                mode={form.typeMode}
                onModeChange={(value) => setForm((current) => ({ ...current, typeMode: value }))}
                preset={form.typePreset}
                onPresetChange={(value) => setForm((current) => ({ ...current, typePreset: value }))}
                presets={ACCOUNT_TYPE_OPTIONS}
                otherValue={form.typeOther}
                onOtherChange={(value) => setForm((current) => ({ ...current, typeOther: value.slice(0, 15) }))}
                otherMaxLength={15}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="accountNumber">
                    Numero de cuenta
                  </label>
                  <input
                    id="accountNumber"
                    inputMode="numeric"
                    value={form.accountNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        accountNumber: onlyDigits(event.target.value),
                      }))
                    }
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="cci">
                    CCI
                  </label>
                  <input
                    id="cci"
                    inputMode="numeric"
                    value={form.cci}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, cci: onlyDigits(event.target.value) }))
                    }
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
              </div>

              <OptionGroup
                title="Divisa"
                mode={form.currencyMode}
                onModeChange={(value) => setForm((current) => ({ ...current, currencyMode: value }))}
                preset={form.currencyPreset}
                onPresetChange={(value) => setForm((current) => ({ ...current, currencyPreset: value }))}
                presets={CURRENCY_OPTIONS}
                otherValue={form.currencyOther}
                onOtherChange={(value) =>
                  setForm((current) => ({ ...current, currencyOther: value.slice(0, 6) }))
                }
                otherMaxLength={6}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="holderName">
                    Titular
                  </label>
                  <input
                    id="holderName"
                    type="text"
                    value={form.holderName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, holderName: event.target.value }))
                    }
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="holderDni">
                    DNI (8 digitos)
                  </label>
                  <input
                    id="holderDni"
                    inputMode="numeric"
                    maxLength={8}
                    value={form.holderDni}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        holderDni: onlyDigits(event.target.value).slice(0, 8),
                      }))
                    }
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
                >
                  {isSaving ? "Guardando..." : "Registrar cuenta bancaria"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-[#d7b7a0]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[#0a193b]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/55 bg-white p-5 shadow-[0_20px_45px_rgba(10,25,59,0.3)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#0a193b]">Registrar medio de pago</h2>
                <p className="mt-1 text-sm text-[#0a193b]/70">
                  Vincula un medio de cobro a una cuenta bancaria.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentMethodModalOpen(false)}
                className="rounded-md border border-[#d7b7a0]/60 px-2 py-1 text-sm text-[#0a193b]"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={onSubmitPaymentMethod}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="paymentMethodName">
                  Nombre del medio de pago
                </label>
                <input
                  id="paymentMethodName"
                  type="text"
                  maxLength={30}
                  value={paymentMethodName}
                  onChange={(event) => setPaymentMethodName(event.target.value)}
                  placeholder="Yape, Transferencia, POS..."
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="paymentMethodAccount">
                  Cuenta vinculada
                </label>
                <select
                  id="paymentMethodAccount"
                  value={paymentMethodBankAccountId || accounts[0]?.id || ""}
                  onChange={(event) => setPaymentMethodBankAccountId(event.target.value)}
                  className="w-full rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSavingPaymentMethod || accounts.length === 0}
                  className="rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
                >
                  {isSavingPaymentMethod ? "Guardando..." : "Registrar medio de pago"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaymentMethodModalOpen(false)}
                  className="rounded-lg border border-[#d7b7a0]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[#0a193b]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/55 bg-white p-5 shadow-[0_20px_45px_rgba(10,25,59,0.3)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#0a193b]">Transferir saldo</h2>
                <p className="mt-1 text-sm text-[#0a193b]/70">
                  Mueve dinero entre cuentas bancarias o efectivo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="rounded-md border border-[#d7b7a0]/60 px-2 py-1 text-sm text-[#0a193b]"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={onSubmitTransfer}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="transferOrigin">
                  Origen
                </label>
                <select
                  id="transferOrigin"
                  value={transferOriginId}
                  onChange={(event) => setTransferOriginId(event.target.value)}
                  className="w-full rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="transferDestination">
                  Destino
                </label>
                <select
                  id="transferDestination"
                  value={transferDestinationId}
                  onChange={(event) => setTransferDestinationId(event.target.value)}
                  className="w-full rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="transferAmount">
                  Monto
                </label>
                <input
                  id="transferAmount"
                  inputMode="decimal"
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="transferDescription">
                  Detalle
                </label>
                <textarea
                  id="transferDescription"
                  rows={3}
                  maxLength={180}
                  value={transferDescription}
                  onChange={(event) => setTransferDescription(event.target.value)}
                  placeholder="Descripcion breve"
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSavingTransfer || accounts.length < 2}
                  className="rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
                >
                  {isSavingTransfer ? "Transfiriendo..." : "Transferir"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="rounded-lg border border-[#d7b7a0]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[#0a193b]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/55 bg-white p-5 shadow-[0_20px_45px_rgba(10,25,59,0.3)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#0a193b]">Ajustar saldo</h2>
                <p className="mt-1 text-sm text-[#0a193b]/70">
                  Suma o resta saldo manualmente a una cuenta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="rounded-md border border-[#d7b7a0]/60 px-2 py-1 text-sm text-[#0a193b]"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={onSubmitAdjustment}>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#f6ebe3] p-1">
                <button
                  type="button"
                  onClick={() => setAdjustmentMode("add")}
                  className={
                    adjustmentMode === "add"
                      ? "rounded-md bg-[#0a193b] px-3 py-2 text-sm font-semibold text-white"
                      : "rounded-md px-3 py-2 text-sm font-semibold text-[#0a193b]"
                  }
                >
                  Sumar
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentMode("subtract")}
                  className={
                    adjustmentMode === "subtract"
                      ? "rounded-md bg-[#0a193b] px-3 py-2 text-sm font-semibold text-white"
                      : "rounded-md px-3 py-2 text-sm font-semibold text-[#0a193b]"
                  }
                >
                  Restar
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="adjustmentAccount">
                  Cuenta
                </label>
                <select
                  id="adjustmentAccount"
                  value={adjustmentAccountId}
                  onChange={(event) => setAdjustmentAccountId(event.target.value)}
                  className="w-full rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="adjustmentAmount">
                  Monto
                </label>
                <input
                  id="adjustmentAmount"
                  inputMode="decimal"
                  value={adjustmentAmount}
                  onChange={(event) => setAdjustmentAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="adjustmentDescription">
                  Descripcion
                </label>
                <textarea
                  id="adjustmentDescription"
                  rows={3}
                  maxLength={180}
                  value={adjustmentDescription}
                  onChange={(event) => setAdjustmentDescription(event.target.value)}
                  placeholder="Descripcion breve"
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSavingAdjustment || accounts.length === 0}
                  className="rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
                >
                  {isSavingAdjustment ? "Guardando..." : "Aplicar ajuste"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
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
