import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import SolaAutopayForm from "./SolaAutopayForm";
import AutopayControls from "./AutopayControls";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  status: string | null;
  portal_status: string | null;

  membership_type: string | null;
  custom_dues_amount: number | null;

  sola_customer_id: string | null;
  sola_payment_method_id: string | null;
  sola_recurring_id: string | null;

  autopay_active: boolean | null;
  recurring_amount: number | null;
  recurring_status: string | null;
  next_billing_date: string | null;
  autopay_billing_day: number | null;
  autopay_enrolled_at: string | null;
  autopay_cancelled_at: string | null;
};

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not currently scheduled";
  }

  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

  const date = dateOnlyPattern.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function displayStatus(member: Member) {
  if (!member.sola_recurring_id) {
    return "Not enrolled";
  }

  if (member.recurring_status) {
    const status = member.recurring_status.trim();

    if (status) {
      return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  return member.autopay_active ? "Active" : "Paused";
}

export default async function MemberAutopayPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: memberData, error: memberError } =
    await supabaseAdmin
      .from("members")
      .select(
        `
          id,
          first_name,
          last_name,
          email,
          status,
          portal_status,
          membership_type,
          custom_dues_amount,
          sola_customer_id,
          sola_payment_method_id,
          sola_recurring_id,
          autopay_active,
          recurring_amount,
          recurring_status,
          next_billing_date,
          autopay_billing_day,
          autopay_enrolled_at,
          autopay_cancelled_at
        `
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (memberError) {
    console.error(
      "Unable to load member autopay account:",
      memberError.message
    );

    throw new Error("Unable to load your automatic-payment account.");
  }

  if (!memberData) {
    redirect("/member/dashboard");
  }

  const member = memberData as Member;

  if (
    member.portal_status === "disabled" ||
    member.status === "inactive"
  ) {
    redirect("/member/dashboard");
  }

  const hasSchedule = Boolean(member.sola_recurring_id);

  const defaultAmount =
    Number(member.recurring_amount || 0) ||
    Number(member.custom_dues_amount || 0) ||
    1;

  const scheduleStatus = displayStatus(member);

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/member/dashboard"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            ← Back to Member Dashboard
          </Link>

          <Link
            href="/"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            Main Site
          </Link>
        </div>

        <section className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d9bf7a]">
            Member Portal
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Automatic Payments
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-slate-200">
            Enroll in monthly automatic payments or manage your existing
            Sola recurring-payment schedule.
          </p>
        </section>

        {hasSchedule ? (
          <>
            <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Schedule Status
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <span
                    className={
                      member.autopay_active
                        ? "h-3 w-3 rounded-full bg-green-600"
                        : "h-3 w-3 rounded-full bg-amber-500"
                    }
                  />

                  <p className="text-2xl font-bold">
                    {scheduleStatus}
                  </p>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  {member.autopay_active
                    ? "Future automatic payments are enabled."
                    : "Future automatic payments are currently paused."}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Monthly Amount
                </p>

                <p className="mt-3 text-3xl font-bold">
                  {formatMoney(member.recurring_amount)}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Charged through your saved Sola payment method.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:col-span-2 lg:col-span-1">
                <p className="text-sm font-semibold text-slate-500">
                  Next Payment
                </p>

                <p className="mt-3 text-xl font-bold">
                  {member.autopay_active
                    ? formatDate(member.next_billing_date)
                    : "Paused"}
                </p>

                {member.autopay_billing_day ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Billing day: Day {member.autopay_billing_day} of each
                    month
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Managed through your Sola recurring schedule.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#8b6b2e]">
                  Manage Schedule
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  Update Automatic Payments
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Change your monthly amount, pause future payments,
                  resume a paused schedule, or permanently cancel your
                  automatic-payment schedule.
                </p>
              </div>

              <AutopayControls
                active={Boolean(member.autopay_active)}
                amount={Number(member.recurring_amount || 0)}
              />
            </section>

            <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-bold">
                Payment History and Receipts
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Completed automatic payments and downloadable receipts are
                available in your member dashboard.
              </p>

              <Link
                href="/member/dashboard"
                className="mt-5 inline-flex rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#10192b]"
              >
                View Payments and Receipts
              </Link>
            </section>

            <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-[#fbf8f2] p-6">
              <h2 className="font-bold">About Your Saved Card</h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Your complete card number is not stored on the Khal Bnei
                Aliya website. Your payment method and recurring schedule
                are securely maintained by Sola.
              </p>

              {member.autopay_enrolled_at ? (
                <p className="mt-3 text-xs text-slate-500">
                  Enrolled: {formatDate(member.autopay_enrolled_at)}
                </p>
              ) : null}
            </section>
          </>
        ) : (
          <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#8b6b2e]">
                Enrollment
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Set Up Automatic Payments
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Enter your card through Sola’s secure payment fields,
                select your monthly amount and billing day, and authorize
                future automatic payments.
              </p>
            </div>

            <div className="mt-7">
              <SolaAutopayForm
                memberName={`${member.first_name} ${member.last_name}`}
                defaultAmount={defaultAmount}
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}