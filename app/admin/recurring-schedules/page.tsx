import Link from "next/link";
import { callSolaRecurringApi } from "@/lib/solaRecurring";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  linkRecurringSchedule,
  syncHistoricalSolaPayments,
  syncRecurringPayments,
  unlinkRecurringSchedule,
} from "./actions";

export const dynamic = "force-dynamic";

type Schedule = {
  ScheduleId?: string;
  ScheduleName?: string;
  CustomerId?: string;
  PaymentMethodId?: string;

  Email?: string;
  BillFirstName?: string;
  BillLastName?: string;
  BillName?: string;

  Amount?: number | string;
  IntervalType?: string;
  IntervalCount?: number | string;

  PaymentsProcessed?: number | string;
  LastTransactionStatus?: string;
  LastTransactionError?: string;

  NextScheduledRunTime?: string;
  LastRunTime?: string;
  CreatedDate?: string;

  IsActive?: boolean | string;
  Active?: boolean | string;
  IsDeleted?: boolean | string;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;

  sola_customer_id: string | null;
  sola_payment_method_id: string | null;
  sola_recurring_id: string | null;

  autopay_active: boolean | null;
  recurring_amount: number | null;
  recurring_status: string | null;
  next_billing_date: string | null;
};

type PageProps = {
  searchParams: Promise<{
    linked?: string;
    unlinked?: string;
    synced?: string;
    imported?: string;
    skipped?: string;
    receiptErrors?: string;
    historicalSynced?: string;
    historicalImported?: string;
    historicalSkipped?: string;
    historicalUnmatched?: string;
    error?: string;
  }>;
};

function parseArray(value: unknown): Schedule[] {
  if (Array.isArray(value)) {
    return value as Schedule[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? (parsed as Schedule[])
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: unknown) {
  const text = String(value || "").trim();

  if (!text) {
    return "—";
  }

  const normalized = text.includes("T")
    ? text
    : text.replace(" ", "T");

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isScheduleActive(schedule: Schedule) {
  const value =
    schedule.IsActive ?? schedule.Active ?? false;

  if (typeof value === "boolean") {
    return value;
  }

  const text = String(value).toLowerCase();

  return (
    text === "true" ||
    text === "1" ||
    text === "yes" ||
    text === "active"
  );
}

function scheduleName(schedule: Schedule) {
  const explicit = String(
    schedule.ScheduleName || ""
  ).trim();

  if (explicit) {
    return explicit;
  }

  const fullName = [
    schedule.BillFirstName,
    schedule.BillLastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || "Unnamed recurring schedule";
}

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

async function getMembers(): Promise<Member[]> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      `
        id,
        first_name,
        last_name,
        email,
        sola_customer_id,
        sola_payment_method_id,
        sola_recurring_id,
        autopay_active,
        recurring_amount,
        recurring_status,
        next_billing_date
      `
    )
    .order("last_name", {
      ascending: true,
    })
    .order("first_name", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Member[];
}

async function getSchedules(): Promise<Schedule[]> {
  const response =
    await callSolaRecurringApi("ListSchedules", {
      PageSize: 500,
      SortOrder: "Descending",
      Filters: {
        IsDeleted: false,
      },
    });

  return parseArray(response.Schedules);
}

export default async function RecurringSchedulesPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const today = dateInputValue(now);
  const thirtyDaysAgo = dateInputValue(addDays(now, -30));

  const [members, schedules] = await Promise.all([
    getMembers(),
    getSchedules(),
  ]);

  const memberByScheduleId = new Map(
    members
      .filter((member) => member.sola_recurring_id)
      .map((member) => [
        member.sola_recurring_id as string,
        member,
      ])
  );

  const memberByEmail = new Map(
    members
      .filter((member) => normalizeEmail(member.email))
      .map((member) => [
        normalizeEmail(member.email),
        member,
      ])
  );

  const linkedCount = schedules.filter((schedule) =>
    memberByScheduleId.has(
      String(schedule.ScheduleId || "")
    )
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            ← Back to Admin
          </Link>

          <Link
            href="/admin/accounting"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            Accounting Dashboard
          </Link>
        </div>

        <section className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d9bf7a]">
            Admin
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Sola Recurring Schedules
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-slate-200">
            Link existing Sola schedules to member accounts and
            import their approved recurring-payment history.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
            <span className="rounded-full bg-white/10 px-4 py-2">
              {schedules.length} schedules
            </span>

            <span className="rounded-full bg-white/10 px-4 py-2">
              {linkedCount} linked
            </span>

            <span className="rounded-full bg-white/10 px-4 py-2">
              {schedules.length - linkedCount} unlinked
            </span>
          </div>
        </section>

        {params.linked === "1" ? (
          <Message type="success">
            Recurring schedule linked to the member.
          </Message>
        ) : null}

        {params.unlinked === "1" ? (
          <Message type="success">
            The schedule was unlinked from the member.
          </Message>
        ) : null}

        {params.synced === "1" ? (
          <Message type="success">
            Payment sync completed. Imported{" "}
            {params.imported || "0"}, skipped{" "}
            {params.skipped || "0"}.
            {Number(params.receiptErrors || 0) > 0
              ? ` ${params.receiptErrors} receipt email or PDF attempts need attention.`
              : ""}
          </Message>
        ) : null}

        {params.historicalSynced === "1" ? (
          <Message type="success">
            Historical Sola import completed. Imported{" "}
            {params.historicalImported || "0"}, skipped{" "}
            {params.historicalSkipped || "0"}, unmatched{" "}
            {params.historicalUnmatched || "0"}.
          </Message>
        ) : null}

        {params.error ? (
          <Message type="error">{params.error}</Message>
        ) : null}

        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.6fr)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
                Historical Import
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Import Previous Sola Payments
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Pull approved one-time Sola/Cardknox payments from the
                Reporting API. The importer skips duplicates by reference
                number, attaches matched payments to members, and counts
                unmatched rows for review.
              </p>
            </div>

            <form
              action={syncHistoricalSolaPayments}
              className="grid gap-3 rounded-2xl bg-[#fbf8f2] p-4 sm:grid-cols-2"
            >
              <label className="space-y-2 text-sm font-bold text-slate-700">
                From
                <input
                  type="date"
                  name="from_date"
                  defaultValue={thirtyDaysAgo}
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                />
              </label>

              <label className="space-y-2 text-sm font-bold text-slate-700">
                To
                <input
                  type="date"
                  name="to_date"
                  defaultValue={today}
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                />
              </label>

              <button
                type="submit"
                className="rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white sm:col-span-2"
              >
                Import Approved Payments
              </button>
            </form>
          </div>
        </section>

        <section className="mt-8 space-y-5">
          {schedules.map((schedule) => {
            const scheduleId = String(
              schedule.ScheduleId || ""
            );

            const customerId = String(
              schedule.CustomerId || ""
            );

            const paymentMethodId = String(
              schedule.PaymentMethodId || ""
            );

            const email = normalizeEmail(
              schedule.Email
            );

            const linkedMember =
              memberByScheduleId.get(scheduleId);

            const suggestedMember =
              linkedMember ||
              memberByEmail.get(email) ||
              null;

            const active = isScheduleActive(schedule);
            const amount = Number(schedule.Amount || 0);

            const nextBillingDate = String(
              schedule.NextScheduledRunTime || ""
            ).slice(0, 10);

            return (
              <article
                key={scheduleId}
                className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
              >
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(330px,0.55fr)]">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold">
                          {scheduleName(schedule)}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {schedule.Email || "No email in Sola"}
                        </p>
                      </div>

                      <span
                        className={
                          active
                            ? "rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-800"
                            : "rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"
                        }
                      >
                        {active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Detail
                        label="Amount"
                        value={formatMoney(schedule.Amount)}
                      />

                      <Detail
                        label="Frequency"
                        value={`Every ${
                          schedule.IntervalCount || 1
                        } ${
                          schedule.IntervalType || "month"
                        }`}
                      />

                      <Detail
                        label="Next Billing"
                        value={formatDate(
                          schedule.NextScheduledRunTime
                        )}
                      />

                      <Detail
                        label="Payments Processed"
                        value={String(
                          schedule.PaymentsProcessed || 0
                        )}
                      />
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <Detail
                        label="Last Status"
                        value={
                          schedule.LastTransactionStatus ||
                          "—"
                        }
                      />

                      <Detail
                        label="Schedule ID"
                        value={scheduleId || "—"}
                        mono
                      />
                    </div>

                    {schedule.LastTransactionError ? (
                      <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        {schedule.LastTransactionError}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl bg-[#fbf8f2] p-5">
                    {linkedMember ? (
                      <>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-green-700">
                          Linked Member
                        </p>

                        <p className="mt-2 text-lg font-bold">
                          {linkedMember.first_name}{" "}
                          {linkedMember.last_name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {linkedMember.email || "No email"}
                        </p>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <form
                            action={syncRecurringPayments}
                          >
                            <input
                              type="hidden"
                              name="member_id"
                              value={linkedMember.id}
                            />

                            <input
                              type="hidden"
                              name="schedule_id"
                              value={scheduleId}
                            />

                            <input
                              type="hidden"
                              name="customer_id"
                              value={customerId}
                            />

                            <input
                              type="hidden"
                              name="amount"
                              value={amount}
                            />

                            <button
                              type="submit"
                              className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
                            >
                              Sync Payments
                            </button>
                          </form>

                          <Link
                            href={`/admin/members/${linkedMember.id}/payments`}
                            className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold"
                          >
                            View Payments
                          </Link>
                        </div>

                        <form
                          action={unlinkRecurringSchedule}
                          className="mt-3"
                        >
                          <input
                            type="hidden"
                            name="member_id"
                            value={linkedMember.id}
                          />

                          <button
                            type="submit"
                            className="text-sm font-bold text-red-700 hover:underline"
                          >
                            Unlink Schedule
                          </button>
                        </form>
                      </>
                    ) : (
                      <form
                        action={linkRecurringSchedule}
                        className="space-y-4"
                      >
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8b6b2e]">
                            Link to Member
                          </p>

                          {suggestedMember ? (
                            <p className="mt-2 text-sm text-slate-600">
                              Suggested by matching email:{" "}
                              <strong>
                                {suggestedMember.first_name}{" "}
                                {suggestedMember.last_name}
                              </strong>
                            </p>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">
                              Choose the matching member.
                            </p>
                          )}
                        </div>

                        <select
                          name="member_id"
                          required
                          defaultValue={
                            suggestedMember?.id || ""
                          }
                          className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                        >
                          <option value="">
                            Select a member
                          </option>

                          {members.map((member) => (
                            <option
                              key={member.id}
                              value={member.id}
                            >
                              {member.first_name}{" "}
                              {member.last_name}
                              {member.email
                                ? ` — ${member.email}`
                                : ""}
                            </option>
                          ))}
                        </select>

                        <input
                          type="hidden"
                          name="schedule_id"
                          value={scheduleId}
                        />

                        <input
                          type="hidden"
                          name="customer_id"
                          value={customerId}
                        />

                        <input
                          type="hidden"
                          name="payment_method_id"
                          value={paymentMethodId}
                        />

                        <input
                          type="hidden"
                          name="amount"
                          value={amount}
                        />

                        <input
                          type="hidden"
                          name="next_billing_date"
                          value={nextBillingDate}
                        />

                        <input
                          type="hidden"
                          name="is_active"
                          value={String(active)}
                        />

                        <input
                          type="hidden"
                          name="schedule_status"
                          value={
                            active ? "active" : "inactive"
                          }
                        />

                        <button
                          type="submit"
                          className="w-full rounded-xl bg-[#1d2940] px-5 py-3 font-bold text-white"
                        >
                          Link Schedule
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {schedules.length === 0 ? (
            <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
              No Sola recurring schedules were returned.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 font-semibold ${
          mono ? "break-all font-mono text-xs" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Message({
  type,
  children,
}: {
  type: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        type === "success"
          ? "mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800"
          : "mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800"
      }
    >
      {children}
    </div>
  );
}
