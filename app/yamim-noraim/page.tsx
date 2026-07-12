import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { submitYamimNoraimReservation } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
    reserved?: string;
  }>;
};

type Settings = {
  enabled: boolean;
  active_year: number;
  men_seat_price: number;
  women_seat_price: number;
  headline: string | null;
  message: string | null;
};

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

async function getSettings() {
  const { data, error } = await supabaseAdmin
    .from("yamim_noraim_settings")
    .select(
      "enabled, active_year, men_seat_price, women_seat_price, headline, message"
    )
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    console.error("YAMIM_NORAIM_SETTINGS_ERROR", error.message);
    return null;
  }

  return data as Settings | null;
}

export default async function YamimNoraimPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const settings = await getSettings();
  const enabled = Boolean(settings?.enabled);
  const menPrice = Number(settings?.men_seat_price || 0);
  const womenPrice = Number(settings?.women_seat_price || 0);

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold text-[#8b6b2e] hover:underline"
        >
          ← Back Home
        </Link>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
              {settings?.active_year || new Date().getFullYear()}
            </p>

            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              {settings?.headline || "Yamim Noraim Seat Reservations"}
            </h1>

            <p className="mt-4 text-base leading-7 text-slate-200">
              {settings?.message ||
                "Reserve men’s and women’s seats for the Yamim Noraim. After submitting, you can pay the total securely by card, Apple Pay, Google Pay, or Zelle."}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">Men</p>
                <p className="mt-1 text-2xl font-black">
                  {formatMoney(menPrice)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">Women</p>
                <p className="mt-1 text-2xl font-black">
                  {formatMoney(womenPrice)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
            {!settings ? (
              <div className="rounded-2xl bg-amber-50 p-5 text-sm font-semibold text-amber-900">
                Seat reservations are not set up yet. Please ask an admin to run
                the Yamim Noraim Supabase setup SQL.
              </div>
            ) : !enabled ? (
              <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center">
                <h2 className="text-2xl font-black">
                  Reservations are closed
                </h2>
                <p className="mt-3 text-slate-600">
                  The seat reservation form is currently hidden for the year.
                </p>
              </div>
            ) : (
              <form action={submitYamimNoraimReservation} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black">Reserve Seats</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Submit once per family. The payment page will open with the
                    total filled in.
                  </p>
                </div>

                {params?.error ? (
                  <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
                    {params.error}
                  </p>
                ) : null}

                {params?.reserved ? (
                  <p className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">
                    Reservation saved.
                  </p>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Full Name
                    <input
                      name="full_name"
                      required
                      className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Member Name
                    <input
                      name="member_name"
                      className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
                      placeholder="If different"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Email
                    <input
                      name="email"
                      type="email"
                      className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Phone
                    <input
                      name="phone"
                      type="tel"
                      className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
                    />
                  </label>
                </div>

                <div className="grid gap-4 rounded-2xl bg-[#fbf8f2] p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <h3 className="text-lg font-black">Rosh Hashana</h3>
                  </div>

                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Men’s Seats
                    <input
                      name="rosh_hashana_men_seats"
                      type="number"
                      min="0"
                      defaultValue="0"
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Women’s Seats
                    <input
                      name="rosh_hashana_women_seats"
                      type="number"
                      min="0"
                      defaultValue="0"
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
                    />
                  </label>
                </div>

                <div className="grid gap-4 rounded-2xl bg-[#fbf8f2] p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <h3 className="text-lg font-black">Yom Kippur</h3>
                  </div>

                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Men’s Seats
                    <input
                      name="yom_kippur_men_seats"
                      type="number"
                      min="0"
                      defaultValue="0"
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-bold text-slate-700">
                    Women’s Seats
                    <input
                      name="yom_kippur_women_seats"
                      type="number"
                      min="0"
                      defaultValue="0"
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
                    />
                  </label>
                </div>

                <label className="block space-y-2 text-sm font-bold text-slate-700">
                  Notes
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Special seating notes, family details, or anything the shul should know"
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-full bg-[#1d2940] px-6 py-4 text-base font-black text-white"
                >
                  Continue to Payment
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
