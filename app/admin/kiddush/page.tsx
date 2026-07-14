import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addKiddushItem,
  markKiddushPaid,
  updateKiddushFinalTotal,
  updateKiddushItems,
  updateKiddushSettings,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    view?: string;
    error?: string;
    settingsSaved?: string;
    itemsSaved?: string;
    itemAdded?: string;
    reservationUpdated?: string;
    balanceBilled?: string;
  }>;
};

type Settings = {
  enabled: boolean;
  notification_email: string;
  zelle_email: string;
  weeks_to_show: number;
  base_fee_amount: number;
  minimum_total_amount: number;
  headline: string | null;
  message: string | null;
};

type KiddushItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  default_quantity: number;
  max_quantity: number | null;
  display_order: number;
  is_active: boolean;
};

type Reservation = {
  id: string;
  shabbos_date: string;
  sponsor_name: string;
  sponsor_email: string;
  sponsor_phone: string | null;
  sponsorship_text: string;
  items: unknown;
  special_requests: string | null;
  item_subtotal_amount: number;
  base_fee_amount: number;
  minimum_adjustment_amount: number;
  total_amount: number;
  final_total_amount: number | null;
  special_request_amount: number | null;
  additional_amount: number;
  payment_method: string | null;
  payment_status: string;
  payment_reference: string | null;
  charge_id: string | null;
  additional_charge_id: string | null;
  created_at: string;
  amount_paid: number;
};

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function itemSummary(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    return "No standard items";
  }

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return `${row.quantity || 0} x ${row.name || "Item"}`;
    })
    .filter(Boolean)
    .join(", ");
}

async function getPageData(showAll: boolean) {
  const today = new Date().toISOString().slice(0, 10);
  const [settingsResult, itemsResult, reservationsResult] = await Promise.all([
    supabaseAdmin
      .from("kiddush_settings")
      .select(
        "enabled, notification_email, zelle_email, weeks_to_show, base_fee_amount, minimum_total_amount, headline, message"
      )
      .eq("id", "default")
      .maybeSingle(),
    supabaseAdmin
      .from("kiddush_items")
      .select(
        "id, name, description, price, default_quantity, max_quantity, display_order, is_active"
      )
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("kiddush_reservations")
      .select(
        "id, shabbos_date, sponsor_name, sponsor_email, sponsor_phone, sponsorship_text, items, special_requests, item_subtotal_amount, base_fee_amount, minimum_adjustment_amount, total_amount, final_total_amount, special_request_amount, additional_amount, payment_method, payment_status, payment_reference, charge_id, additional_charge_id, created_at"
      )
      .gte("shabbos_date", showAll ? "1900-01-01" : today)
      .order("shabbos_date", { ascending: true })
      .limit(showAll ? 250 : 8),
  ]);

  const reservations = (reservationsResult.data || []) as Omit<
    Reservation,
    "amount_paid"
  >[];
  const chargeIds = reservations
    .flatMap((reservation) => [
      reservation.charge_id,
      reservation.additional_charge_id,
    ])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const paidByChargeId = new Map<string, number>();

  if (chargeIds.length > 0) {
    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("charge_id, amount")
      .in("charge_id", chargeIds)
      .eq("status", "paid");

    for (const payment of payments || []) {
      const chargeId = String(payment.charge_id || "");
      paidByChargeId.set(
        chargeId,
        (paidByChargeId.get(chargeId) || 0) + Number(payment.amount || 0)
      );
    }
  }

  return {
    settings: settingsResult.data as Settings | null,
    settingsError: settingsResult.error?.message || null,
    items: (itemsResult.data || []) as KiddushItem[],
    itemsError: itemsResult.error?.message || null,
    reservations: reservations.map((reservation) => {
      const paymentSum = [
        reservation.charge_id,
        reservation.additional_charge_id,
      ].reduce(
        (sum, chargeId) =>
          sum + (paidByChargeId.get(String(chargeId || "")) || 0),
        0
      );

      return {
        ...reservation,
        amount_paid:
          paymentSum > 0 || reservation.payment_status !== "paid"
            ? paymentSum
            : Number(reservation.total_amount || 0),
      };
    }),
    reservationsError: reservationsResult.error?.message || null,
  };
}

export default async function AdminKiddushPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const showAllReservations = params?.view === "all";
  const {
    settings,
    settingsError,
    items,
    itemsError,
    reservations,
    reservationsError,
  } = await getPageData(showAllReservations);

  const paidTotal = reservations
    .filter((reservation) => reservation.payment_status === "paid")
    .reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);

  const pendingTotal = reservations
    .filter((reservation) => reservation.payment_status !== "paid")
    .reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            ← Admin Dashboard
          </Link>

          <Link
            href="/kiddush"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            Public Kiddush Page
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Admin Portal
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Kiddush Reservations
          </h1>
          <p className="mt-4 max-w-2xl text-slate-200">
            Update item prices, notification settings, and review reserved
            Shabbosim.
          </p>
        </div>

        {params?.error ? (
          <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            {params.error}
          </p>
        ) : null}

        {params?.settingsSaved ||
        params?.itemsSaved ||
        params?.itemAdded ||
        params?.reservationUpdated ||
        params?.balanceBilled ? (
          <p className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
            Kiddush admin changes saved.
          </p>
        ) : null}

        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e3d9c7] bg-white p-5">
            <p className="text-sm font-bold text-slate-500">Reservations</p>
            <p className="mt-2 text-3xl font-black">{reservations.length}</p>
          </div>
          <div className="rounded-2xl border border-[#e3d9c7] bg-white p-5">
            <p className="text-sm font-bold text-slate-500">Paid</p>
            <p className="mt-2 text-3xl font-black">{formatMoney(paidTotal)}</p>
          </div>
          <div className="rounded-2xl border border-[#e3d9c7] bg-white p-5">
            <p className="text-sm font-bold text-slate-500">Pending / Review</p>
            <p className="mt-2 text-3xl font-black">
              {formatMoney(pendingTotal)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            action={updateKiddushSettings}
            className="rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-black">Settings</h2>
            {settingsError ? (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
                {settingsError}
              </p>
            ) : null}

            <label className="mt-5 flex items-center gap-3 text-sm font-bold text-slate-700">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={settings?.enabled ?? true}
              />
              Reservations open
            </label>

            <div className="mt-5 grid gap-4">
              <label className="space-y-2 text-sm font-bold text-slate-700">
                Notification Email
                <input
                  name="notification_email"
                  type="email"
                  defaultValue={settings?.notification_email || "ybcuzz@gmail.com"}
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
              </label>

              <label className="space-y-2 text-sm font-bold text-slate-700">
                Zelle Email
                <input
                  name="zelle_email"
                  type="email"
                  defaultValue={
                    settings?.zelle_email || "khalbneialiyah@gmail.com"
                  }
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-2 text-sm font-bold text-slate-700">
                  Weeks Shown
                  <input
                    name="weeks_to_show"
                    type="number"
                    min="1"
                    max="104"
                    step="1"
                    defaultValue={settings?.weeks_to_show || 26}
                    className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                  />
                </label>

                <label className="space-y-2 text-sm font-bold text-slate-700">
                  Base Fee
                  <input
                    name="base_fee_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={Number(settings?.base_fee_amount ?? 49)}
                    className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                  />
                </label>

                <label className="space-y-2 text-sm font-bold text-slate-700">
                  Minimum Total
                  <input
                    name="minimum_total_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={Number(settings?.minimum_total_amount ?? 215)}
                    className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm font-bold text-slate-700">
                Page Headline
                <input
                  name="headline"
                  defaultValue={settings?.headline || "Kiddush Reservations"}
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
              </label>

              <label className="space-y-2 text-sm font-bold text-slate-700">
                Page Message
                <textarea
                  name="message"
                  rows={4}
                  defaultValue={settings?.message || ""}
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
              </label>
            </div>

            <button className="mt-5 rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white">
              Save Settings
            </button>
          </form>

          <div className="rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Add Item</h2>
            <form action={addKiddushItem} className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  name="new_name"
                  required
                  placeholder="Item name"
                  className="rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
                <input
                  name="new_description"
                  placeholder="Description"
                  className="rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
                <input
                  name="new_price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  className="rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
                <input
                  name="new_default_quantity"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Default quantity"
                  className="rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
                <input
                  name="new_max_quantity"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Max quantity blank = no max"
                  className="rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
                <input
                  name="new_display_order"
                  type="number"
                  step="1"
                  placeholder="Display order"
                  className="rounded-xl border border-[#d8cdb7] px-3 py-3"
                />
              </div>
              <button className="rounded-full bg-[#8b6b2e] px-5 py-3 text-sm font-bold text-white">
                Add Item
              </button>
            </form>
          </div>
        </div>

        <form
          action={updateKiddushItems}
          className="mt-6 rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black">Items &amp; Prices</h2>
            <button className="rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white">
              Save Items
            </button>
          </div>

          {itemsError ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
              {itemsError}
            </p>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[920px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Default</th>
                  <th className="px-3 py-2">Max</th>
                  <th className="px-3 py-2">Order</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="bg-[#fbf8f2]">
                    <td className="rounded-l-2xl px-3 py-3">
                      <input type="hidden" name="item_id" value={item.id} />
                      <input
                        name={`is_active_${item.id}`}
                        type="checkbox"
                        defaultChecked={item.is_active}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`name_${item.id}`}
                        defaultValue={item.name}
                        className="w-full rounded-lg border border-[#d8cdb7] bg-white px-2 py-2 font-bold"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`description_${item.id}`}
                        defaultValue={item.description || ""}
                        className="w-full rounded-lg border border-[#d8cdb7] bg-white px-2 py-2"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`price_${item.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={Number(item.price || 0)}
                        className="w-24 rounded-lg border border-[#d8cdb7] bg-white px-2 py-2"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`default_quantity_${item.id}`}
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={item.default_quantity}
                        className="w-20 rounded-lg border border-[#d8cdb7] bg-white px-2 py-2"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`max_quantity_${item.id}`}
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={item.max_quantity ?? ""}
                        className="w-24 rounded-lg border border-[#d8cdb7] bg-white px-2 py-2"
                      />
                    </td>
                    <td className="rounded-r-2xl px-3 py-3">
                      <input
                        name={`display_order_${item.id}`}
                        type="number"
                        step="1"
                        defaultValue={item.display_order}
                        className="w-24 rounded-lg border border-[#d8cdb7] bg-white px-2 py-2"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <section
          id="reservations"
          className="mt-6 rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Reservations</h2>
              <p className="mt-1 text-sm text-slate-600">
                {showAllReservations
                  ? "Showing all recent Kiddush reservations."
                  : "Showing the next few upcoming reservations."}
              </p>
            </div>

            <Link
              href={
                showAllReservations
                  ? "/admin/kiddush#reservations"
                  : "/admin/kiddush?view=all#reservations"
              }
              className="self-start rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-[#f2eadc] sm:self-center"
            >
              {showAllReservations ? "Show Upcoming" : "View All"}
            </Link>
          </div>

          {reservationsError ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
              {reservationsError}
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 lg:hidden">
            {reservations.map((reservation) => (
              <article
                key={`${reservation.id}-card`}
                className="rounded-2xl bg-[#fbf8f2] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8b6b2e]">
                      {formatDate(reservation.shabbos_date)}
                    </p>
                    <h3 className="mt-1 text-lg font-black">
                      {reservation.sponsor_name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {reservation.sponsor_email}
                      {reservation.sponsor_phone
                        ? ` | ${reservation.sponsor_phone}`
                        : ""}
                    </p>
                  </div>
                  <p className="rounded-full bg-white px-3 py-1 text-sm font-black">
                    {formatMoney(
                      reservation.final_total_amount ?? reservation.total_amount
                    )}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-700">
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-white p-3 text-center">
                    <div>
                      <p className="text-xs font-bold text-slate-500">Base</p>
                      <p className="font-black">
                        {formatMoney(reservation.total_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">Paid</p>
                      <p className="font-black">
                        {formatMoney(reservation.amount_paid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500">
                        Remains
                      </p>
                      <p className="font-black">
                        {formatMoney(
                          Math.max(
                            0,
                            Number(
                              reservation.final_total_amount ??
                                reservation.total_amount
                            ) - reservation.amount_paid
                          )
                        )}
                      </p>
                    </div>
                  </div>
                  <p>
                    <span className="font-bold text-slate-900">Text:</span>{" "}
                    {reservation.sponsorship_text}
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Items:</span>{" "}
                    {itemSummary(reservation.items)}
                  </p>
                  {reservation.special_requests ? (
                    <p>
                      <span className="font-bold text-slate-900">
                        Special:
                      </span>{" "}
                      {reservation.special_requests}
                      <span className="mt-1 block text-xs font-bold text-[#8b6b2e]">
                        Charged separately
                      </span>
                    </p>
                  ) : null}
                  <div>
                    <p className="font-bold capitalize text-slate-900">
                      {reservation.payment_status.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {reservation.payment_method || "No method"}
                      {reservation.payment_reference
                        ? ` | ${reservation.payment_reference}`
                        : ""}
                    </p>
                    {reservation.payment_status !== "paid" ? (
                      <form
                        action={markKiddushPaid.bind(null, reservation.id)}
                        className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
                      >
                        <input
                          name="payment_reference"
                          className="rounded-lg border border-[#d8cdb7] bg-white px-3 py-2 text-sm"
                          placeholder="Ref/check"
                        />
                        <button className="rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white">
                          Mark Paid
                        </button>
                      </form>
                    ) : null}
                  </div>
                  {reservation.special_requests ? (
                    <form
                      action={updateKiddushFinalTotal.bind(
                        null,
                        reservation.id
                      )}
                      className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[1fr_auto]"
                    >
                      <label className="grid gap-1 text-sm font-bold text-slate-700">
                        Final total after special requests
                        <input
                          name="final_total_amount"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={Number(
                            reservation.final_total_amount ??
                              reservation.total_amount
                          ).toFixed(2)}
                          className="rounded-lg border border-[#d8cdb7] px-3 py-2"
                        />
                      </label>
                      <button className="self-end rounded-full bg-[#1d2940] px-4 py-2 text-sm font-bold text-white">
                        Bill Remaining
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1280px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Shabbos</th>
                  <th className="px-3 py-2">Sponsor</th>
                  <th className="px-3 py-2">Text</th>
                  <th className="px-3 py-2">Items</th>
                  <th className="px-3 py-2">Special</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Paid / Final</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="bg-[#fbf8f2] align-top">
                    <td className="rounded-l-2xl px-3 py-3 font-bold">
                      {formatDate(reservation.shabbos_date)}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold">{reservation.sponsor_name}</p>
                      <p className="text-xs text-slate-500">
                        {reservation.sponsor_email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {reservation.sponsor_phone || "—"}
                      </p>
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-slate-600">
                      {reservation.sponsorship_text}
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-slate-600">
                      {itemSummary(reservation.items)}
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-slate-600">
                      {reservation.special_requests ? (
                        <>
                          <p>{reservation.special_requests}</p>
                          <p className="mt-1 text-xs font-bold text-[#8b6b2e]">
                            Charged separately
                          </p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 font-bold">
                      {formatMoney(reservation.total_amount)}
                      {reservation.minimum_adjustment_amount > 0 ? (
                        <p className="text-xs font-semibold text-slate-500">
                          Includes {formatMoney(reservation.minimum_adjustment_amount)} minimum
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold">
                        Paid: {formatMoney(reservation.amount_paid)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Final:{" "}
                        {formatMoney(
                          reservation.final_total_amount ??
                            reservation.total_amount
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        Remains:{" "}
                        {formatMoney(
                          Math.max(
                            0,
                            Number(
                              reservation.final_total_amount ??
                                reservation.total_amount
                            ) - reservation.amount_paid
                          )
                        )}
                      </p>
                      {reservation.special_requests ? (
                        <form
                          action={updateKiddushFinalTotal.bind(
                            null,
                            reservation.id
                          )}
                          className="mt-2 grid gap-2"
                        >
                          <input
                            name="final_total_amount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={Number(
                              reservation.final_total_amount ??
                                reservation.total_amount
                            ).toFixed(2)}
                            className="w-32 rounded-lg border border-[#d8cdb7] bg-white px-2 py-1 text-xs"
                            aria-label="Final total after special requests"
                          />
                          <button className="rounded-full bg-[#1d2940] px-3 py-1 text-xs font-bold text-white">
                            Bill Remaining
                          </button>
                        </form>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold capitalize">
                        {reservation.payment_status.replaceAll("_", " ")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {reservation.payment_method || "—"}
                      </p>
                      {reservation.payment_reference ? (
                        <p className="text-xs text-slate-500">
                          {reservation.payment_reference}
                        </p>
                      ) : null}
                      {reservation.payment_status !== "paid" ? (
                        <form
                          action={markKiddushPaid.bind(null, reservation.id)}
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
                    <td className="rounded-r-2xl px-3 py-3 text-slate-600">
                      {formatDate(reservation.created_at.slice(0, 10))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reservations.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
              No Kiddush reservations yet.
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
