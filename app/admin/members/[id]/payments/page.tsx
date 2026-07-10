import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  hebrew_name: string | null;
  email: string | null;
};

type Payment = {
  id: string;
  member_id: string;
  charge_id: string | null;
  amount: number;
  payment_method: string | null;
  payment_provider: string | null;
  external_payment_id: string | null;
  payer_email: string | null;
  status: string | null;
  note: string | null;
  paid_at: string | null;
  created_at: string | null;
  sola_recurring_id: string | null;
  receipt_number: string | null;
  receipt_pdf_url: string | null;
};

type Charge = {
  id: string;
  charge_type: string;
  description: string | null;
  amount: number;
  status: string | null;
  due_date: string | null;
};

type PaymentRow = Payment & {
  charge: Charge | null;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getMember(id: string) {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, first_name, last_name, hebrew_name, email")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error loading member:", error.message);
    return null;
  }

  return data as Member | null;
}

async function getPayments(memberId: string): Promise<PaymentRow[]> {
  const { data: payments, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select(
      `
        id,
        member_id,
        charge_id,
        amount,
        payment_method,
        payment_provider,
        external_payment_id,
        payer_email,
        status,
        note,
        paid_at,
        created_at,
        sola_recurring_id,
        receipt_number,
        receipt_pdf_url
      `
    )
    .eq("member_id", memberId)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (paymentError) {
    console.error("Error loading payments:", paymentError.message);
    return [];
  }

  const typedPayments = (payments || []) as Payment[];

  const chargeIds = [
    ...new Set(
      typedPayments
        .map((payment) => payment.charge_id)
        .filter((value): value is string => Boolean(value))
    ),
  ];

  if (chargeIds.length === 0) {
    return typedPayments.map((payment) => ({
      ...payment,
      charge: null,
    }));
  }

  const { data: charges, error: chargeError } = await supabaseAdmin
    .from("member_charges")
    .select("id, charge_type, description, amount, status, due_date")
    .in("id", chargeIds);

  if (chargeError) {
    console.error("Error loading payment charges:", chargeError.message);

    return typedPayments.map((payment) => ({
      ...payment,
      charge: null,
    }));
  }

  const chargeMap = new Map(
    ((charges || []) as Charge[]).map((charge) => [charge.id, charge])
  );

  return typedPayments.map((payment) => ({
    ...payment,
    charge: payment.charge_id
      ? chargeMap.get(payment.charge_id) || null
      : null,
  }));
}

async function getOpenCharges(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select("id, charge_type, description, amount, status, due_date")
    .eq("member_id", memberId)
    .neq("status", "paid")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Error loading open charges:", error.message);
    return [];
  }

  return (data || []) as Charge[];
}

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

function displayMethod(payment: Payment) {
  if (payment.sola_recurring_id) {
    return "Sola Auto-Pay";
  }

  return payment.payment_method || payment.payment_provider || "—";
}

export default async function MemberPaymentsPage({ params }: PageProps) {
  const { id } = await params;

  const member = await getMember(id);

  if (!member) {
    notFound();
  }

  const payments = await getPayments(id);
  const openCharges = await getOpenCharges(id);

  const paidTotal = payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const openTotal = openCharges.reduce(
    (sum, charge) => sum + Number(charge.amount || 0),
    0
  );

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/admin/members/${member.id}?tab=payments`}
            className="text-sm font-semibold text-[#8b6b2e]"
          >
            ← Back to Member Payments
          </Link>

          <Link href="/admin" className="text-sm font-semibold text-[#8b6b2e]">
            Admin Home
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-8 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Payment History
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            {member.first_name} {member.last_name}
          </h1>

          {member.hebrew_name && (
            <p dir="rtl" className="mt-3 text-right text-2xl font-bold">
              {member.hebrew_name}
            </p>
          )}

          <div
            className="mt-5 grid gap-4 text-sm text-slate-200"
            style={{
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            }}
          >
            <div>
              <p className="text-slate-400">Email</p>
              <p className="font-bold">{member.email || "—"}</p>
            </div>

            <div>
              <p className="text-slate-400">Payments</p>
              <p className="font-bold">{payments.length}</p>
            </div>

            <div>
              <p className="text-slate-400">Paid Total</p>
              <p className="font-bold text-green-300">
                {formatMoney(paidTotal)}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Open Balance</p>
              <p className="font-bold text-[#f0d99a]">
                {formatMoney(openTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">All Recorded Payments</h2>
              <p className="mt-1 text-sm text-slate-500">
                Includes Sola online payments, automatic recurring payments,
                checks, cash, Zelle and other manual payments.
              </p>
            </div>

            <Link
              href={`/admin/members/${member.id}?tab=payments`}
              className="rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
            >
              Add or Record Payment
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1100px] border-separate border-spacing-y-3 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4">Paid Date</th>
                  <th className="px-4">Charge</th>
                  <th className="px-4">Description</th>
                  <th className="px-4 text-right">Amount</th>
                  <th className="px-4">Method</th>
                  <th className="px-4">Reference</th>
                  <th className="px-4">Receipt</th>
                  <th className="px-4">Note</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="bg-[#fbf8f2]">
                    <td className="rounded-l-2xl px-4 py-4 font-semibold">
                      {formatDate(payment.paid_at || payment.created_at)}
                    </td>

                    <td className="px-4 py-4 font-bold">
                      {payment.charge?.charge_type ||
                        (payment.sola_recurring_id
                          ? "Membership Dues"
                          : "Payment")}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {payment.charge?.description || "—"}
                    </td>

                    <td className="px-4 py-4 text-right font-black">
                      {formatMoney(payment.amount)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={
                          payment.payment_provider === "sola"
                            ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800"
                            : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                        }
                      >
                        {displayMethod(payment)}
                      </span>
                    </td>

                    <td className="px-4 py-4 font-mono text-xs text-slate-600">
                      {payment.external_payment_id || "—"}
                    </td>

                    <td className="px-4 py-4">
                     {payment.receipt_pdf_url ? (
  <a
    href={`/api/receipts/${payment.id}`}
    target="_blank"
    rel="noreferrer"
    className="font-bold text-[#8b6b2e] underline"
  >
    View PDF
  </a>
) : (
                        <span className="text-slate-400">
                          {payment.receipt_number || "Pending"}
                        </span>
                      )}
                    </td>

                    <td className="rounded-r-2xl px-4 py-4 text-slate-600">
                      {payment.note || "—"}
                    </td>
                  </tr>
                ))}

                {payments.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="rounded-2xl bg-[#fbf8f2] px-4 py-10 text-center text-slate-500"
                    >
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Open / Unpaid Charges</h2>
              <p className="mt-1 text-sm text-slate-500">
                Charges still awaiting payment.
              </p>
            </div>

            <Link
              href={`/admin/members/${member.id}?tab=payments`}
              className="rounded-full bg-[#8b6b2e] px-5 py-3 text-sm font-bold text-white"
            >
              Manage Charges
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-3 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4">Due Date</th>
                  <th className="px-4">Charge Type</th>
                  <th className="px-4">Description</th>
                  <th className="px-4 text-right">Amount</th>
                  <th className="px-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {openCharges.map((charge) => (
                  <tr key={charge.id} className="bg-[#fbf8f2]">
                    <td className="rounded-l-2xl px-4 py-4 font-semibold">
                      {formatDate(charge.due_date)}
                    </td>

                    <td className="px-4 py-4 font-bold">
                      {charge.charge_type}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {charge.description || "—"}
                    </td>

                    <td className="px-4 py-4 text-right font-black">
                      {formatMoney(charge.amount)}
                    </td>

                    <td className="rounded-r-2xl px-4 py-4 font-bold text-red-700">
                      {charge.status || "unpaid"}
                    </td>
                  </tr>
                ))}

                {openCharges.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="rounded-2xl bg-[#fbf8f2] px-4 py-10 text-center text-slate-500"
                    >
                      No unpaid charges.
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