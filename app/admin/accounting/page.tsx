import Link from "next/link";
import { getDepositBatchRows } from "@/lib/accounting/statements";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import HebrewKeyboardField from "../HebrewKeyboardField";
import { QuickChargeMemberPicker } from "../QuickChargeMemberPicker";
import ManualPaymentForm from "./ManualPaymentForm";
import {
  addExpense,
  addZellePayment,
  approveZellePayment,
  createPaidChargeFromZelle,
  deleteExpense,
  generateRecurringExpenses,
  importAccountingCsv,
  saveBankSnapshot,
  saveRecurringExpenseTemplate,
  updateExpense,
  uploadExpenseReceipt,
} from "./actions";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  autopay_active: boolean | null;
  recurring_amount: number | null;
  sola_recurring_id: string | null;
};

type Charge = {
  id: string;
  member_id: string;
  amount: number;
  status: string | null;
  paid_amount: number | null;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  description: string | null;
};

type YearlyDuesCharge = {
  amount: number;
  status: string | null;
  paid_amount: number | null;
  billing_month: number | null;
};

type AccountingRow = {
  member: Member;
  charge: Charge | null;
};

type PageProps = {
  searchParams?: Promise<{
    month?: string;
    year?: string;
    view?: string;
  status?: string;
    depositEnd?: string;
    depositStart?: string;
    accountingError?: string;
    expenseAdded?: string;
    zelleAdded?: string;
    paymentAdded?: string;
    recurringGenerated?: string;
    recurringSaved?: string;
    created?: string;
    skipped?: string;
    payments?: string;
    bankError?: string;
    bankSaved?: string;
  }>;
};

type Expense = {
  id: string;
  vendor: string;
  category: string | null;
  amount: number;
  expense_date: string | null;
  note: string | null;
  receipt_url: string | null;
  recurring_template_id: string | null;
};

type RecurringExpenseTemplate = {
  id: string;
  vendor: string;
  category: string | null;
  amount: number;
  frequency: string | null;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean | null;
  note: string | null;
};

type BankSnapshot = {
  id: string;
  balance: number;
  snapshot_date: string;
  note: string | null;
  created_at: string | null;
};

type ZellePayment = {
  id: string;
  payer_name: string;
  payer_email: string | null;
  amount: number;
  received_date: string | null;
  purpose: string | null;
  note: string | null;
  status: string | null;
};

type Payment = {
  id: string;
  amount: number;
  payment_method: string | null;
  payment_provider: string | null;
  status: string | null;
  paid_at: string | null;
  payer_email: string | null;
  note: string | null;
  members:
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }[]
    | null;
  member_charges:
    | {
        charge_type: string | null;
        description: string | null;
      }
    | {
        charge_type: string | null;
        description: string | null;
      }[]
    | null;
};

type OpenChargeOption = {
  id: string;
  amount: number;
  paid_amount: number | null;
  charge_type: string | null;
  description: string | null;
  due_date: string | null;
  members:
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }[]
    | null;
};

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function receiptHref(expense: Expense) {
  if (!expense.receipt_url) return "#";
  if (/^https?:\/\//i.test(expense.receipt_url)) {
    return expense.receipt_url;
  }

  return `/api/accounting/receipts/${expense.id}`;
}

function getMonthName(month: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(new Date(2026, month - 1, 1));
}

function getDateMonth(value: string | null | undefined) {
  if (!value) return null;

  const dateOnlyMatch = value.match(/^\d{4}-(\d{2})-/);
  if (dateOnlyMatch) {
    return Number(dateOnlyMatch[1]);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getMonth() + 1;
}

function dateRange(month: number | null, year: number) {
  const start = month
    ? `${year}-${String(month).padStart(2, "0")}-01`
    : `${year}-01-01`;
  const end =
    month && month < 12
      ? `${year}-${String(month + 1).padStart(2, "0")}-01`
      : `${year + 1}-01-01`;

  return { start, end };
}

function getMonthDateRange(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end =
    month < 12
      ? `${year}-${String(month + 1).padStart(2, "0")}-01`
      : `${year + 1}-01-01`;

  return { start, end };
}

function isDateString(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function getOpenChargeMember(charge: OpenChargeOption) {
  return Array.isArray(charge.members) ? charge.members[0] : charge.members;
}

function getOpenChargeLabel(charge: OpenChargeOption) {
  const member = getOpenChargeMember(charge);
  const memberName = [member?.last_name, member?.first_name]
    .filter(Boolean)
    .join(", ");
  const balance = Math.max(
    0,
    Number(charge.amount || 0) - Number(charge.paid_amount || 0)
  );

  return [
    memberName || "Unknown member",
    formatMoney(balance || charge.amount),
    charge.charge_type || "Charge",
    charge.description || "",
  ]
    .filter(Boolean)
    .join(" - ");
}

function getPaymentMember(payment: Payment) {
  return Array.isArray(payment.members) ? payment.members[0] : payment.members;
}

function getPaymentCharge(payment: Payment) {
  return Array.isArray(payment.member_charges)
    ? payment.member_charges[0]
    : payment.member_charges;
}

function getPaymentPayerName(payment: Payment) {
  const member = getPaymentMember(payment);
  return (
    [member?.first_name, member?.last_name].filter(Boolean).join(" ").trim() ||
    member?.email ||
    payment.payer_email ||
    "Unknown payer"
  );
}

async function getAccountingRows(
  month: number,
  year: number
): Promise<AccountingRow[]> {
  const { data: members, error: membersError } = await supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, email, autopay_active, recurring_amount, sola_recurring_id"
    )
    .eq("status", "active")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (membersError) {
    console.error("Unable to load members:", membersError.message);
    return [];
  }

  const typedMembers = (members || []) as Member[];

  const { data: charges, error: chargesError } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, member_id, amount, status, paid_amount, due_date, paid_at, payment_method, description"
    )
    .eq("charge_type", "Membership Dues")
    .eq("billing_month", month)
    .eq("billing_year", year);

  if (chargesError) {
    console.error("Unable to load dues charges:", chargesError.message);

    return typedMembers.map((member) => ({
      member,
      charge: null,
    }));
  }

  const chargeMap = new Map(
    ((charges || []) as Charge[]).map((charge) => [
      charge.member_id,
      charge,
    ])
  );

  return typedMembers.map((member) => ({
    member,
    charge: chargeMap.get(member.id) || null,
  }));
}

async function getYearlyDuesCharges(year: number): Promise<YearlyDuesCharge[]> {
  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select("amount, status, paid_amount, billing_month")
    .eq("charge_type", "Membership Dues")
    .eq("billing_year", year);

  if (error) {
    console.error("Unable to load yearly dues charges:", error.message);
    return [];
  }

  return (data || []) as YearlyDuesCharge[];
}

async function getExpenses(
  month: number | null,
  year: number
): Promise<{
  rows: Expense[];
  error: string | null;
}> {
  const range = dateRange(month, year);
  const { data, error } = await supabaseAdmin
    .from("accounting_expenses")
    .select(
      "id, vendor, category, amount, expense_date, note, receipt_url, recurring_template_id"
    )
    .gte("expense_date", range.start)
    .lt("expense_date", range.end)
    .order("expense_date", { ascending: false })
    .limit(200);

  if (error) {
    return {
      rows: [],
      error: error.message,
    };
  }

  return {
    rows: (data || []) as Expense[],
    error: null,
  };
}

async function getRecurringExpenseTemplates(): Promise<{
  rows: RecurringExpenseTemplate[];
  error: string | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("accounting_recurring_expenses")
    .select(
      "id, vendor, category, amount, frequency, day_of_month, day_of_week, start_date, end_date, active, note"
    )
    .order("active", { ascending: false })
    .order("vendor", { ascending: true });

  if (error) {
    return {
      rows: [],
      error: error.message,
    };
  }

  return {
    rows: (data || []) as RecurringExpenseTemplate[],
    error: null,
  };
}

async function getZellePayments(
  month: number | null,
  year: number
): Promise<{
  rows: ZellePayment[];
  error: string | null;
}> {
  const range = dateRange(month, year);
  const { data, error } = await supabaseAdmin
    .from("zelle_payments")
    .select(
      "id, payer_name, payer_email, amount, received_date, purpose, note, status"
    )
    .gte("received_date", range.start)
    .lt("received_date", range.end)
    .order("received_date", { ascending: false })
    .limit(200);

  if (error) {
    return {
      rows: [],
      error: error.message,
    };
  }

  return {
    rows: (data || []) as ZellePayment[],
    error: null,
  };
}

async function getPayments(
  month: number | null,
  year: number
): Promise<{
  rows: Payment[];
  error: string | null;
}> {
  const range = dateRange(month, year);
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select(
      "id, amount, payment_method, payment_provider, status, paid_at, payer_email, note, members(id, first_name, last_name, email), member_charges(charge_type, description)"
    )
    .eq("status", "paid")
    .gte("paid_at", range.start)
    .lt("paid_at", range.end)
    .order("paid_at", { ascending: false })
    .limit(500);

  if (error) {
    return {
      rows: [],
      error: error.message,
    };
  }

  return {
    rows: (data || []) as Payment[],
    error: null,
  };
}

async function getLatestBankSnapshot(): Promise<{
  row: BankSnapshot | null;
  error: string | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("accounting_bank_snapshots")
    .select("id, balance, snapshot_date, note, created_at")
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      row: null,
      error: error.message,
    };
  }

  return {
    row: (data as BankSnapshot | null) || null,
    error: null,
  };
}

async function getCashActivitySince(startDate: string | null | undefined) {
  if (!startDate) {
    return {
      payments: 0,
      expenses: 0,
    };
  }

  const [paymentsResult, expensesResult] = await Promise.all([
    supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("status", "paid")
      .gte("paid_at", `${startDate}T00:00:00.000Z`),
    supabaseAdmin
      .from("accounting_expenses")
      .select("amount")
      .gte("expense_date", startDate),
  ]);

  return {
    payments: (paymentsResult.data || []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    ),
    expenses: (expensesResult.data || []).reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    ),
  };
}

async function getOpenChargeOptions(): Promise<OpenChargeOption[]> {
  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, amount, paid_amount, charge_type, description, due_date, members(id, first_name, last_name, email)"
    )
    .neq("status", "paid")
    .order("due_date", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Unable to load open charges:", error.message);
    return [];
  }

  return (data || []) as OpenChargeOption[];
}

export default async function AccountingPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const now = new Date();

  const requestedMonth = Number(query?.month || now.getMonth() + 1);
  const requestedYear = Number(query?.year || now.getFullYear());

  const selectedMonth =
    Number.isFinite(requestedMonth) &&
    requestedMonth >= 1 &&
    requestedMonth <= 12
      ? requestedMonth
      : now.getMonth() + 1;

  const selectedYear =
    Number.isFinite(requestedYear) && requestedYear >= 2026
      ? requestedYear
      : now.getFullYear();

  const selectedStatus = query?.status || "all";
  const activeView = query?.view || "monthly";
  const selectedMonthRange = getMonthDateRange(selectedMonth, selectedYear);
  const depositStart = isDateString(query?.depositStart)
    ? String(query?.depositStart)
    : selectedMonthRange.start;
  const depositEnd = isDateString(query?.depositEnd)
    ? String(query?.depositEnd)
    : selectedMonthRange.end;
  const selectedMonthStart = `${selectedYear}-${String(selectedMonth).padStart(
    2,
    "0"
  )}-01`;

  const [
    rows,
    expensesResult,
    recurringTemplatesResult,
    zelleResult,
    paymentsResult,
    yearlyExpenses,
    yearlyZelle,
    yearlyPayments,
    yearlyDuesCharges,
    openChargeOptions,
    bankSnapshotResult,
    depositBatches,
  ] = await Promise.all([
    getAccountingRows(selectedMonth, selectedYear),
    getExpenses(selectedMonth, selectedYear),
    getRecurringExpenseTemplates(),
    getZellePayments(selectedMonth, selectedYear),
    getPayments(selectedMonth, selectedYear),
    getExpenses(null, selectedYear),
    getZellePayments(null, selectedYear),
    getPayments(null, selectedYear),
    getYearlyDuesCharges(selectedYear),
    getOpenChargeOptions(),
    getLatestBankSnapshot(),
    getDepositBatchRows({
      startDate: depositStart,
      endDate: depositEnd,
    }).catch((error) => {
      console.error("Unable to load deposit batches:", error);
      return [];
    }),
  ]);
  const bankActivitySinceSnapshot = await getCashActivitySince(
    bankSnapshotResult.row?.snapshot_date
  );

  const billedRows = rows.filter((row) => Boolean(row.charge));

  const paidRows = billedRows.filter(
    (row) => row.charge?.status === "paid"
  );

  const unpaidRows = billedRows.filter(
    (row) => row.charge?.status !== "paid"
  );

  const notBilledRows = rows.filter((row) => !row.charge);

  const filteredRows = rows.filter((row) => {
    if (selectedStatus === "paid") {
      return row.charge?.status === "paid";
    }

    if (selectedStatus === "unpaid") {
      return Boolean(row.charge && row.charge.status !== "paid");
    }

    if (selectedStatus === "autopay") {
      return Boolean(row.member.autopay_active);
    }

    if (selectedStatus === "not-billed") {
      return !row.charge;
    }

    return true;
  });

  const billedTotal = billedRows.reduce(
    (sum, row) => sum + Number(row.charge?.amount || 0),
    0
  );

  const paidTotal = paidRows.reduce(
    (sum, row) =>
      sum +
      Number(
        row.charge?.paid_amount ||
          row.charge?.amount ||
          0
      ),
    0
  );

  const outstandingTotal = unpaidRows.reduce(
    (sum, row) => sum + Number(row.charge?.amount || 0),
    0
  );

  const expenseTotal = expensesResult.rows.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const zelleTotal = zelleResult.rows.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const paymentTotal = paymentsResult.rows.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );
  const showAllPayments = query?.payments === "all";
  const visiblePayments = showAllPayments
    ? paymentsResult.rows
    : paymentsResult.rows.slice(0, 5);
  const unmatchedZelleRows = zelleResult.rows.filter(
    (payment) => payment.status !== "matched"
  );
  const zelleMemberOptions = rows
    .map(({ member }) => ({
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
    }))
    .sort((a, b) =>
      `${a.last_name || ""} ${a.first_name || ""}`.localeCompare(
        `${b.last_name || ""} ${b.first_name || ""}`
      )
    );
  const manualPaymentOpenCharges = openChargeOptions.map((charge) => {
    const balance = Math.max(
      0,
      Number(charge.amount || 0) - Number(charge.paid_amount || 0)
    );

    return {
      id: charge.id,
      label: getOpenChargeLabel(charge),
      balance,
      dueDate: formatDate(charge.due_date),
    };
  });

  const onlinePaymentTotal = paymentsResult.rows
    .filter((payment) => {
      const method = String(payment.payment_method || "").toLowerCase();
      const provider = String(payment.payment_provider || "").toLowerCase();

      return (
        provider === "sola" ||
        method === "card" ||
        method === "applepay" ||
        method === "googlepay"
      );
    })
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const matchedZellePaymentTotal = paymentsResult.rows
    .filter(
      (payment) =>
        String(payment.payment_method || "").toLowerCase() === "zelle"
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const pendingZelleTotal = zelleResult.rows
    .filter((payment) => payment.status !== "matched")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const offlinePaymentTotal = Math.max(
    0,
    paymentTotal - onlinePaymentTotal - matchedZellePaymentTotal
  );

  const cashInTotal = paymentTotal + pendingZelleTotal;
  const cashOutTotal = expenseTotal;
  const netCashTotal = cashInTotal - cashOutTotal;
  const projectedBankBalance = bankSnapshotResult.row
    ? Number(bankSnapshotResult.row.balance || 0) +
      bankActivitySinceSnapshot.payments -
      bankActivitySinceSnapshot.expenses
    : null;

  const yearlyExpenseTotal = yearlyExpenses.rows.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const yearlyZelleTotal = yearlyZelle.rows.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const yearlyPaymentTotal = yearlyPayments.rows.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const yearlyPendingZelleTotal = yearlyZelle.rows
    .filter((payment) => payment.status !== "matched")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const yearlyCashInTotal = yearlyPaymentTotal + yearlyPendingZelleTotal;
  const yearlyNetCashTotal = yearlyCashInTotal - yearlyExpenseTotal;

  const yearlyDuesBilledTotal = yearlyDuesCharges.reduce(
    (sum, charge) => sum + Number(charge.amount || 0),
    0
  );

  const yearlyDuesPaidTotal = yearlyDuesCharges.reduce(
    (sum, charge) =>
      charge.status === "paid"
        ? sum + Number(charge.paid_amount || charge.amount || 0)
        : sum,
    0
  );

  const yearlyDuesOutstandingTotal = yearlyDuesCharges.reduce(
    (sum, charge) =>
      charge.status === "paid" ? sum : sum + Number(charge.amount || 0),
    0
  );

  const yearlyMonthOverview = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthDues = yearlyDuesCharges.filter(
      (charge) => Number(charge.billing_month) === month
    );
    const duesBilled = monthDues.reduce(
      (sum, charge) => sum + Number(charge.amount || 0),
      0
    );
    const duesPaid = monthDues.reduce(
      (sum, charge) =>
        charge.status === "paid"
          ? sum + Number(charge.paid_amount || charge.amount || 0)
          : sum,
      0
    );
    const duesOutstanding = monthDues.reduce(
      (sum, charge) =>
        charge.status === "paid" ? sum : sum + Number(charge.amount || 0),
      0
    );
    const expenses = yearlyExpenses.rows
      .filter((expense) => getDateMonth(expense.expense_date) === month)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const zelle = yearlyZelle.rows
      .filter((payment) => getDateMonth(payment.received_date) === month)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      month,
      duesBilled,
      duesPaid,
      duesOutstanding,
      expenses,
      zelle,
      net: duesPaid + zelle - expenses,
    };
  });

  const graphMax = Math.max(
    billedTotal,
    paidTotal,
    outstandingTotal,
    expenseTotal,
    zelleTotal,
    paymentTotal,
    cashInTotal,
    cashOutTotal,
    1
  );

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin"
            className="text-sm font-semibold text-[#8b6b2e]"
          >
            ← Admin Home
          </Link>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/admin/billing"
              className="text-sm font-semibold text-[#8b6b2e]"
            >
              Generate Dues
            </Link>

            <Link
              href="/admin/members"
              className="text-sm font-semibold text-[#8b6b2e]"
            >
              Members
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-8 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Accountant Dashboard
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            {getMonthName(selectedMonth)} {selectedYear}
          </h1>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <p className="text-sm text-slate-400">Members Billed</p>
              <p className="mt-1 text-2xl font-bold">
                {billedRows.length}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Dues Billed</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMoney(billedTotal)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Dues Paid</p>
              <p className="mt-1 text-2xl font-bold text-green-300">
                {formatMoney(paidTotal)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Payments Received</p>
              <p className="mt-1 text-2xl font-bold text-green-200">
                {formatMoney(paymentTotal)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Outstanding</p>
              <p className="mt-1 text-2xl font-bold text-[#f0d99a]">
                {formatMoney(outstandingTotal)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Not Billed</p>
              <p className="mt-1 text-2xl font-bold">
                {notBilledRows.length}
              </p>
            </div>
          </div>
        </div>

        {query?.accountingError && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
            {query.accountingError}
          </div>
        )}

        {query?.bankError && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
            {query.bankError}
          </div>
        )}

        {(query?.expenseAdded === "1" ||
          query?.zelleAdded === "1" ||
          query?.paymentAdded === "1" ||
          query?.recurringSaved === "1" ||
          query?.bankSaved === "1") && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Accounting entry saved.
            {query?.zelleAdded === "1" && query.created ? (
              <span>
                {" "}
                Auto-matched {query.created} Zelle payments. Left{" "}
                {query.skipped || "0"} for review.
              </span>
            ) : null}
          </div>
        )}

        {query?.recurringGenerated === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Generated {query.created || "0"} recurring expenses. Skipped{" "}
            {query.skipped || "0"} already-created expenses.
          </div>
        )}

        <div className="mt-8">
          <div className="rounded-[1.5rem] border border-[#e3d9c7] bg-white p-4 shadow-sm md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a7a37]">
                  Accounting
                </p>
                <h2 className="mt-1 text-xl font-bold">Choose Section</h2>
              </div>
              <span className="rounded-full bg-[#fbf8f2] px-3 py-1 text-xs font-bold text-slate-600">
                {getMonthName(selectedMonth)} {selectedYear}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["monthly", "Overview"],
                ["billing", "Billing"],
                ["expenses", "Expenses"],
                ["payments", "Payments"],
                ["deposits", "Deposits"],
                ["yearly", "Yearly"],
                ["uploads", "Uploads"],
                ["receipts", "Receipts"],
              ].map(([view, label]) => (
                <Link
                  key={view}
                  href={`/admin/accounting?month=${selectedMonth}&year=${selectedYear}&view=${view}`}
                  className={
                    activeView === view
                      ? "rounded-2xl bg-[#1d2940] px-4 py-3 text-center text-sm font-bold text-white shadow-sm"
                      : "rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] px-4 py-3 text-center text-sm font-bold text-slate-700"
                  }
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
            {[
              ["monthly", "Overview"],
              ["billing", "Billing"],
              ["expenses", "Expenses"],
              ["payments", "Payments"],
              ["deposits", "Deposits"],
              ["yearly", "Yearly"],
              ["uploads", "Uploads"],
              ["receipts", "Receipts"],
            ].map(([view, label]) => (
              <Link
                key={view}
                href={`/admin/accounting?month=${selectedMonth}&year=${selectedYear}&view=${view}`}
                className={
                  activeView === view
                    ? "shrink-0 rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white shadow-sm"
                    : "shrink-0 rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-[#fbf8f2]"
                }
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {(activeView === "monthly" ||
          activeView === "billing" ||
          activeView === "expenses" ||
          activeView === "payments" ||
          activeView === "deposits" ||
          activeView === "yearly" ||
          activeView === "cashflow") && (
        <div
          className={
            activeView === "monthly"
              ? "mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
              : "mt-8 hidden rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm md:block"
          }
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Cash In / Cash Out</h2>
              <p className="mt-1 text-sm text-slate-500">
                Includes card, Apple Pay, Google Pay, Zelle, checks, cash, and
                other recorded payments.
              </p>
            </div>

            {(expensesResult.error ||
              zelleResult.error ||
              paymentsResult.error ||
              bankSnapshotResult.error) && (
              <p className="max-w-xl rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Supabase setup needed for full accounting:
                {expensesResult.error ? " accounting_expenses" : ""}
                {expensesResult.error && zelleResult.error ? " and" : ""}
                {zelleResult.error ? " zelle_payments" : ""}.
                {paymentsResult.error ? " payments" : ""}
                {bankSnapshotResult.error
                  ? " accounting_bank_snapshots"
                  : ""}
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Cash In", cashInTotal, "bg-green-600"],
              ["Online CC/Wallet", onlinePaymentTotal, "bg-[#1d2940]"],
              [
                "Zelle",
                matchedZellePaymentTotal + pendingZelleTotal,
                "bg-blue-600",
              ],
              ["Check/Cash/Other", offlinePaymentTotal, "bg-[#8b6b2e]"],
              ["Cash Out", cashOutTotal, "bg-red-600"],
              [
                "Net",
                netCashTotal,
                netCashTotal >= 0 ? "bg-green-700" : "bg-red-700",
              ],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="rounded-2xl bg-[#fbf8f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-xl font-black">
                  {formatMoney(Number(value))}
                </p>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${color}`}
                    style={{
                      width: `${Math.max(
                        4,
                        (Number(value) / graphMax) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {activeView === "monthly" && (
            <form
              method="GET"
              className="mt-6 rounded-2xl bg-[#fbf8f2] p-4"
            >
              <input type="hidden" name="view" value="monthly" />
              <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Viewing Month
                  </span>
                  <select
                    name="month"
                    defaultValue={String(selectedMonth)}
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 font-semibold"
                  >
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Year
                  </span>
                  <input
                    name="year"
                    type="number"
                    min="2026"
                    defaultValue={selectedYear}
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 font-semibold"
                  />
                </label>

                <button
                  type="submit"
                  className="self-end rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
                >
                  Update Month
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.8fr_0.8fr]">
            <div className="rounded-2xl bg-[#fbf8f2] p-5">
              <h3 className="font-bold">Payment Method Breakdown</h3>
              <div className="mt-4 space-y-3">
                {[
                  ["Online card/wallet", onlinePaymentTotal],
                  ["Matched Zelle", matchedZellePaymentTotal],
                  ["Pending/unmatched Zelle", pendingZelleTotal],
                  ["Check, cash, other", offlinePaymentTotal],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-semibold">{label}</span>
                      <span className="font-bold">
                        {formatMoney(Number(value))}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-[#1d2940]"
                        style={{
                          width: `${Math.max(
                            Number(value) > 0 ? 4 : 0,
                            (Number(value) / graphMax) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-[#fbf8f2] p-5">
              <h3 className="font-bold">Bank Balance</h3>
              {bankSnapshotResult.row ? (
                <>
                  <p className="mt-3 text-3xl font-black text-[#1d2940]">
                    {formatMoney(projectedBankBalance)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Based on {formatMoney(bankSnapshotResult.row.balance)} on{" "}
                    {formatDate(bankSnapshotResult.row.snapshot_date)}, plus{" "}
                    {formatMoney(bankActivitySinceSnapshot.payments)} in and
                    minus {formatMoney(bankActivitySinceSnapshot.expenses)} out
                    since then.
                  </p>
                </>
              ) : (
                <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-slate-500">
                  Enter the current bank balance once to start tracking the
                  running estimate.
                </p>
              )}

              <form action={saveBankSnapshot} className="mt-4 space-y-3">
                <input type="hidden" name="month" value={selectedMonth} />
                <input type="hidden" name="year" value={selectedYear} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Real Bank Balance
                    </span>
                    <input
                      name="balance"
                      type="number"
                      step="0.01"
                      required
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      As Of
                    </span>
                    <input
                      name="snapshot_date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2 text-sm"
                    />
                  </label>
                </div>

                <HebrewKeyboardField
                  name="note"
                  placeholder="Optional note"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2 text-sm"
                />

                <button className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white">
                  Save Bank Balance
                </button>
              </form>
            </div>

            <div className="rounded-2xl bg-[#1d2940] p-5 text-white">
              <p className="text-sm font-semibold text-slate-300">
                Year cashflow
              </p>
              <p className="mt-3 text-3xl font-black">
                {formatMoney(yearlyNetCashTotal)}
              </p>
              <p className="mt-3 text-sm text-slate-300">
                Cash in {formatMoney(yearlyCashInTotal)} minus cash out{" "}
                {formatMoney(yearlyExpenseTotal)} for {selectedYear}.
              </p>
            </div>
          </div>
        </div>
        )}

        {activeView === "yearly" && (
          <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {selectedYear} Year Summary
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dues, Zelle, expenses, and net totals across the selected
                  calendar year.
                </p>
              </div>

              <form method="GET" className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="view" value="yearly" />
                <label className="block text-sm font-bold text-slate-700">
                  Year
                  <input
                    type="number"
                    name="year"
                    min="2026"
                    defaultValue={selectedYear}
                    className="mt-1 w-28 rounded-2xl border border-[#d9cfbd] bg-white px-4 py-2 text-sm font-semibold"
                  />
                </label>
                <button className="rounded-full bg-[#1f2a44] px-5 py-2.5 text-sm font-bold text-white">
                  View Year
                </button>
              </form>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl bg-[#fbf8f2] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Dues Billed
                </p>
                <p className="mt-2 text-2xl font-black text-[#8b6b2e]">
                  {formatMoney(yearlyDuesBilledTotal)}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fbf8f2] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Dues Paid
                </p>
                <p className="mt-2 text-2xl font-black text-green-700">
                  {formatMoney(yearlyDuesPaidTotal)}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fbf8f2] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Dues Open
                </p>
                <p className="mt-2 text-2xl font-black text-red-700">
                  {formatMoney(yearlyDuesOutstandingTotal)}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fbf8f2] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Year Expenses
                </p>
                <p className="mt-2 text-2xl font-black text-red-700">
                  {formatMoney(yearlyExpenseTotal)}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fbf8f2] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Year Zelle
                </p>
                <p className="mt-2 text-2xl font-black text-blue-700">
                  {formatMoney(yearlyZelleTotal)}
                </p>
              </div>

            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <form
                action="/api/accounting/statements/yearly-tax"
                method="GET"
                target="_blank"
                className="rounded-2xl bg-[#fbf8f2] p-5"
              >
                <h3 className="text-lg font-black">Yearly Tax Statements</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Download contribution statements for one member or everyone
                  with recorded paid payments in the selected year.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Year
                    </span>
                    <input
                      name="year"
                      type="number"
                      min="2020"
                      defaultValue={selectedYear}
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                    />
                  </label>

                  <label className="min-w-0 space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Member
                    </span>
                    <select
                      name="memberId"
                      defaultValue="all"
                      className="w-full min-w-0 rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                    >
                      <option value="all">All members with payments</option>
                      {zelleMemberOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {[member.last_name, member.first_name]
                            .filter(Boolean)
                            .join(", ") || member.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  type="submit"
                  className="mt-4 rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
                >
                  Download Tax Statement PDF
                </button>
              </form>

              <form
                action="/api/accounting/statements/member-account"
                method="GET"
                target="_blank"
                className="rounded-2xl bg-[#fbf8f2] p-5"
              >
                <h3 className="text-lg font-black">Member Account Statement</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Download a ledger-style statement with charges, payments, and
                  running balance for the selected member.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Year
                    </span>
                    <input
                      name="year"
                      type="number"
                      min="2020"
                      defaultValue={selectedYear}
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                    />
                  </label>

                  <label className="min-w-0 space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Member
                    </span>
                    <select
                      name="memberId"
                      required
                      defaultValue=""
                      className="w-full min-w-0 rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                    >
                      <option value="" disabled>
                        Select member
                      </option>
                      {zelleMemberOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {[member.last_name, member.first_name]
                            .filter(Boolean)
                            .join(", ") || member.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  type="submit"
                  className="mt-4 rounded-full bg-[#8b6b2e] px-5 py-2.5 text-sm font-bold text-white"
                >
                  Download Account Statement PDF
                </button>
              </form>
            </div>

            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">
                    Month-by-Month Overview
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Open any previous month to review the full accounting rows,
                    expenses, Zelle entries, receipts, and uploads.
                  </p>
                </div>
                <p className="rounded-full bg-[#fbf8f2] px-4 py-2 text-sm font-bold text-slate-700">
                  Year net:{" "}
                  {formatMoney(
                    yearlyDuesPaidTotal + yearlyZelleTotal - yearlyExpenseTotal
                  )}
                </p>
              </div>

              <div className="mt-4 overflow-x-auto rounded-3xl border border-[#e3d9c7]">
                <table className="min-w-[980px] w-full text-left text-sm">
                  <thead className="bg-[#fbf8f2] text-xs uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3">Dues Billed</th>
                      <th className="px-4 py-3">Dues Paid</th>
                      <th className="px-4 py-3">Dues Open</th>
                      <th className="px-4 py-3">Zelle</th>
                      <th className="px-4 py-3">Expenses</th>
                      <th className="px-4 py-3">Net</th>
                      <th className="px-4 py-3 text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee5d8] bg-white">
                    {yearlyMonthOverview.map((month) => (
                      <tr key={month.month}>
                        <td className="px-4 py-3 font-bold">
                          {getMonthName(month.month)}
                        </td>
                        <td className="px-4 py-3">
                          {formatMoney(month.duesBilled)}
                        </td>
                        <td className="px-4 py-3 text-green-700">
                          {formatMoney(month.duesPaid)}
                        </td>
                        <td className="px-4 py-3 text-red-700">
                          {formatMoney(month.duesOutstanding)}
                        </td>
                        <td className="px-4 py-3 text-blue-700">
                          {formatMoney(month.zelle)}
                        </td>
                        <td className="px-4 py-3">
                          {formatMoney(month.expenses)}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {formatMoney(month.net)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/accounting?month=${month.month}&year=${selectedYear}&view=monthly`}
                            className="inline-flex rounded-full border border-[#d9cfbd] px-4 py-2 text-xs font-bold text-[#1f2a44] hover:bg-[#fbf8f2]"
                          >
                            Open Month
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeView === "uploads" && (
          <form
            action={importAccountingCsv}
            className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-bold">Upload CSV</h2>
            <p className="mt-1 text-sm text-slate-500">
              Import expenses or Zelle payments from a bank export. Zelle rows
              auto-match open charges or create a paid charge when possible;
              only unresolved rows stay in Zelle Matching.
            </p>

            <label className="mt-5 block space-y-2">
              <span className="font-semibold">Import Type</span>
              <select
                name="import_type"
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                defaultValue="expenses"
              >
                <option value="expenses">Expenses</option>
                <option value="recurring_expenses">
                  Recurring Expenses
                </option>
                <option value="zelle">Zelle Payments</option>
              </select>
            </label>

            <label className="mt-4 block space-y-2">
              <span className="font-semibold">CSV File</span>
              <input
                name="csv_file"
                type="file"
                accept=".csv,text/csv"
                required
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
              />
            </label>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Expenses: vendor, category, amount, date. Zelle: payer_name,
              payer_email, amount, received_date, purpose. Recurring:
              vendor, category, amount, frequency, day_of_month, day_of_week,
              start_date.
            </p>

            <label className="mt-4 flex items-center gap-2 rounded-2xl bg-[#fbf8f2] p-3 text-sm font-bold text-slate-700">
              <input
                name="send_receipt"
                type="checkbox"
                className="h-4 w-4"
              />
              Send receipt emails for imported Zelle payments
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="/api/accounting/templates/expenses"
                className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-xs font-bold"
              >
                Expense CSV Template
              </a>

              <a
                href="/api/accounting/templates/zelle"
                className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-xs font-bold"
              >
                Zelle CSV Template
              </a>

              <a
                href="/api/accounting/templates/recurring-expenses"
                className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-xs font-bold"
              >
                Recurring Expense Template
              </a>
            </div>

            <button
              type="submit"
              className="mt-5 rounded-full bg-[#8b6b2e] px-6 py-3 font-bold text-white"
            >
              Import CSV
            </button>
          </form>
        )}

        {activeView === "receipts" && (
          <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">Receipt Links</h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload receipt PDFs or images into the private Supabase storage
              bucket. Receipt links below are signed for admin access.
            </p>

            <form
              action={uploadExpenseReceipt}
              className="mt-5 grid gap-4 rounded-2xl bg-[#fbf8f2] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <label className="space-y-2">
                <span className="font-semibold">Expense</span>
                <select
                  name="expense_id"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select expense
                  </option>
                  {expensesResult.rows.map((expense) => (
                    <option key={expense.id} value={expense.id}>
                      {formatDate(expense.expense_date)} - {expense.vendor} -{" "}
                      {formatMoney(expense.amount)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Receipt File</span>
                <input
                  name="receipt_file"
                  type="file"
                  accept="application/pdf,image/*"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                />
              </label>

              <button
                type="submit"
                className="self-end rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
              >
                Upload Receipt
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {expensesResult.rows
                .filter((expense) => Boolean(expense.receipt_url))
                .map((expense) => (
                  <a
                    key={expense.id}
                    href={receiptHref(expense)}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl bg-[#fbf8f2] p-4 transition hover:shadow-md"
                  >
                    <p className="font-bold">{expense.vendor}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(expense.expense_date)} ·{" "}
                      {formatMoney(expense.amount)}
                    </p>
                  </a>
                ))}

              {expensesResult.rows.filter((expense) => expense.receipt_url)
                .length === 0 && (
                <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
                  No receipt links for this month yet.
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "expenses" && (
          <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Saved Recurring Expenses</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Save rent, rabbi, utilities, and other repeating expenses
                  once. Weekly items create one row for each matching weekday;
                  edit the actual generated expense when the amount changes.
                </p>
              </div>

              <form action={generateRecurringExpenses}>
                <input type="hidden" name="month" value={selectedMonth} />
                <input type="hidden" name="year" value={selectedYear} />
                <button
                  type="submit"
                  className="rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
                >
                  Generate for {getMonthName(selectedMonth)}
                </button>
              </form>
            </div>

            {recurringTemplatesResult.error ? (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Recurring expense setup needs the latest Supabase SQL applied:{" "}
                {recurringTemplatesResult.error}
              </div>
            ) : null}

            <form
              action={saveRecurringExpenseTemplate}
              className="mt-5 grid gap-4 rounded-2xl bg-[#fbf8f2] p-4 lg:grid-cols-[1fr_1fr_130px_140px_140px_150px_auto]"
            >
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Vendor
                </span>
                <input
                  name="vendor"
                  required
                  placeholder="Rent"
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Category
                </span>
                <input
                  name="category"
                  placeholder="Rent, Payroll..."
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Amount
                </span>
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Repeats
                </span>
                <select
                  name="frequency"
                  defaultValue="monthly"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Month Day
                </span>
                <input
                  name="day_of_month"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={1}
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Week Day
                </span>
                <select
                  name="day_of_week"
                  defaultValue="6"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Shabbos</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Starts
                </span>
                <input
                  name="start_date"
                  type="date"
                  defaultValue={selectedMonthStart}
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                />
              </label>

              <label className="flex items-center gap-2 self-end rounded-xl bg-white px-3 py-2 text-sm font-bold">
                <input name="active" type="checkbox" defaultChecked />
                Active
              </label>

              <label className="space-y-1 lg:col-span-6">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Note
                </span>
                <input
                  name="note"
                  placeholder="Optional internal note"
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                />
              </label>

              <button
                type="submit"
                className="self-end rounded-full bg-[#8b6b2e] px-5 py-2.5 text-sm font-bold text-white"
              >
                Save Default
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {recurringTemplatesResult.rows.map((template) => (
                <form
                  key={template.id}
                  action={saveRecurringExpenseTemplate}
                  className="grid gap-3 rounded-2xl border border-[#e3d9c7] bg-white p-4 lg:grid-cols-[1fr_1fr_120px_130px_110px_130px_150px_150px_auto]"
                >
                  <input
                    type="hidden"
                    name="template_id"
                    value={template.id}
                  />

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Vendor
                    </span>
                    <input
                      name="vendor"
                      required
                      defaultValue={template.vendor}
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Category
                    </span>
                    <input
                      name="category"
                      defaultValue={template.category || ""}
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Amount
                    </span>
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      defaultValue={Number(template.amount || 0)}
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Repeats
                    </span>
                    <select
                      name="frequency"
                      defaultValue={template.frequency || "monthly"}
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Month Day
                    </span>
                    <input
                      name="day_of_month"
                      type="number"
                      min="1"
                      max="31"
                      defaultValue={template.day_of_month || 1}
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Week Day
                    </span>
                    <select
                      name="day_of_week"
                      defaultValue={template.day_of_week ?? 6}
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Shabbos</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Starts
                    </span>
                    <input
                      name="start_date"
                      type="date"
                      defaultValue={template.start_date || selectedMonthStart}
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Ends
                    </span>
                    <input
                      name="end_date"
                      type="date"
                      defaultValue={template.end_date || ""}
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                    />
                  </label>

                  <label className="flex items-center gap-2 self-end rounded-xl bg-[#fbf8f2] px-3 py-2 text-sm font-bold">
                    <input
                      name="active"
                      type="checkbox"
                      defaultChecked={Boolean(template.active)}
                    />
                    Active
                  </label>

                  <label className="space-y-1 lg:col-span-8">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Note
                    </span>
                    <input
                      name="note"
                      defaultValue={template.note || ""}
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                    />
                  </label>

                  <button
                    type="submit"
                    className="self-end rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Update
                  </button>
                </form>
              ))}

              {!recurringTemplatesResult.error &&
                recurringTemplatesResult.rows.length === 0 && (
                  <div className="rounded-2xl bg-[#fbf8f2] p-6 text-center text-slate-500">
                    No saved recurring expenses yet.
                  </div>
                )}
            </div>
          </div>
        )}

        {activeView === "expenses" && (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <form
            action={addExpense}
            className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-bold">Add Expense</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">Vendor</span>
                <input
                  name="vendor"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Category</span>
                <input
                  name="category"
                  placeholder="Rent, Kiddush, Utilities..."
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Amount</span>
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Date</span>
                <input
                  name="expense_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="font-semibold">Receipt URL</span>
              <input
                name="receipt_url"
                placeholder="Optional external receipt link"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <label className="mt-4 block space-y-2">
              <span className="font-semibold">Receipt File</span>
              <input
                name="receipt_file"
                type="file"
                accept="application/pdf,image/*"
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
              />
            </label>

            <label className="mt-4 block space-y-2">
              <span className="font-semibold">Note</span>
              <HebrewKeyboardField
                name="note"
                rows={3}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <button
              type="submit"
              className="mt-5 rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
            >
              Save Expense
            </button>
          </form>

          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {getMonthName(selectedMonth)} Expenses
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Edit generated weekly or monthly rows after the actual amount
                  is known.
                </p>
              </div>
              <span className="rounded-full bg-[#fbf8f2] px-4 py-2 text-sm font-bold text-slate-700">
                {formatMoney(expenseTotal)}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {expensesResult.rows.map((expense) => (
                <div
                  key={expense.id}
                  className="rounded-2xl bg-[#fbf8f2] p-4"
                >
                  <form
                    action={updateExpense}
                    className="grid gap-3 lg:grid-cols-[minmax(160px,1fr)_140px_130px_150px_auto]"
                  >
                    <input type="hidden" name="expense_id" value={expense.id} />
                    <input type="hidden" name="month" value={selectedMonth} />
                    <input type="hidden" name="year" value={selectedYear} />

                    <label className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Vendor
                      </span>
                      <input
                        name="vendor"
                        required
                        defaultValue={expense.vendor}
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Category
                      </span>
                      <input
                        name="category"
                        defaultValue={expense.category || ""}
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Amount
                      </span>
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        defaultValue={Number(expense.amount || 0)}
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Date
                      </span>
                      <input
                        name="expense_date"
                        type="date"
                        required
                        defaultValue={
                          expense.expense_date ||
                          new Date().toISOString().slice(0, 10)
                        }
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                      />
                    </label>

                    <button
                      type="submit"
                      className="self-end rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
                    >
                      Update
                    </button>

                    <label className="space-y-1 lg:col-span-4">
                      <span className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Note
                        {expense.recurring_template_id ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] tracking-normal text-green-800">
                            Recurring
                          </span>
                        ) : null}
                      </span>
                      <HebrewKeyboardField
                        name="note"
                        defaultValue={expense.note || ""}
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                      />
                    </label>
                  </form>

                  <form action={deleteExpense} className="mt-3 text-right">
                    <input type="hidden" name="expense_id" value={expense.id} />
                    <input type="hidden" name="month" value={selectedMonth} />
                    <input type="hidden" name="year" value={selectedYear} />
                    <button
                      type="submit"
                      className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      Delete Expense
                    </button>
                  </form>
                </div>
              ))}

              {expensesResult.rows.length === 0 && (
                <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
                  No expenses recorded for this month yet.
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {activeView === "payments" && (
          <div
            id="zelle-matching"
            className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Zelle Matching</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review member-reported Zelle payments and imported Zelle rows,
                  then attach them to an open charge.
                </p>
              </div>
              <span className="rounded-full bg-[#fbf8f2] px-4 py-2 text-sm font-bold text-slate-700">
                {unmatchedZelleRows.length} waiting
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Matched Zelle payments move out of this queue and appear in the
              monthly payments list below.
            </p>

            <div className="mt-5 space-y-3">
              {unmatchedZelleRows.map((payment) => (
                <form
                  key={payment.id}
                  action={approveZellePayment}
                  className="grid min-w-0 gap-3 rounded-2xl bg-[#fbf8f2] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto]"
                >
                  <input type="hidden" name="zelle_id" value={payment.id} />
                  <input type="hidden" name="month" value={selectedMonth} />
                  <input type="hidden" name="year" value={selectedYear} />

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{payment.payer_name}</p>
                      <span
                        className={
                          payment.status === "matched"
                            ? "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800"
                            : payment.status === "pending_review"
                            ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"
                            : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                        }
                      >
                        {payment.status || "unmatched"}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {formatMoney(payment.amount)} ·{" "}
                      {formatDate(payment.received_date)}
                      {payment.payer_email ? ` · ${payment.payer_email}` : ""}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {payment.purpose || "Zelle Payment"}
                    </p>

                    {payment.note ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {payment.note}
                      </p>
                    ) : null}
                  </div>

                  <label className="min-w-0 space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Match to open charge
                    </span>
                    <select
                      name="charge_id"
                      disabled={payment.status === "matched"}
                      required={payment.status !== "matched"}
                      className="w-full min-w-0 rounded-xl border border-[#d8cdb7] bg-white px-3 py-2 text-sm"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select charge
                      </option>
                      {openChargeOptions.map((charge) => (
                        <option key={charge.id} value={charge.id}>
                          {getOpenChargeLabel(charge)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="submit"
                    disabled={payment.status === "matched"}
                    className="self-end rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Approve
                  </button>

                  <div className="border-t border-[#e3d9c7] pt-3 lg:col-span-3">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a7a37]">
                      No open charge?
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Leave member blank to create a guest/non-member paid
                      charge for this Zelle row.
                    </p>
                    <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <QuickChargeMemberPicker members={zelleMemberOptions} />
                      </div>

                      <label className="min-w-0 space-y-1">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                          Type
                        </span>
                        <input
                          name="charge_type"
                          disabled={payment.status === "matched"}
                          defaultValue={payment.purpose || "Zelle Payment"}
                          className="w-full min-w-0 rounded-xl border border-[#d8cdb7] bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="min-w-0 space-y-1">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                          Description
                        </span>
                        <input
                          name="description"
                          disabled={payment.status === "matched"}
                          defaultValue={payment.purpose || "Zelle Payment"}
                          className="w-full min-w-0 rounded-xl border border-[#d8cdb7] bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <button
                        type="submit"
                        formAction={createPaidChargeFromZelle}
                        formNoValidate
                        disabled={payment.status === "matched"}
                        className="self-end rounded-full bg-[#8b6b2e] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Create Paid Charge
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 lg:col-span-3">
                    <input
                      name="send_receipt"
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4"
                      disabled={payment.status === "matched"}
                    />
                    Send receipt email if an email is available
                  </label>
                </form>
              ))}

              {unmatchedZelleRows.length === 0 ? (
                <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
                  No unmatched Zelle payments for this month.
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeView === "payments" && (
        <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">

          <form
            action={addZellePayment}
            className="min-w-0 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-bold">Bring In Zelle Payment</h2>
            <p className="mt-1 text-sm text-slate-500">
              This will auto-match an open charge or create a paid charge. If
              it cannot resolve safely, it will stay in Zelle Matching.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="min-w-0 space-y-2">
                <span className="font-semibold">Payer Name</span>
                <input
                  name="payer_name"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="min-w-0 space-y-2">
                <span className="font-semibold">Payer Email</span>
                <input
                  name="payer_email"
                  type="email"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="min-w-0 space-y-2">
                <span className="font-semibold">Amount</span>
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="min-w-0 space-y-2">
                <span className="font-semibold">Received Date</span>
                <input
                  name="received_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>
            </div>

            <label className="mt-4 block min-w-0 space-y-2">
              <span className="font-semibold">Purpose</span>
              <input
                name="purpose"
                placeholder="Dues, donation, Mishaberach..."
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <label className="mt-4 block min-w-0 space-y-2">
              <span className="font-semibold">Memo</span>
              <textarea
                name="note"
                rows={3}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <label className="mt-4 flex items-center gap-2 rounded-2xl bg-[#fbf8f2] p-3 text-sm font-bold text-slate-700">
              <input
                name="send_receipt"
                type="checkbox"
                className="h-4 w-4"
              />
              Send receipt email if an email is available
            </label>

            <button
              type="submit"
              className="mt-5 rounded-full bg-[#8b6b2e] px-6 py-3 font-bold text-white"
            >
              Save Zelle Payment
            </button>
          </form>

          <ManualPaymentForm
            month={selectedMonth}
            year={selectedYear}
            openCharges={manualPaymentOpenCharges}
            members={zelleMemberOptions}
            today={new Date().toISOString().slice(0, 10)}
          />
        </div>
        )}

        {activeView === "payments" && (
          <div className="mt-6 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {getMonthName(selectedMonth)} Payments
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {showAllPayments ? "all" : "latest"} payments for
                  this month.
                </p>
              </div>
              <span className="rounded-full bg-[#fbf8f2] px-4 py-2 text-sm font-bold text-slate-700">
                {formatMoney(paymentTotal)}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {visiblePayments.map((payment) => {
                const charge = getPaymentCharge(payment);
                const member = getPaymentMember(payment);
                return (
                  <div
                    key={payment.id}
                    className="grid min-w-0 gap-3 rounded-2xl bg-[#fbf8f2] p-4 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-bold">
                          {getPaymentPayerName(payment)}
                        </p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                          {payment.payment_method ||
                            payment.payment_provider ||
                            "Payment"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(payment.paid_at)} ·{" "}
                        {charge?.charge_type ||
                          charge?.description ||
                          payment.note ||
                          "Payment"}
                      </p>
                    </div>
                    <p className="self-center text-lg font-black">
                      {formatMoney(payment.amount)}
                    </p>
                    {member?.id ? (
                      <Link
                        href={`/admin/members/${member.id}/payments`}
                        className="self-center rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-center text-xs font-bold text-[#1d2940] sm:col-span-2 sm:justify-self-end"
                      >
                        View / Edit
                      </Link>
                    ) : null}
                  </div>
                );
              })}

              {paymentsResult.rows.length === 0 && (
                <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
                  No payments recorded for this month yet.
                </div>
              )}
            </div>

            {paymentsResult.rows.length > 5 && (
              <div className="mt-5">
                <Link
                  href={`/admin/accounting?month=${selectedMonth}&year=${selectedYear}&view=payments${
                    showAllPayments ? "" : "&payments=all"
                  }`}
                  className="inline-flex rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold text-[#1d2940]"
                >
                  {showAllPayments
                    ? "Show latest 5"
                    : `View all ${paymentsResult.rows.length} payments`}
                </Link>
              </div>
            )}
          </div>
        )}

        {activeView === "deposits" && (
          <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  Deposit Batch Reconciliation
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Payments grouped by deposit date and method, ready to compare
                  against the bank statement.
                </p>
              </div>
              <span className="rounded-full bg-[#fbf8f2] px-4 py-2 text-sm font-bold text-slate-700">
                {formatMoney(
                  depositBatches.reduce(
                    (sum, batch) => sum + Number(batch.amount || 0),
                    0
                  )
                )}
              </span>
            </div>

            <form method="GET" className="mt-5 rounded-2xl bg-[#fbf8f2] p-4">
              <input type="hidden" name="view" value="deposits" />
              <input type="hidden" name="month" value={selectedMonth} />
              <input type="hidden" name="year" value={selectedYear} />

              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Start Date
                  </span>
                  <input
                    name="depositStart"
                    type="date"
                    defaultValue={depositStart}
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    End Date
                  </span>
                  <input
                    name="depositEnd"
                    type="date"
                    defaultValue={depositEnd}
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2"
                  />
                </label>

                <button
                  type="submit"
                  className="self-end rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
                >
                  Update
                </button>

                <a
                  href={`/api/accounting/deposits/export?start=${depositStart}&end=${depositEnd}`}
                  className="self-end rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-center text-sm font-bold text-[#1d2940]"
                >
                  Export CSV
                </a>
              </div>
            </form>

            <div className="mt-5 space-y-4">
              {depositBatches.map((batch) => (
                <details
                  key={`${batch.depositDate}-${batch.method}`}
                  className="rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-4"
                  open
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black">
                          {formatDate(batch.depositDate)} deposit:{" "}
                          {batch.method}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {batch.count} payments in this batch
                        </p>
                      </div>
                      <p className="text-xl font-black text-[#1d2940]">
                        {formatMoney(batch.amount)}
                      </p>
                    </div>
                  </summary>

                  <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e3d9c7] bg-white">
                    <table className="min-w-[760px] w-full text-left text-sm">
                      <thead className="bg-white text-xs uppercase tracking-[0.14em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Member</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3">Receipt</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eee5d8]">
                        {batch.payments.map((payment) => {
                          const charge = getPaymentCharge(payment);

                          return (
                            <tr key={payment.id}>
                              <td className="px-4 py-3 font-bold">
                                {getPaymentPayerName(payment)}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {charge?.description ||
                                  charge?.charge_type ||
                                  payment.note ||
                                  "Payment"}
                              </td>
                              <td className="px-4 py-3">
                                {payment.receipt_number ? (
                                  <a
                                    href={`/api/receipts/${payment.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-bold text-[#8b6b2e]"
                                  >
                                    {payment.receipt_number}
                                  </a>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-black">
                                {formatMoney(payment.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}

              {depositBatches.length === 0 ? (
                <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
                  No paid payments found for this deposit range.
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeView === "billing" && (
        <form
          method="GET"
          className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
        >
          <input type="hidden" name="view" value="billing" />
          <input type="hidden" name="month" value={selectedMonth} />
          <input type="hidden" name="year" value={selectedYear} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a7a37]">
                Billing list
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                {getMonthName(selectedMonth)} {selectedYear}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Change the month from Overview, then use this filter to review
                member billing status.
              </p>
            </div>

            <label className="space-y-2">
              <span className="font-semibold">Show</span>

              <select
                name="status"
                defaultValue={selectedStatus}
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
              >
                <option value="all">All Members</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="autopay">Auto-Pay Members</option>
                <option value="not-billed">Not Billed</option>
              </select>
            </label>

            <button
              type="submit"
              className="self-end rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
            >
              Apply
            </button>
          </div>
        </form>
        )}

        {activeView === "billing" && (
        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Member Billing Status
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredRows.length} active members.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
  <a
    href={`/api/accounting/export?month=${selectedMonth}&year=${selectedYear}`}
    className="rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
  >
    Download CSV
  </a>

  <Link
    href="/admin/billing"
    className="rounded-full bg-[#8b6b2e] px-5 py-3 text-sm font-bold text-white"
  >
    Generate Missing Charges
  </Link>
</div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1100px] border-separate border-spacing-y-3 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4">Member</th>
                  <th className="px-4">Email</th>
                  <th className="px-4">Auto-Pay</th>
                  <th className="px-4">Amount</th>
                  <th className="px-4">Due</th>
                  <th className="px-4">Status</th>
                  <th className="px-4">Paid Date</th>
                  <th className="px-4">Method</th>
                  <th className="px-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map(({ member, charge }) => (
                  <tr key={member.id} className="bg-[#fbf8f2]">
                    <td className="rounded-l-2xl px-4 py-4 font-bold">
                      {member.last_name}, {member.first_name}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {member.email || "—"}
                    </td>

                    <td className="px-4 py-4">
                      {member.autopay_active ? (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          No
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 font-bold">
                      {charge ? formatMoney(charge.amount) : "—"}
                    </td>

                    <td className="px-4 py-4">
                      {formatDate(charge?.due_date)}
                    </td>

                    <td className="px-4 py-4">
                      {!charge ? (
                        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
                          Not billed
                        </span>
                      ) : charge.status === "paid" ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                          Paid
                        </span>
                      ) : member.autopay_active ? (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                          Awaiting Auto-Pay
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                          Unpaid
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {formatDate(charge?.paid_at)}
                    </td>

                    <td className="px-4 py-4">
                      {charge?.payment_method || "—"}
                    </td>

                    <td className="rounded-r-2xl px-4 py-4">
                      <Link
                        href={`/admin/members/${member.id}?tab=payments`}
                        className="font-bold text-[#8b6b2e] underline"
                      >
                        View Member
                      </Link>
                    </td>
                  </tr>
                ))}

                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="rounded-2xl bg-[#fbf8f2] px-4 py-10 text-center text-slate-500"
                    >
                      No members match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </section>
    </main>
  );
}
