import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  type YamimNoraimPricingSettings,
} from "@/lib/yamimNoraim/pricing";
import { submitYamimNoraimReservation } from "./actions";
import YamimNoraimReservationForm from "./YamimNoraimReservationForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
    reserved?: string;
  }>;
};

type Settings = YamimNoraimPricingSettings & {
  enabled: boolean;
  active_year: number;
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
      "enabled, active_year, member_rosh_hashana_price, member_yom_kippur_price, member_both_price, nonmember_rosh_hashana_base_price, nonmember_yom_kippur_base_price, nonmember_both_base_price, nonmember_additional_seat_price, headline, message"
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

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm font-bold text-[#f0d99a]">Members</p>
                <p className="mt-1 text-sm text-slate-200">
                  Rosh Hashana {formatMoney(settings?.member_rosh_hashana_price)}
                  {" · "}Yom Kippur {formatMoney(settings?.member_yom_kippur_price)}
                  {" · "}Both {formatMoney(settings?.member_both_price)} per family
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm font-bold text-[#f0d99a]">Non-members</p>
                <p className="mt-1 text-sm text-slate-200">
                  Base includes up to two seats per holiday. Additional seats are{" "}
                  {formatMoney(settings?.nonmember_additional_seat_price)} each.
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
                <h2 className="text-2xl font-black">Reservations are closed</h2>
                <p className="mt-3 text-slate-600">
                  The seat reservation form is currently hidden for the year.
                </p>
              </div>
            ) : (
              <YamimNoraimReservationForm
                action={submitYamimNoraimReservation}
                settings={settings}
                error={params?.error}
                reserved={params?.reserved}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
