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

type Charge = {
  id: string;
  charge_type: string;
  description: string | null;
  amount: number;
  status: string | null;
  due_date: string | null;
  payment_method: string | null;
  payment_provider: string | null;
  paid_amount: number | null;
  payment_note: string | null;
  paid_at: string | null;
  created_at: string | null;
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

async function getCharges(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, charge_type, description, amount, status, due_date, payment_method, payment_provider, paid_amount, payment_note, paid_at, created_at"
    )
    .eq("member_id", memberId)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading payment history:", error.message);
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

export default async function MemberPaymentsPage({ params }: PageProps) {
  const { id } = await params;

  const member = await getMember(id);

  if (!member) {
    notFound();
  }

  const charges = await getCharges(id);

  const paidCharges = charges.filter((charge) => charge.status === "paid");
  const unpaidCharges = charges.filter((charge) => charge.status !== "paid");

  const paidTotal = paidCharges.reduce(
    (sum, charge) => sum + Number(charge.paid_amount || charge.amount || 0),
    0
  );

  const unpaidTotal = unpaidCharges.reduce(
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
            className="mt-5 grid gap-3 text-sm text-slate-200"
            style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
          >
            <div>
              <p className="text-slate-400">Email</p>
              <p className="font-bold">{member.email || "—"}</p>
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
                {formatMoney(unpaidTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">All Recorded Payments</h2>
              <p className="mt-1 text-sm text-slate-500">
                Full payment history for this member.
              </p>
            </div>

            <Link
              href={`/admin/members/${member.id}?tab=payments`}
              className="rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
            >
              Add / Record Payment
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-y-3 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Paid Date</th>
                  <th className="px-4">Charge Type</th>
                  <th className="px-4">Description</th>
                  <th className="px-4 text-right">Amount Paid</th>
                  <th className="px-4">Method</th>
                  <th className="px-4">Provider</th>
                  <th className="px-4">Note</th>
                </tr>
              </thead>

              <tbody>
                {paidCharges.map((charge) => (
                  <tr key={charge.id} className="bg-[#fbf8f2]">
                    <td className="rounded-l-2xl px-4 py-4 font-semibold">
                      {formatDate(charge.paid_at)}
                    </td>

                    <td className="px-4 py-4 font-bold">
                      {charge.charge_type}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {charge.description || "—"}
                    </td>

                    <td className="px-4 py-4 text-right font-black">
                      {formatMoney(charge.paid_amount || charge.amount)}
                    </td>

                    <td className="px-4 py-4">
                      {charge.payment_method || "—"}
                    </td>

                    <td className="px-4 py-4">
                      {charge.payment_provider || "—"}
                    </td>

                    <td className="rounded-r-2xl px-4 py-4 text-slate-600">
                      {charge.payment_note || "—"}
                    </td>
                  </tr>
                ))}

                {paidCharges.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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
          <h2 className="text-2xl font-bold">Open / Unpaid Charges</h2>
          <p className="mt-1 text-sm text-slate-500">
            These are still unpaid and can be recorded from the member payment
            tab.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-3 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4">Due Date</th>
                  <th className="px-4">Charge Type</th>
                  <th className="px-4">Description</th>
                  <th className="px-4 text-right">Amount</th>
                  <th className="px-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {unpaidCharges.map((charge) => (
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

                {unpaidCharges.length === 0 && (
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