import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addExpense,
  addPresetExpense,
  addZellePayment,
  importAccountingCsv,
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
    accountingError?: string;
    expenseAdded?: string;
    zelleAdded?: string;
  }>;
};

type Expense = {
  id: string;
  vendor: string;
  category: string | null;
  amount: number;
  expense_date: string | null;
  receipt_url: string | null;
};

type ZellePayment = {
  id: string;
  payer_name: string;
  payer_email: string | null;
  amount: number;
  received_date: string | null;
  purpose: string | null;
  status: string | null;
};

const monthlyExpensePresets = [
  { vendor: "Rent", category: "Rent", amount: 0 },
  { vendor: "Rabbi", category: "Payroll", amount: 0 },
  { vendor: "Utilities", category: "Utilities", amount: 0 },
  { vendor: "Cleaning", category: "Maintenance", amount: 0 },
  { vendor: "Kiddush", category: "Kiddush", amount: 0 },
];

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

function getMonthName(month: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(new Date(2026, month - 1, 1));
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
    .select("id, vendor, category, amount, expense_date, receipt_url")
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
      "id, payer_name, payer_email, amount, received_date, purpose, status"
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

  const [rows, expensesResult, zelleResult, yearlyExpenses, yearlyZelle] = await Promise.all([
    getAccountingRows(selectedMonth, selectedYear),
    getExpenses(selectedMonth, selectedYear),
    getZellePayments(selectedMonth, selectedYear),
    getExpenses(null, selectedYear),
    getZellePayments(null, selectedYear),
  ]);

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

  const yearlyExpenseTotal = yearlyExpenses.rows.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const yearlyZelleTotal = yearlyZelle.rows.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const graphMax = Math.max(
    billedTotal,
    paidTotal,
    outstandingTotal,
    expenseTotal,
    zelleTotal,
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

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-sm text-slate-400">Members Billed</p>
              <p className="mt-1 text-2xl font-bold">
                {billedRows.length}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Total Billed</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMoney(billedTotal)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Total Paid</p>
              <p className="mt-1 text-2xl font-bold text-green-300">
                {formatMoney(paidTotal)}
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

        {(query?.expenseAdded === "1" || query?.zelleAdded === "1") && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Accounting entry saved.
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {[
            ["monthly", "Monthly"],
            ["yearly", "Yearly"],
            ["uploads", "Uploads"],
            ["receipts", "Receipts"],
          ].map(([view, label]) => (
            <Link
              key={view}
              href={`/admin/accounting?month=${selectedMonth}&year=${selectedYear}&view=${view}`}
              className={
                activeView === view
                  ? "rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white shadow-sm"
                  : "rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-[#fbf8f2]"
              }
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Cash Flow Snapshot</h2>
              <p className="mt-1 text-sm text-slate-500">
                Billing, collected payments, expenses, and Zelle entries.
              </p>
            </div>

            {(expensesResult.error || zelleResult.error) && (
              <p className="max-w-xl rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Supabase setup needed for full accounting:
                {expensesResult.error ? " accounting_expenses" : ""}
                {expensesResult.error && zelleResult.error ? " and" : ""}
                {zelleResult.error ? " zelle_payments" : ""}.
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {[
              ["Billed", billedTotal, "bg-[#1d2940]"],
              ["Paid", paidTotal, "bg-green-600"],
              ["Outstanding", outstandingTotal, "bg-[#8b6b2e]"],
              ["Expenses", expenseTotal, "bg-red-600"],
              ["Zelle", zelleTotal, "bg-blue-600"],
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
        </div>

        {activeView === "yearly" && (
          <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">{selectedYear} Year Summary</h2>
            <p className="mt-1 text-sm text-slate-500">
              Expense and Zelle totals across the selected calendar year.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
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

              <div className="rounded-2xl bg-[#fbf8f2] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Net Zelle Less Expenses
                </p>
                <p className="mt-2 text-2xl font-black">
                  {formatMoney(yearlyZelleTotal - yearlyExpenseTotal)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">Monthly Expense Quick List</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter this month&apos;s amount and add common expenses without
              retyping the vendor and category.
            </p>

            <div className="mt-5 space-y-3">
              {monthlyExpensePresets.map((preset) => (
                <form
                  key={`${preset.vendor}-${preset.category}`}
                  action={addPresetExpense}
                  className="grid gap-3 rounded-2xl bg-[#fbf8f2] p-4 sm:grid-cols-[1fr_150px_150px_auto]"
                >
                  <div>
                    <p className="font-bold">{preset.vendor}</p>
                    <p className="text-sm text-slate-500">
                      {preset.category}
                    </p>
                  </div>

                  <input
                    type="hidden"
                    name="vendor"
                    value={preset.vendor}
                  />
                  <input
                    type="hidden"
                    name="category"
                    value={preset.category}
                  />

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
                      placeholder="0.00"
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Date
                    </span>
                    <input
                      name="expense_date"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-2"
                    />
                  </label>

                  <button
                    type="submit"
                    className="self-end rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Add
                  </button>
                </form>
              ))}
            </div>
          </div>

          <form
            action={importAccountingCsv}
            className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-bold">Upload CSV</h2>
            <p className="mt-1 text-sm text-slate-500">
              Import expenses or Zelle payments from a bank export.
            </p>

            <label className="mt-5 block space-y-2">
              <span className="font-semibold">Import Type</span>
              <select
                name="import_type"
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                defaultValue="expenses"
              >
                <option value="expenses">Expenses</option>
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
              payer_email, amount, received_date, purpose.
            </p>

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
            </div>

            <button
              type="submit"
              className="mt-5 rounded-full bg-[#8b6b2e] px-6 py-3 font-bold text-white"
            >
              Import CSV
            </button>
          </form>
        </div>

        {activeView === "receipts" && (
          <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">Receipt Links</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add receipts by pasting a receipt URL on an expense. Entries with
              receipts appear here.
            </p>

            <div className="mt-5 space-y-3">
              {expensesResult.rows
                .filter((expense) => Boolean(expense.receipt_url))
                .map((expense) => (
                  <a
                    key={expense.id}
                    href={expense.receipt_url || "#"}
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
                placeholder="Paste uploaded receipt link"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <label className="mt-4 block space-y-2">
              <span className="font-semibold">Note</span>
              <textarea
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

          <form
            action={addZellePayment}
            className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-bold">Bring In Zelle Payment</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">Payer Name</span>
                <input
                  name="payer_name"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Payer Email</span>
                <input
                  name="payer_email"
                  type="email"
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

            <label className="mt-4 block space-y-2">
              <span className="font-semibold">Purpose</span>
              <input
                name="purpose"
                placeholder="Dues, donation, Mishaberach..."
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <label className="mt-4 block space-y-2">
              <span className="font-semibold">Memo</span>
              <textarea
                name="note"
                rows={3}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <button
              type="submit"
              className="mt-5 rounded-full bg-[#8b6b2e] px-6 py-3 font-bold text-white"
            >
              Save Zelle Payment
            </button>
          </form>
        </div>

        <form
          method="GET"
          className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="space-y-2">
              <span className="font-semibold">Month</span>

              <select
                name="month"
                defaultValue={String(selectedMonth)}
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
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

            <label className="space-y-2">
              <span className="font-semibold">Year</span>

              <input
                name="year"
                type="number"
                min="2026"
                defaultValue={selectedYear}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

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
      </section>
    </main>
  );
}
