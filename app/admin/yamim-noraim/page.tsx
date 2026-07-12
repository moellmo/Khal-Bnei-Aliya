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
    error?: string;
    settingsSaved?: string;
    reservationUpdated?: string;
    cleared?: string;
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

type Reservation = {
  id: string;
  reservation_year: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  member_name: string | null;
  men_seats: number;
  women_seats: number;
  total_amount: number;
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
      "enabled, active_year, men_seat_price, women_seat_price, headline, message"
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
      "id, reservation_year, full_name, email, phone, member_name, men_seats, women_seats, total_amount, notes, payment_status, payment_reference, created_at"
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
                <span className="font-semibold">Men Seat Price</span>
                <input
                  name="men_seat_price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={settings?.men_seat_price || 100}
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Women Seat Price</span>
                <input
                  name="women_seat_price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={settings?.women_seat_price || 100}
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>
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

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Responses</h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Seats</th>
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
                    <td className="px-3 py-3">
                      <p>Men: {reservation.men_seats}</p>
                      <p>Women: {reservation.women_seats}</p>
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
      </section>
    </main>
  );
}
