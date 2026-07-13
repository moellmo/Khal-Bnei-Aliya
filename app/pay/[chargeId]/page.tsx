import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { submitPublicZellePaymentClaim } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    chargeId: string;
  }>;
  searchParams?: Promise<{
    zelleSubmitted?: string;
    zelleError?: string;
  }>;
};

type Charge = {
  id: string;
  amount: number | null;
  charge_type: string | null;
  description: string | null;
  status: string | null;
  due_date: string | null;
  members:
    | {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }
    | {
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
  if (!value) return "No due date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function isOpenAmountCharge(charge: Charge) {
  return (
    Number(charge.amount || 0) <= 0 ||
    String(charge.charge_type || "").toLowerCase() === "matana" ||
    String(charge.description || "").toLowerCase().includes("matana")
  );
}

function memberName(charge: Charge) {
  const member = Array.isArray(charge.members)
    ? charge.members[0]
    : charge.members;

  return [member?.first_name, member?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function getCharge(chargeId: string) {
  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, amount, charge_type, description, status, due_date, members(first_name, last_name, email)"
    )
    .eq("id", chargeId)
    .maybeSingle();

  if (error) {
    console.error("PUBLIC_PAYMENT_CHARGE_LOAD_ERROR", error.message);
    return null;
  }

  return data as Charge | null;
}

export default async function PublicPaymentPage({
  params,
  searchParams,
}: PageProps) {
  const { chargeId } = await params;
  const query = await searchParams;
  const charge = await getCharge(chargeId);

  if (!charge) {
    notFound();
  }

  const isOpenAmount = isOpenAmountCharge(charge);
  const name = memberName(charge) || "Guest";
  const isPaid = charge.status === "paid";

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-[#8b6b2e]">
          ← Back Home
        </Link>

        <div className="mt-8 overflow-hidden rounded-[2rem] bg-white shadow-sm">
          <div className="bg-[#1d2940] p-7 text-white sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
              Khal Bnei Aliya
            </p>
            <h1 className="mt-3 text-3xl font-bold">Payment Request</h1>
            <p className="mt-3 text-slate-200">
              {charge.description || charge.charge_type || "Open charge"}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {query?.zelleSubmitted === "1" ? (
              <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
                Your Zelle payment was submitted for review. It will show as
                paid after accounting matches it.
              </div>
            ) : null}

            {query?.zelleError ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
                {query.zelleError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#fbf8f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Name
                </p>
                <p className="mt-2 font-bold">{name}</p>
              </div>

              <div className="rounded-2xl bg-[#fbf8f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Amount
                </p>
                <p className="mt-2 font-bold">
                  {isOpenAmount
                    ? "Matana - choose amount"
                    : formatMoney(charge.amount)}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fbf8f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Due
                </p>
                <p className="mt-2 font-bold">{formatDate(charge.due_date)}</p>
              </div>
            </div>

            {isPaid ? (
              <div className="mt-6 rounded-2xl bg-green-50 p-6 text-center">
                <p className="text-lg font-bold text-green-800">
                  This payment request is already paid.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5">
                <h2 className="text-xl font-bold">Pay by Zelle</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Send Zelle to{" "}
                  <span className="font-bold text-slate-900">
                    khalbneialiyah@gmail.com
                  </span>
                  , then submit this confirmation for accounting review.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Memo:{" "}
                  <span className="font-bold text-slate-900">
                    KBA-{charge.id.slice(0, 8)}{" "}
                    {isOpenAmount ? "Matana" : formatMoney(charge.amount)}
                  </span>
                </p>

                <form
                  action={submitPublicZellePaymentClaim}
                  className="mt-5 grid gap-4"
                >
                  <input type="hidden" name="charge_id" value={charge.id} />

                  <label className="space-y-2">
                    <span className="font-semibold">Amount Sent</span>
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      readOnly={!isOpenAmount}
                      defaultValue={
                        isOpenAmount
                          ? ""
                          : Number(charge.amount || 0).toFixed(2)
                      }
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="font-semibold">Your Name</span>
                      <input
                        name="payer_name"
                        defaultValue={name === "Guest" ? "" : name}
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="font-semibold">Email</span>
                      <input
                        name="payer_email"
                        type="email"
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                      />
                    </label>
                  </div>

                  <label className="space-y-2">
                    <span className="font-semibold">Optional Memo</span>
                    <input
                      name="note"
                      placeholder="Confirmation note or sender name"
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                    />
                  </label>

                  <button
                    type="submit"
                    className="rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
                  >
                    I Paid by Zelle
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
