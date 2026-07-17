import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatKiddushShabbosLabel } from "@/lib/kiddush/shabbos";
import KiddushReservationForm from "./KiddushReservationForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
    reserved?: string;
    method?: string;
  }>;
};

type Settings = {
  enabled: boolean;
  headline: string | null;
  message: string | null;
  zelle_email: string | null;
  weeks_to_show: number | null;
  base_fee_amount: number | null;
  minimum_total_amount: number | null;
};

type KiddushItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  default_quantity: number;
};

function uniqueItemsByName(items: KiddushItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getUpcomingShabbosDates(count = 14) {
  const dates: string[] = [];
  const date = new Date();
  date.setHours(12, 0, 0, 0);

  const daysUntilSaturday = (6 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysUntilSaturday);

  for (let index = 0; index < count; index += 1) {
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + index * 7);
    dates.push(nextDate.toISOString().slice(0, 10));
  }

  return dates;
}

async function getPageData() {
  const settingsResult = await supabaseAdmin
    .from("kiddush_settings")
    .select(
      "enabled, headline, message, zelle_email, weeks_to_show, base_fee_amount, minimum_total_amount"
    )
    .eq("id", "default")
    .maybeSingle();
  const settings = settingsResult.data as Settings | null;
  const weeksToShow = Math.min(
    104,
    Math.max(1, Number(settings?.weeks_to_show || 26))
  );
  const shabbosDates = getUpcomingShabbosDates(weeksToShow);

  const [itemsResult, reservationsResult] = await Promise.all([
    supabaseAdmin
      .from("kiddush_items")
      .select("id, name, description, price, default_quantity")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("kiddush_reservations")
      .select("shabbos_date")
      .in("shabbos_date", shabbosDates)
      .in("payment_status", ["pending", "paid", "zelle_review", "no_payment_due"]),
  ]);

  const reservedDates = new Set(
    (reservationsResult.data || []).map((row) => String(row.shabbos_date))
  );

  return {
    settings,
    settingsError: settingsResult.error?.message || null,
    items: uniqueItemsByName((itemsResult.data || []) as KiddushItem[]),
    itemsError: itemsResult.error?.message || null,
    shabbosOptions: shabbosDates.map((date) => ({
      date,
      label: formatKiddushShabbosLabel(date),
      reserved: reservedDates.has(date),
    })),
  };
}

export default async function KiddushPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { settings, settingsError, items, itemsError, shabbosOptions } =
    await getPageData();
  const isOpen = settings?.enabled !== false;
  const zelleEmail = settings?.zelle_email || "khalbneialiyah@gmail.com";

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            ← Back Home
          </Link>

          <Link
            href="/donate"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            Donate
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
          <aside className="rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8 lg:sticky lg:top-8">
            <img
              src="/kba-logo.png"
              alt="Khal Bnei Aliya"
              className="h-20 w-auto rounded-xl bg-white p-2"
            />

            <p className="mt-8 text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
              Khal Bnei Aliya
            </p>

            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              {settings?.headline || "Kiddush Reservations"}
            </h1>

            <p className="mt-4 text-base leading-7 text-slate-200">
              {settings?.message ||
                "Reserve an upcoming Shabbos Kiddush, choose standard items, add your sponsorship text, and complete payment by card or Zelle."}
            </p>

            <div className="mt-6 rounded-2xl bg-white/10 p-5">
              <p className="text-sm font-bold text-[#f0d99a]">
                Zelle
              </p>

              <p className="mt-2 text-xl font-black">
                {zelleEmail}
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-200">
                Include your name and Kiddush date in the memo.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/15 bg-white/[0.06] p-5">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#f0d99a]">
                What happens next
              </p>

              <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-200">
                <p>
                  Choose a Shabbos, set quantities, and submit payment.
                </p>
                <p>
                  Special requests are reviewed separately and billed if needed.
                </p>
              </div>
            </div>
          </aside>

          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
            {params?.reserved === "1" ? (
              <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
                Kiddush reservation received.
                {params.method === "zelle"
                  ? " Your Zelle payment was submitted for review."
                  : ""}
              </div>
            ) : null}

            {params?.error ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                {params.error}
              </div>
            ) : null}

            {settingsError || itemsError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                Kiddush reservations could not be loaded.
              </div>
            ) : !isOpen ? (
              <div className="rounded-2xl bg-[#fbf8f2] p-6 text-center font-bold text-slate-700">
                Kiddush reservations are not open right now.
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl bg-[#fbf8f2] p-6 text-center font-bold text-slate-700">
                Kiddush items have not been configured yet.
              </div>
            ) : (
              <KiddushReservationForm
                items={items}
                shabbosOptions={shabbosOptions}
                zelleEmail={zelleEmail}
                baseFeeAmount={Number(settings?.base_fee_amount || 49)}
                minimumTotalAmount={Number(settings?.minimum_total_amount || 215)}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
