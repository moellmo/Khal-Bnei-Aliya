import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import GenerateReceiptButton from "../dashboard/GenerateReceiptButton";

export const dynamic = "force-dynamic";

type Payment = {
  id: string;
  amount: number;
  payment_method: string | null;
  payment_provider: string | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
  receipt_number: string | null;
  receipt_pdf_url: string | null;
};

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

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

function getPaymentMethod(payment: Payment) {
  if (
    payment.payment_provider?.toLowerCase() === "sola" ||
    payment.payment_method?.toLowerCase() === "card"
  ) {
    return "Card";
  }

  return payment.payment_method || "Payment";
}

export default async function MemberPaymentsPage() {
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
    .select("id, first_name, last_name, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (memberError || !member || member.portal_status === "disabled") {
    redirect("/login");
  }

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select(
      "id, amount, payment_method, payment_provider, status, paid_at, created_at, receipt_number, receipt_pdf_url"
    )
    .eq("member_id", member.id)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load member payments:", error.message);
  }

  const payments = (data || []) as Payment[];

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <Link
          href="/member/dashboard"
          className="text-sm font-semibold text-[#8b6b2e] hover:underline"
        >
          ← Member Dashboard
        </Link>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Member Portal
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Payment History
          </h1>
          <p className="mt-3 text-slate-200">
            {member.first_name} {member.last_name}
          </p>
        </div>

        <div className="mt-8 overflow-x-auto rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          {payments.length > 0 ? (
            <table className="w-full min-w-[720px] text-left">
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
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="px-3 py-4">
                      {formatDate(payment.paid_at || payment.created_at)}
                    </td>
                    <td className="px-3 py-4 font-bold">
                      {formatMoney(payment.amount)}
                    </td>
                    <td className="px-3 py-4">{getPaymentMethod(payment)}</td>
                    <td className="px-3 py-4">
                      {payment.receipt_number || "-"}
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
    </main>
  );
}
