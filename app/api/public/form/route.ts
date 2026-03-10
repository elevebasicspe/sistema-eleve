import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type MovementType = "income" | "expense";

type FormPayload = {
  type?: MovementType;
  amount?: number | string;
  date?: string;
  categoryId?: string;
  paymentMethodId?: string;
  bankAccountId?: string;
  description?: string;
  registeredByName?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_REGISTERED_BY_NAME = "Larry";

function sanitizeText(value: unknown, max = 220): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function parseAmount(value: number | string | undefined): number | null {
  const numeric =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Number(numeric.toFixed(2));
}

export async function GET() {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo inicializar el cliente admin.",
      },
      { status: 500 }
    );
  }

  const [incomeCategoriesRes, expenseCategoriesRes, paymentMethodsRes, bankAccountsRes] = await Promise.all([
    supabaseAdmin
      .from("income_categories")
      .select("id,name,category_name,subcategory_name")
      .order("category_name", { ascending: true })
      .order("subcategory_name", { ascending: true }),
    supabaseAdmin
      .from("expense_categories")
      .select("id,name,category_name,subcategory_name")
      .order("category_name", { ascending: true })
      .order("subcategory_name", { ascending: true }),
    supabaseAdmin
      .from("payment_methods")
      .select("id,name,bank_account_id,bank_accounts(id,name,currency)")
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("bank_accounts")
      .select("id,name,currency,current_balance")
      .order("name", { ascending: true }),
  ]);

  if (incomeCategoriesRes.error || expenseCategoriesRes.error || paymentMethodsRes.error || bankAccountsRes.error) {
    const message =
      incomeCategoriesRes.error?.message ||
      expenseCategoriesRes.error?.message ||
      paymentMethodsRes.error?.message ||
      bankAccountsRes.error?.message ||
      "No se pudo cargar el formulario.";

    return NextResponse.json({ error: message }, { status: 500 });
  }

  const paymentMethods = (paymentMethodsRes.data ?? []).map((item) => {
    const bankAccount = Array.isArray(item.bank_accounts) ? item.bank_accounts[0] ?? null : item.bank_accounts;
    return {
      id: item.id,
      name: item.name,
      bankAccountId: item.bank_account_id,
      bankAccountName: bankAccount?.name ?? "",
      currency: bankAccount?.currency ?? "",
    };
  });

  return NextResponse.json({
    incomeCategories: incomeCategoriesRes.data ?? [],
    expenseCategories: expenseCategoriesRes.data ?? [],
    paymentMethods,
    bankAccounts: bankAccountsRes.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  let payload: FormPayload;
  try {
    payload = (await request.json()) as FormPayload;
  } catch {
    return NextResponse.json({ error: "Body JSON invalido." }, { status: 400 });
  }

  const type = payload.type;
  if (type !== "income" && type !== "expense") {
    return NextResponse.json({ error: "Tipo invalido. Usa income o expense." }, { status: 400 });
  }

  const amount = parseAmount(payload.amount);
  if (!amount) {
    return NextResponse.json({ error: "Monto invalido. Debe ser mayor a 0." }, { status: 400 });
  }

  const date = sanitizeText(payload.date, 10);
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Fecha invalida." }, { status: 400 });
  }

  const categoryId = sanitizeText(payload.categoryId, 64);
  if (!categoryId) {
    return NextResponse.json({ error: "Categoria obligatoria." }, { status: 400 });
  }

  const registeredByName =
    sanitizeText(payload.registeredByName, 80) || DEFAULT_REGISTERED_BY_NAME;

  const description = sanitizeText(payload.description);

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo inicializar el cliente admin.",
      },
      { status: 500 }
    );
  }

  if (type === "income") {
    const paymentMethodId = sanitizeText(payload.paymentMethodId, 64);
    if (!paymentMethodId) {
      return NextResponse.json({ error: "Medio de pago obligatorio para ingresos." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("incomes").insert({
      income_date: date,
      amount,
      category_id: categoryId,
      payment_method_id: paymentMethodId,
      description,
      registered_by_name: registeredByName,
      created_by_app: "OMNI AGENCIA S.A.C.",
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo registrar el ingreso." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  const bankAccountId = sanitizeText(payload.bankAccountId, 64);
  if (!bankAccountId) {
    return NextResponse.json({ error: "Cuenta obligatoria para gastos." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("expenses").insert({
    expense_date: date,
    amount,
    category_id: categoryId,
    bank_account_id: bankAccountId,
    description,
    registered_by_name: registeredByName,
    created_by_app: "OMNI AGENCIA S.A.C.",
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "No se pudo registrar el gasto." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
