import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ id?: string }>;
};

type Reservation = {
  id: string;
  reservation_year: number;
  full_name: string;
  email: string | null;
  total_amount: number;
  pricing_label: string | null;
  rosh_hashana_men_seats: number;
  rosh_hashana_women_seats: number;
  yom_kippur_men_seats: number;
  yom_kippur_women_seats: number;
  payment_status: string;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default async function YamimNoraimConfirmationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const id = params?.id || "";
  const { data: reservation } = id
    ? await supabaseAdmin
        .from("yamim_noraim_reservations")
        .select("id, reservation_year, full_name, email, total_amount, pricing_label, rosh_hashana_men_seats, rosh_hashana_women_seats, yom_kippur_men_seats, yom_kippur_women_seats, payment_status")
        .eq("id", id)
        .maybeSingle()
    : { data: null };

  const row = reservation as Reservation | null;
  const note = row
    ? [`Yamim Noraim ${row.reservation_year} seats`, row.pricing_label, `RH ${row.rosh_hashana_men_seats} men/${row.rosh_hashana_women_seats} women`, `YK ${row.yom_kippur_men_seats} men/${row.yom_kippur_women_seats} women`, `Reservation ${row.id}`].filter(Boolean).join(" - ")
    : "";
  const paymentUrl = row
    ? `/donate?amount=${encodeURIComponent(Number(row.total_amount).toFixed(2))}&purpose=${encodeURIComponent("Yamim Noraim Seats")}&note=${encodeURIComponent(note)}&name=${encodeURIComponent(row.full_name)}&email=${encodeURIComponent(row.email || "")}`
    : "/yamim-noraim";

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900 sm:px-6">
      <section className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-semibold text-[#8b6b2e]">← Back Home</Link>
        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-7 shadow-sm sm:p-10">
          {!row ? (
            <><h1 className="text-3xl font-black">Reservation not found</h1><p className="mt-3 text-slate-600">Please submit the Yamim Noraim reservation form again.</p><Link href="/yamim-noraim" className="mt-6 inline-block rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white">Back to reservations</Link></>
          ) : (
            <>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#8b6b2e]">Yamim Noraim {row.reservation_year}</p>
              <h1 className="mt-3 text-3xl font-black">Reservation submitted</h1>
              <p className="mt-4 text-lg leading-7 text-slate-700">Thank you, {row.full_name}. Your reservation has been received. A confirmation was sent to {row.email || "your email address"}.</p>
              <div className="mt-6 rounded-2xl bg-[#fbf8f2] p-5 text-sm leading-7">
                <p><strong>Reservation ID:</strong> {row.id}</p>
                <p><strong>Seats:</strong> {row.pricing_label}</p>
                <p><strong>Total due:</strong> {formatMoney(Number(row.total_amount))}</p>
                <p><strong>Status:</strong> {row.payment_status === "paid" ? "Paid" : "Payment pending"}</p>
              </div>
              {row.payment_status === "paid" ? (
                <p className="mt-6 rounded-2xl bg-green-50 p-4 font-bold text-green-800">Payment received. Thank you!</p>
              ) : Number(row.total_amount) > 0 ? <>
                <p className="mt-6 font-bold">Choose how you would like to pay:</p>
                <Link href={paymentUrl} className="mt-3 block rounded-full bg-[#1d2940] px-6 py-4 text-center font-black text-white hover:bg-[#10192b]">Continue to Payment</Link>
                <div className="mt-5 rounded-2xl border border-[#d9bf7a] bg-[#fffaf0] p-5">
                  <h2 className="font-black">Pay with Zelle</h2>
                  <p className="mt-2 text-sm leading-6">Send {formatMoney(Number(row.total_amount))} to <strong>khalbneialiyah@gmail.com</strong>. Include your name and reservation ID in the memo. Your reservation is already received, so you do not need to submit the form again.</p>
                </div>
              </> : <p className="mt-6 rounded-2xl bg-green-50 p-4 font-bold text-green-800">No payment is due for this reservation.</p>}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
