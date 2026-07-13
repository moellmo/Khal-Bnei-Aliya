import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signOut } from "../actions";
import SolaMemberPaymentForm from "./SolaMemberPaymentForm";
import GenerateReceiptButton from "./GenerateReceiptButton";
import { submitZellePaymentClaim } from "./actions";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  membership_type: string | null;
  custom_dues_amount: number | null;
  autopay_active: boolean | null;
  recurring_amount: number | null;
  recurring_status: string | null;
  next_billing_date: string | null;
  sola_recurring_id: string | null;
  portal_status: string | null;
  portal_role: string | null;
};

type Charge = {
  id: string;
  charge_type: string;
  description: string | null;
  amount: number;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
};

type PaymentAttempt = {
  id: string;
  charge_id: string | null;
  amount: number;
  status: string;
  failure_message: string | null;
  attempted_at: string;
  resolved_at: string | null;
};

type Payment = {
  id: string;
  charge_id: string | null;
  amount: number;
  payment_method: string | null;
  payment_provider: string | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
  receipt_number: string | null;
  receipt_pdf_url: string | null;
};

type PageProps = {
  searchParams?: Promise<{
    zelleSubmitted?: string;
  }>;
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

function getChargeTitle(charge: Charge) {
  return charge.description || charge.charge_type || "Member charge";
}

function isOpenAmountCharge(charge: Charge) {
  return (
    Number(charge.amount || 0) <= 0 ||
    charge.charge_type.toLowerCase() === "matana" ||
    (charge.description || "").toLowerCase().includes("matana")
  );
}

function getPaymentMethod(payment: Payment) {
  if (
    payment.payment_provider?.toLowerCase() === "sola" ||
    payment.payment_method?.toLowerCase() === "card"
  ) {
    return "Card";
  }

  return payment.payment_method || "Payment";
}

function ZelleClaimForm({ charge }: { charge: Charge }) {
  const openAmount = isOpenAmountCharge(charge);
  const amount = Number(charge.amount || 0);

  return (
    <form
      action={submitZellePaymentClaim}
      className="mt-3 space-y-3 rounded-xl bg-[#fbf8f2] p-3"
    >
      <input type="hidden" name="charge_id" value={charge.id} />

      <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        Zelle Amount Sent
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          readOnly={!openAmount}
          defaultValue={openAmount ? "" : amount.toFixed(2)}
          className="mt-1 w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2 text-sm text-slate-900"
        />
      </label>

      <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        Optional memo
        <input
          name="note"
          className="mt-1 w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2 text-sm text-slate-900"
          placeholder="Confirmation note or sender name"
        />
      </label>

      <button
        type="submit"
        className="rounded-full bg-[#1d2940] px-4 py-2 text-xs font-bold text-white"
      >
        I Paid by Zelle
      </button>
    </form>
  );
}

export default async function MemberDashboardPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: member, error: memberError } = await supabaseAdmin
  .from("members")
  .select(
    `
      id,
      first_name,
      last_name,
      email,
      membership_type,
      custom_dues_amount,
      autopay_active,
      recurring_amount,
      recurring_status,
      next_billing_date,
sola_recurring_id,
portal_status,
portal_role
    `
  )
  .eq("auth_user_id", user.id)
  .maybeSingle();

  if (memberError) {
    console.error("Unable to load member account:", memberError.message);
  }

  if (!member) {
    return (
      <main className="min-h-screen bg-[#f7f3ea] px-5 py-10 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">Member Account Not Linked</h1>

          <p className="mt-4 text-slate-600">
            Your login is active, but it is not connected to a membership
            record. Please contact the shul office.
          </p>

          <p className="mt-3 text-sm text-slate-500">
            Signed in as {user.email}
          </p>

          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
            >
              Sign Out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const typedMember = member as Member;

  const isAdmin = typedMember.portal_role === "admin";

  const { data: chargeData, error: chargeError } = await supabaseAdmin
    .from("member_charges")
    .select(
      `
        id,
        charge_type,
        description,
        amount,
        status,
        due_date,
        created_at
      `
    )
    .eq("member_id", typedMember.id)
    .neq("status", "paid")
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (chargeError) {
    console.error("Unable to load member charges:", chargeError.message);
  }

  const { data: paymentData, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select(
      `
        id,
        charge_id,
        amount,
        payment_method,
        payment_provider,
        status,
        paid_at,
        created_at,
        receipt_number,
        receipt_pdf_url
      `
    )
    .eq("member_id", typedMember.id)
    .order("paid_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(5);

  if (paymentError) {
    console.error("Unable to load member payments:", paymentError.message);
  }

  const { data: attemptData, error: attemptError } =
  await supabaseAdmin
    .from("payment_attempts")
    .select(
      `
        id,
        charge_id,
        amount,
        status,
        failure_message,
        attempted_at,
        resolved_at
      `
    )
    .eq("member_id", typedMember.id)
    .eq("status", "failed")
    .is("resolved_at", null)
    .order("attempted_at", {
      ascending: false,
    })
    .limit(1);

if (attemptError) {
  console.error(
    "Unable to load failed payment attempts:",
    attemptError.message
  );
}

const latestFailedAttempt =
  ((attemptData || []) as PaymentAttempt[])[0] || null;

  const openCharges = (chargeData || []) as Charge[];
  const payments = (paymentData || []) as Payment[];

  const outstandingBalance = openCharges.reduce(
    (total, charge) => total + Number(charge.amount || 0),
    0
  );

  const membershipCharges = openCharges.filter(
    (charge) => charge.charge_type === "Membership Dues"
  );

  const otherCharges = openCharges.filter(
    (charge) => charge.charge_type !== "Membership Dues"
  );

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
<header className="rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <Link
        href="/"
        className="text-sm font-bold text-[#8b6b2e] hover:underline"
      >
        ← Back to Main Site
      </Link>

      <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
        Khal Bnei Aliya
      </p>

      <h1 className="mt-2 text-3xl font-bold">
        Welcome, {typedMember.first_name}
      </h1>

      <p className="mt-2 text-slate-600">
        View your membership dues, charges, payments, and receipts.
      </p>
    </div>

    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/"
        className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold transition hover:bg-[#f2eadc]"
      >
        Main Site
      </Link>

      <Link
  href="/member/mishaberach"
  className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold transition hover:bg-[#f2eadc]"
>
  Manage Mishaberach Card
</Link>

      {isAdmin ? (
        <>
          <Link
            href="/admin"
            className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#10192b]"
          >
            Admin Dashboard
          </Link>

          <Link
            href="/admin/accounting"
            className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold transition hover:bg-[#f2eadc]"
          >
            Accounting Dashboard
          </Link>
        </>
      ) : null}
      

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50"
        >
          Sign Out
        </button>
      </form>
    </div>
  </div>
</header>
{query?.zelleSubmitted === "1" ? (
  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
    Your Zelle payment was submitted for review. It will show as paid after
    admin confirms it.
  </div>
) : null}
{latestFailedAttempt ? (
  <section className="mt-6 rounded-[1.5rem] border border-red-200 bg-red-50 p-6 shadow-sm">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-red-700">
          Automatic Payment Failed
        </p>

        <h2 className="mt-2 text-2xl font-bold text-red-900">
          We could not process your payment of{" "}
          {formatMoney(latestFailedAttempt.amount)}
        </h2>

        <p className="mt-2 text-sm leading-6 text-red-800">
          {latestFailedAttempt.failure_message ||
            "The card issuer did not approve the transaction."}
        </p>

        <p className="mt-2 text-sm text-red-700">
          Attempted{" "}
          {formatDate(latestFailedAttempt.attempted_at)}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/member/autopay/update-card"
          className="rounded-full border border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-800 transition hover:bg-red-100"
        >
          Replace Saved Card
        </Link>

        {latestFailedAttempt.charge_id ? (
          <a
            href={`#charge-${latestFailedAttempt.charge_id}`}
            className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800"
          >
            Pay Now
          </a>
        ) : (
          <Link
            href="/member/autopay"
            className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800"
          >
            Manage Automatic Payments
          </Link>
        )}
      </div>
    </div>
  </section>
) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-[1.5rem] bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Outstanding Balance
            </p>

            <p className="mt-3 text-3xl font-bold">
              {formatMoney(outstandingBalance)}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Across {openCharges.length} open{" "}
              {openCharges.length === 1 ? "charge" : "charges"}
            </p>
          </div>

          <div className="rounded-[1.5rem] bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Membership
            </p>

            <p className="mt-3 text-xl font-bold">
              {typedMember.membership_type || "Member"}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Standard dues:{" "}
              {formatMoney(typedMember.custom_dues_amount)}
            </p>
          </div>

          <div className="rounded-[1.5rem] bg-white p-6 shadow-sm">
  <p className="text-sm font-semibold text-slate-500">
    Automatic Payments
  </p>

  <p className="mt-3 text-xl font-bold">
    {typedMember.sola_recurring_id
      ? typedMember.autopay_active
        ? "Active"
        : typedMember.recurring_status === "cancelled"
          ? "Cancelled"
          : "Paused"
      : "Not enrolled"}
  </p>

  {typedMember.sola_recurring_id ? (
    <div className="mt-2 space-y-2 text-sm text-slate-500">
      <p>
        Amount: {formatMoney(typedMember.recurring_amount)}
      </p>

      <p>
        Next payment:{" "}
        {typedMember.autopay_active
          ? formatDate(typedMember.next_billing_date)
          : "Not currently scheduled"}
      </p>

      {typedMember.recurring_status ? (
        <p>
          Status:{" "}
          <span className="font-semibold capitalize text-slate-700">
            {typedMember.recurring_status}
          </span>
        </p>
      ) : null}

      <Link
        href="/member/autopay"
        className="mt-3 inline-flex rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#10192b]"
      >
        Manage Automatic Payments
      </Link>
    </div>
  ) : (
    <div className="mt-4">
      <p className="text-sm text-slate-500">
        Set up secure monthly payments through Sola.
      </p>

      <Link
        href="/member/autopay"
        className="mt-3 inline-flex rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#10192b]"
      >
        Set Up Automatic Payments
      </Link>
    </div>
  )}
</div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Membership Dues</h2>

              <p className="mt-2 text-sm text-slate-500">
                Your unpaid membership dues.
              </p>
            </div>

            {membershipCharges.length > 0 ? (
              <span className="rounded-full bg-[#f7f3ea] px-4 py-2 text-sm font-bold text-[#8b6b2e]">
                {formatMoney(
                  membershipCharges.reduce(
                    (total, charge) =>
                      total + Number(charge.amount || 0),
                    0
                  )
                )}
              </span>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            {membershipCharges.map((charge) => (
              <div
  key={charge.id}
  id={`charge-${charge.id}`}
                className="flex flex-col gap-4 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold">
                    {getChargeTitle(charge)}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Due {formatDate(charge.due_date)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xl font-bold">
                    {isOpenAmountCharge(charge)
                      ? "Choose amount"
                      : formatMoney(charge.amount)}
                  </p>

                  <SolaMemberPaymentForm
  chargeId={charge.id}
  amount={Number(charge.amount || 0)}
  memberName={`${typedMember.first_name} ${typedMember.last_name}`}
  memberEmail={typedMember.email || ""}
  allowOpenAmount={isOpenAmountCharge(charge)}
/>

                  <details className="rounded-xl border border-[#e3d9c7] bg-white px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-bold text-[#8b6b2e]">
                      Pay by Zelle
                    </summary>
                    <div className="mt-3 text-slate-600">
                      <p>
                        Send to{" "}
                        <span className="font-bold text-slate-900">
                          khalbneialiyah@gmail.com
                        </span>
                      </p>
                      <p className="mt-1">
                        Memo: KBA-{charge.id.slice(0, 8)}{" "}
                        {isOpenAmountCharge(charge)
                          ? "Matana"
                          : formatMoney(charge.amount)}
                        </p>
                      </div>
                      <ZelleClaimForm charge={charge} />
                  </details>
                </div>
              </div>
            ))}

            {membershipCharges.length === 0 ? (
              <div className="rounded-2xl bg-green-50 p-6 text-center">
                <p className="font-bold text-green-800">
                  Your membership dues are paid.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold">Other Open Charges</h2>

          <p className="mt-2 text-sm text-slate-500">
            Donations, pledges, aliyahs, sponsorships, and other charges.
          </p>

          <div className="mt-6 space-y-4">
            {otherCharges.map((charge) => (
              <div
  key={charge.id}
  id={`charge-${charge.id}`}
                className="flex flex-col gap-4 rounded-2xl border border-[#e3d9c7] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold">
                    {getChargeTitle(charge)}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {charge.charge_type} · Due{" "}
                    {formatDate(charge.due_date)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xl font-bold">
                    {isOpenAmountCharge(charge)
                      ? "Choose amount"
                      : formatMoney(charge.amount)}
                  </p>

                  <SolaMemberPaymentForm
  chargeId={charge.id}
  amount={Number(charge.amount || 0)}
  memberName={`${typedMember.first_name} ${typedMember.last_name}`}
  memberEmail={typedMember.email || ""}
  allowOpenAmount={isOpenAmountCharge(charge)}
/>

                  <details className="rounded-xl border border-[#e3d9c7] bg-white px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-bold text-[#8b6b2e]">
                      Pay by Zelle
                    </summary>
                    <div className="mt-3 text-slate-600">
                      <p>
                        Send to{" "}
                        <span className="font-bold text-slate-900">
                          khalbneialiyah@gmail.com
                        </span>
                      </p>
                      <p className="mt-1">
                        Memo: KBA-{charge.id.slice(0, 8)}{" "}
                        {isOpenAmountCharge(charge)
                          ? "Matana"
                          : formatMoney(charge.amount)}
                        </p>
                      </div>
                      <ZelleClaimForm charge={charge} />
                  </details>
                </div>
              </div>
            ))}

            {otherCharges.length === 0 ? (
              <p className="rounded-2xl bg-[#fbf8f2] p-6 text-center text-slate-500">
                No other outstanding charges.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Recent Payments</h2>

              <p className="mt-2 text-sm text-slate-500">
                View completed payments and download receipts.
              </p>
            </div>

            <Link
              href="/member/payments"
              className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold text-[#1d2940]"
            >
              View All Payments
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto">
            {payments.length > 0 ? (
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Amount</th>
                    <th className="px-3 py-3 font-semibold">Method</th>
                    <th className="px-3 py-3 font-semibold">Receipt</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Download
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-4">
                        {formatDate(
                          payment.paid_at || payment.created_at
                        )}
                      </td>

                      <td className="px-3 py-4 font-bold">
                        {formatMoney(payment.amount)}
                      </td>

                      <td className="px-3 py-4">
                        {getPaymentMethod(payment)}
                      </td>

                      <td className="px-3 py-4">
                        {payment.receipt_number || "—"}
                      </td>

                      <td className="px-3 py-4 text-right">
                 {payment.receipt_pdf_url ? (
  <Link
    href={`/api/member/receipts/${payment.id}`}
    target="_blank"
    className="inline-flex rounded-full border border-[#8b6b2e] px-4 py-2 text-sm font-bold text-[#8b6b2e] hover:bg-[#f7f3ea]"
  >
    View PDF
  </Link>
) : (
  <GenerateReceiptButton paymentId={payment.id} />
)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-2xl bg-[#fbf8f2] p-6 text-center text-slate-500">
                No payments have been recorded yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
