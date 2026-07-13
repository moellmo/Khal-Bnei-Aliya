import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateMonthlyDues } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    generated?: string;
    created?: string;
    skipped?: string;
    emailed?: string;
  }>;
};

async function getActiveMembers() {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, recurring_amount, custom_dues_amount, autopay_active, sola_recurring_id, recurring_status"
    )
    .eq("status", "active")
    .order("last_name", { ascending: true });

  if (error) {
    console.error("Error loading members:", error.message);
    return [];
  }

  return data || [];
}

async function getBillingSummary() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: charges, error } = await supabaseAdmin
    .from("member_charges")
    .select("id, amount, status")
    .eq("charge_type", "Membership Dues")
    .eq("billing_month", month)
    .eq("billing_year", year);

  if (error) {
    console.error("Error loading billing summary:", error.message);
    return {
      totalCharges: 0,
      billedTotal: 0,
      paidTotal: 0,
      unpaidTotal: 0,
    };
  }

  const rows = charges || [];

  return {
    totalCharges: rows.length,
    billedTotal: rows.reduce(
      (sum, charge) => sum + Number(charge.amount || 0),
      0
    ),
    paidTotal: rows
      .filter((charge) => charge.status === "paid")
      .reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
    unpaidTotal: rows
      .filter((charge) => charge.status !== "paid")
      .reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
  };
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function getMemberName(member: {
  first_name?: string | null;
  last_name?: string | null;
}) {
  return [member.first_name, member.last_name].filter(Boolean).join(" ");
}

function getBillingPreview(member: {
  recurring_amount?: number | string | null;
  custom_dues_amount?: number | string | null;
  autopay_active?: boolean | null;
  sola_recurring_id?: string | null;
  recurring_status?: string | null;
}) {
  const recurringStatus = member.recurring_status?.trim().toLowerCase();
  const hasRecurringSchedule =
    Boolean(member.autopay_active) ||
    (Boolean(member.sola_recurring_id) &&
      recurringStatus !== "cancelled" &&
      recurringStatus !== "unlinked");

  if (hasRecurringSchedule) {
    return {
      amount: "Skipped",
      source: "Recurring autopay",
      usesDefault: false,
      isSkipped: true,
    };
  }

  const customDuesAmount = Number(member.custom_dues_amount || 0);

  if (customDuesAmount > 0) {
    return {
      amount: formatMoney(customDuesAmount),
      source: "Member dues amount",
      usesDefault: false,
      isSkipped: false,
    };
  }

  return {
    amount: "Default below",
    source: "No member amount set",
    usesDefault: true,
    isSkipped: false,
  };
}

export default async function BillingPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const summary = await getBillingSummary();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const members = await getActiveMembers();

  const defaultDueDate = `${currentYear}-${String(currentMonth).padStart(
    2,
    "0"
  )}-15`;

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin"
            className="text-sm font-semibold text-[#8b6b2e]"
          >
            ← Admin Home
          </Link>

          <Link
            href="/admin/members"
            className="text-sm font-semibold text-[#8b6b2e]"
          >
            Members
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-8 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Membership Billing
          </p>

          <h1 className="mt-3 text-4xl font-bold">Monthly Dues</h1>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-slate-400">Charges</p>
              <p className="text-xl font-bold">{summary.totalCharges}</p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Total Billed</p>
              <p className="text-xl font-bold">
                {formatMoney(summary.billedTotal)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Paid</p>
              <p className="text-xl font-bold text-green-300">
                {formatMoney(summary.paidTotal)}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Outstanding</p>
              <p className="text-xl font-bold text-[#f0d99a]">
                {formatMoney(summary.unpaidTotal)}
              </p>
            </div>
          </div>
        </div>

        {query?.generated === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Created {query.created || "0"} monthly dues charges. Skipped{" "}
            {query.skipped || "0"} existing charges. Sent{" "}
            {query.emailed || "0"} email reminders.
          </div>
        )}

        <form
          action={generateMonthlyDues}
          className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
        >
          <h2 className="text-2xl font-bold">Generate Monthly Dues</h2>

          <p className="mt-1 text-sm text-slate-500">
            Members on recurring autopay are skipped. Everyone else is charged
            their member dues amount, with the default below used only when no
            amount is set.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="font-semibold">Generate For</span>

              <select
                name="member_id"
                defaultValue=""
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
              >
                <option value="">All Active Members</option>

                {members.map((member) => {
                  const billingPreview = getBillingPreview(member);

                  return (
                    <option key={member.id} value={member.id}>
                      {member.last_name}, {member.first_name} -{" "}
                      {billingPreview.amount}
                      {billingPreview.isSkipped ? " - Recurring" : ""}
                    </option>
                  );
                })}
              </select>

              <p className="text-xs text-slate-500">
                Leave this as All Active Members for the monthly batch, or
                choose one member for an individual charge.
              </p>
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Billing Month</span>
              <select
                name="billing_month"
                defaultValue={currentMonth}
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
              <span className="font-semibold">Billing Year</span>
              <input
                name="billing_year"
                type="number"
                min="2026"
                defaultValue={currentYear}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="font-semibold">Default Monthly Amount</span>
              <input
                name="default_amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="75.00"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
              <p className="text-xs text-slate-500">
                Used only for non-recurring members without a member dues
                amount.
              </p>
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Due Date</span>
              <input
                name="due_date"
                type="date"
                required
                defaultValue={defaultDueDate}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>
          </div>

          <div className="mt-6 rounded-2xl bg-[#fbf8f2] p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Member Amount Preview</h3>
                <p className="mt-1 text-sm text-slate-500">
                  This is what the monthly batch will use before falling back
                  to the default amount. Recurring autopay members are skipped.
                </p>
              </div>

              <p className="text-sm font-semibold text-[#8b6b2e]">
                {members.length} active members
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => {
                const billingPreview = getBillingPreview(member);

                return (
                  <div
                    key={member.id}
                    className="rounded-xl border border-[#e3d9c7] bg-white p-3"
                  >
                    <p className="font-semibold">
                      {getMemberName(member) || "Unnamed member"}
                    </p>
                    <p
                      className={
                        billingPreview.usesDefault
                          ? "mt-1 text-sm font-semibold text-amber-700"
                          : billingPreview.isSkipped
                            ? "mt-1 text-sm font-semibold text-slate-500"
                          : "mt-1 text-sm font-semibold text-green-700"
                      }
                    >
                      {billingPreview.amount}
                    </p>
                    <p className="text-xs text-slate-500">
                      {billingPreview.source}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
          >
            Generate Dues Charges
          </button>
        </form>
      </section>
    </main>
  );
}
