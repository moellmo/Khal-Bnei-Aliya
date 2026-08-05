import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  clearReservationsForYear,
  markReservationPaid,
  updateYamimNoraimSettings,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    year?: string;
    tab?: string;
    error?: string;
    settingsSaved?: string;
    reservationUpdated?: string;
    cleared?: string;
  }>;
};

type Settings = {
  enabled: boolean;
  active_year: number;
  member_rosh_hashana_price: number;
  member_yom_kippur_price: number;
  member_both_price: number;
  nonmember_rosh_hashana_base_price: number;
  nonmember_yom_kippur_base_price: number;
  nonmember_both_base_price: number;
  nonmember_additional_seat_price: number;
  headline: string | null;
  message: string | null;
};

type Reservation = {
  id: string;
  reservation_year: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  member_name: string | null;
  men_seats: number;
  women_seats: number;
  rosh_hashana_men_seats: number;
  rosh_hashana_women_seats: number;
  yom_kippur_men_seats: number;
  yom_kippur_women_seats: number;
  total_amount: number;
  membership_type: "member" | "non_member" | null;
  pricing_option: string | null;
  pricing_base_amount: number | null;
  pricing_additional_amount: number | null;
  pricing_label: string | null;
  notes: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  created_at: string;
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
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
    return { settings: null, error: error.message };
  }

  return { settings: data as Settings | null, error: null };
}

async function getReservations(year: number) {
  const { data, error } = await supabaseAdmin
    .from("yamim_noraim_reservations")
    .select(
      "id, reservation_year, full_name, email, phone, member_name, membership_type, pricing_option, pricing_base_amount, pricing_additional_amount, pricing_label, men_seats, women_seats, rosh_hashana_men_seats, rosh_hashana_women_seats, yom_kippur_men_seats, yom_kippur_women_seats, total_amount, notes, payment_status, payment_reference, created_at"
    )
    .eq("reservation_year", year)
    .order("created_at", { ascending: false });

  if (error) {
    return { reservations: [] as Reservation[], error: error.message };
  }

  return {
    reservations: (data || []) as Reservation[],
    error: null,
  };
}

export default async function AdminYamimNoraimPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const activeTab = params?.tab || "controls";
  const { settings, error: settingsError } = await getSettings();
  const selectedYear = Number(params?.year || settings?.active_year || new Date().getFullYear());
  const year = Number.isFinite(selectedYear) ? selectedYear : new Date().getFullYear();
  const { reservations, error: reservationsError } = await getReservations(year);

  const menTotal = reservations.reduce(
    (sum, reservation) => sum + Number(reservation.men_seats || 0),
    0
  );
  const womenTotal = reservations.reduce(
    (sum, reservation) => sum + Number(reservation.women_seats || 0),
    0
  );
  const amountTotal = reservations.reduce(
    (sum, reservation) => sum + Number(reservation.total_amount || 0),
    0
  );
  const paidTotal = reservations
    .filter((reservation) => reservation.payment_status === "paid")
    .reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);
  const roshHashanaMenTotal = reservations.reduce(
    (sum, reservation) =>
      sum + Number(reservation.rosh_hashana_men_seats || 0),
    0
  );
  const roshHashanaWomenTotal = reservations.reduce(
    (sum, reservation) =>
      sum + Number(reservation.rosh_hashana_women_seats || 0),
    0
  );
  const yomKippurMenTotal = reservations.reduce(
    (sum, reservation) =>
      sum + Number(reservation.yom_kippur_men_seats || 0),
    0
  );
  const yomKippurWomenTotal = reservations.reduce(
    (sum, reservation) =>
      sum + Number(reservation.yom_kippur_women_seats || 0),
    0
  );
  const memberReservationCount = reservations.filter(
    (reservation) => reservation.membership_type !== "non_member"
  ).length;
  const nonMemberReservationCount = reservations.filter(
    (reservation) => reservation.membership_type === "non_member"
  ).length;
  const paidReservationCount = reservations.filter(
    (reservation) => reservation.payment_status === "paid"
  ).length;
  const pendingReservationCount = reservations.filter(
    (reservation) => reservation.payment_status !== "paid"
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin" className="text-sm font-semibold text-[#8b6b2e]">
            ← Admin Home
          </Link>

          <Link
            href="/yamim-noraim"
            className="text-sm font-semibold text-[#8b6b2e]"
          >
            Open Public Form
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Yamim Noraim
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Seat Reservations
          </h1>
          <p className="mt-3 max-w-2xl text-slate-200">
            Open or hide the home-page button, set prices, and review men’s and
            women’s seat counts for each year.
          </p>
        </div>

        {(settingsError || reservationsError || params?.error) && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
            {params?.error ||
              settingsError ||
              reservationsError ||
              "Unable to load reservations."}
          </div>
        )}

        {(params?.settingsSaved || params?.reservationUpdated || params?.cleared) && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Saved.
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/admin/yamim-noraim?year=${year}&tab=controls`}
            className={
              activeTab === "controls"
                ? "rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white shadow-sm"
                : "rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-[#fbf8f2]"
            }
          >
            Controls
          </Link>

          <Link
            href={`/admin/yamim-noraim?year=${year}&tab=results`}
            className={
              activeTab === "results"
                ? "rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white shadow-sm"
                : "rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-[#fbf8f2]"
            }
          >
            Results
          </Link>
        </div>

        {activeTab === "controls" && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            action={updateYamimNoraimSettings}
            className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-bold">Settings</h2>

            <label className="mt-5 flex items-start gap-3 rounded-2xl bg-[#fbf8f2] p-4 font-semibold">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={Boolean(settings?.enabled)}
                className="mt-1"
              />
              Show Yamim Noraim reservation button and public form
            </label>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="font-semibold">Year</span>
                <input
                  name="active_year"
                  type="number"
                  min="2026"
                  defaultValue={settings?.active_year || year}
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Member RH / family</span>
                <input
                  name="member_rosh_hashana_price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={settings?.member_rosh_hashana_price || 75}
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Member YK / family</span>
                <input
                  name="member_yom_kippur_price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={settings?.member_yom_kippur_price || 50}
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Member both / family</span>
                <input
                  name="member_both_price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={settings?.member_both_price || 100}
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl bg-[#fbf8f2] p-4">
              <h3 className="font-black">Non-member pricing</h3>
              <p className="mt-1 text-xs text-slate-500">
                Base price covers up to two seats for the selected holiday or package.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="font-semibold">Non-member RH base</span>
                  <input
                    name="nonmember_rosh_hashana_base_price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={settings?.nonmember_rosh_hashana_base_price || 100}
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                  />
                </label>

                <label className="space-y-2">
                  <span className="font-semibold">Non-member YK base</span>
                  <input
                    name="nonmember_yom_kippur_base_price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={settings?.nonmember_yom_kippur_base_price || 100}
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                  />
                </label>

                <label className="space-y-2">
                  <span className="font-semibold">Non-member both base</span>
                  <input
                    name="nonmember_both_base_price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={settings?.nonmember_both_base_price || 175}
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                  />
                </label>

                <label className="space-y-2">
                  <span className="font-semibold">Additional seat</span>
                  <input
                    name="nonmember_additional_seat_price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={settings?.nonmember_additional_seat_price || 50}
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                  />
                </label>
              </div>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="font-semibold">Headline</span>
              <input
                name="headline"
                defaultValue={settings?.headline || "Yamim Noraim Seat Reservations"}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <label className="mt-4 block space-y-2">
              <span className="font-semibold">Message</span>
              <textarea
                name="message"
                rows={4}
                defaultValue={settings?.message || ""}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <button
              type="submit"
              className="mt-5 rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
            >
              Save Settings
            </button>
          </form>

          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{year} Tally</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {reservations.length} reservation responses
                </p>
              </div>

              <form method="GET" className="flex gap-2">
                <input
                  name="year"
                  type="number"
                  min="2026"
                  defaultValue={year}
                  className="w-28 rounded-xl border border-[#d8cdb7] px-3 py-2"
                />
                <button className="rounded-full bg-[#1d2940] px-4 py-2 text-sm font-bold text-white">
                  View
                </button>
              </form>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-[#fbf8f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Men
                </p>
                <p className="mt-1 text-2xl font-black">{menTotal}</p>
              </div>

              <div className="rounded-2xl bg-[#fbf8f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Women
                </p>
                <p className="mt-1 text-2xl font-black">{womenTotal}</p>
              </div>

              <div className="rounded-2xl bg-[#fbf8f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Owed
                </p>
                <p className="mt-1 text-2xl font-black">
                  {formatMoney(amountTotal)}
                </p>
              </div>

              <div className="rounded-2xl bg-[#fbf8f2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Paid
                </p>
                <p className="mt-1 text-2xl font-black text-green-700">
                  {formatMoney(paidTotal)}
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[#e3d9c7] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Members
                </p>
                <p className="mt-1 text-2xl font-black">{memberReservationCount}</p>
              </div>
              <div className="rounded-2xl border border-[#e3d9c7] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Non-members
                </p>
                <p className="mt-1 text-2xl font-black">{nonMemberReservationCount}</p>
              </div>
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-green-700">
                  Paid reservations
                </p>
                <p className="mt-1 text-2xl font-black text-green-800">{paidReservationCount}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
                  Pending reservations
                </p>
                <p className="mt-1 text-2xl font-black text-amber-800">{pendingReservationCount}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e3d9c7] p-4">
                <p className="text-sm font-bold text-slate-500">
                  Rosh Hashana
                </p>
                <p className="mt-2 text-lg font-black">
                  Men {roshHashanaMenTotal} · Women {roshHashanaWomenTotal}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e3d9c7] p-4">
                <p className="text-sm font-bold text-slate-500">
                  Yom Kippur
                </p>
                <p className="mt-2 text-lg font-black">
                  Men {yomKippurMenTotal} · Women {yomKippurWomenTotal}
                </p>
              </div>
            </div>

            <form
              action={clearReservationsForYear}
              className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4"
            >
              <input type="hidden" name="year" value={year} />
              <p className="text-sm font-bold text-red-900">
                Clear all {year} responses
              </p>
              <p className="mt-1 text-xs text-red-800">
                Type CLEAR {year} before clearing.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  name="confirmation"
                  className="rounded-xl border border-red-200 px-3 py-2 text-sm"
                  placeholder={`CLEAR ${year}`}
                />
                <button className="rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white">
                  Clear Year
                </button>
              </div>
            </form>
          </div>
        </div>
        )}

        {activeTab === "results" && (
        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Results</h2>
              <p className="mt-1 text-sm text-slate-500">
                Separate Rosh Hashana and Yom Kippur totals for {year}.
              </p>
            </div>

            <form method="GET" className="flex gap-2">
              <input type="hidden" name="tab" value="results" />
              <input
                name="year"
                type="number"
                min="2026"
                defaultValue={year}
                className="w-28 rounded-xl border border-[#d8cdb7] px-3 py-2"
              />
              <button className="rounded-full bg-[#1d2940] px-4 py-2 text-sm font-bold text-white">
                View
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-[#fbf8f2] p-5">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#8b6b2e]">
                Rosh Hashana
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-slate-500">Men</p>
                  <p className="text-3xl font-black">{roshHashanaMenTotal}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Women</p>
                  <p className="text-3xl font-black">{roshHashanaWomenTotal}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#fbf8f2] p-5">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#8b6b2e]">
                Yom Kippur
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-slate-500">Men</p>
                  <p className="text-3xl font-black">{yomKippurMenTotal}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Women</p>
                  <p className="text-3xl font-black">{yomKippurWomenTotal}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1040px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Pricing</th>
                  <th className="px-3 py-2">Rosh Hashana</th>
                  <th className="px-3 py-2">Yom Kippur</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="bg-[#fbf8f2] align-top">
                    <td className="rounded-l-2xl px-3 py-3 font-bold">
                      {reservation.full_name}
                      {reservation.member_name ? (
                        <p className="text-xs font-semibold text-slate-500">
                          Member: {reservation.member_name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <p>{reservation.email || "—"}</p>
                      <p>{reservation.phone || "—"}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <p className="font-bold">
                        {reservation.membership_type === "non_member"
                          ? "Non-member"
                          : "Member"}
                      </p>
                      <p className="text-xs">
                        {reservation.pricing_label || reservation.pricing_option || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p>Men: {reservation.rosh_hashana_men_seats}</p>
                      <p>Women: {reservation.rosh_hashana_women_seats}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>Men: {reservation.yom_kippur_men_seats}</p>
                      <p>Women: {reservation.yom_kippur_women_seats}</p>
                    </td>
                    <td className="px-3 py-3 font-bold">
                      {formatMoney(reservation.total_amount)}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold capitalize">
                        {reservation.payment_status || "pending"}
                      </p>
                      {reservation.payment_reference ? (
                        <p className="text-xs text-slate-500">
                          {reservation.payment_reference}
                        </p>
                      ) : null}
                      {reservation.payment_status !== "paid" ? (
                        <form
                          action={markReservationPaid.bind(
                            null,
                            reservation.id,
                            year
                          )}
                          className="mt-2 flex gap-2"
                        >
                          <input
                            name="payment_reference"
                            className="w-32 rounded-lg border border-[#d8cdb7] px-2 py-1 text-xs"
                            placeholder="Ref/check"
                          />
                          <button className="rounded-full bg-green-700 px-3 py-1 text-xs font-bold text-white">
                            Paid
                          </button>
                        </form>
                      ) : null}
                    </td>
                    <td className="max-w-xs px-3 py-3 text-slate-600">
                      {reservation.notes || "—"}
                    </td>
                    <td className="rounded-r-2xl px-3 py-3 text-slate-600">
                      {formatDate(reservation.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reservations.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
              No reservations for {year} yet.
            </div>
          ) : null}
        </div>
        )}
      </section>
    </main>
  );
}
