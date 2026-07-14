"use client";

import { useMemo, useState } from "react";
import { submitKiddushReservation } from "./actions";

type KiddushItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  default_quantity: number;
  max_quantity: number | null;
};

type ShabbosOption = {
  date: string;
  label: string;
  reserved: boolean;
};

type KiddushReservationFormProps = {
  items: KiddushItem[];
  shabbosOptions: ShabbosOption[];
  zelleEmail: string;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function KiddushReservationForm({
  items,
  shabbosOptions,
  zelleEmail,
}: KiddushReservationFormProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, Number(item.default_quantity || 0)])
    )
  );

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(quantities[item.id] || 0) * Number(item.price || 0),
        0
      ),
    [items, quantities]
  );

  function setQuantity(item: KiddushItem, value: string) {
    const parsed = Math.max(0, Math.floor(Number(value || 0)));
    const quantity =
      item.max_quantity === null
        ? parsed
        : Math.min(parsed, Number(item.max_quantity));

    setQuantities((current) => ({
      ...current,
      [item.id]: Number.isFinite(quantity) ? quantity : 0,
    }));
  }

  return (
    <form action={submitKiddushReservation} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-bold text-slate-700">
          Your Name
          <input
            name="sponsor_name"
            required
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
            placeholder="Moshe Cohen"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Email
          <input
            name="sponsor_email"
            type="email"
            required
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
            placeholder="name@example.com"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Phone
          <input
            name="sponsor_phone"
            type="tel"
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
            placeholder="718-555-1234"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Shabbos / Parsha
          <select
            name="shabbos_date"
            required
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
          >
            <option value="">Choose a Shabbos</option>
            {shabbosOptions.map((option) => (
              <option
                key={option.date}
                value={option.date}
                disabled={option.reserved}
              >
                {option.label}
                {option.reserved ? " - reserved" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-2 text-sm font-bold text-slate-700">
        Sponsorship Text
        <textarea
          name="sponsorship_text"
          rows={3}
          required
          className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
          placeholder="In honor of... / L'ilui nishmas..."
        />
      </label>

      <div className="rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-4 sm:p-5">
        <div className="flex flex-col gap-2 border-b border-[#e3d9c7] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Kiddush Items
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Choose the standard items and quantities. Special requests are
              reviewed separately.
            </p>
          </div>

          <p className="rounded-full bg-[#1d2940] px-4 py-2 text-sm font-black text-white">
            {formatMoney(total)}
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-2xl border border-[#e9dfcf] bg-white p-4 md:grid-cols-[minmax(0,1fr)_120px]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-900">{item.name}</p>
                  <span className="rounded-full bg-[#f0e5ca] px-2.5 py-1 text-xs font-black text-[#8b6b2e]">
                    {formatMoney(Number(item.price || 0))}
                    {item.max_quantity === 1 ? "" : " ea"}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {item.description || "Standard Kiddush item"}
                  {item.max_quantity !== null
                    ? ` | Max ${item.max_quantity}`
                    : ""}
                </p>
              </div>

              <label className="grid gap-1 text-sm font-bold text-slate-700">
                Quantity
                <input
                  name={`item_${item.id}`}
                  type="number"
                  min="0"
                  max={item.max_quantity ?? undefined}
                  step="1"
                  value={quantities[item.id] || 0}
                  onChange={(event) =>
                    setQuantity(item, event.currentTarget.value)
                  }
                  className="h-12 w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-2.5 text-right text-base font-black text-slate-900"
                />
              </label>
            </div>
          ))}
        </div>

        <label className="mt-4 block space-y-2 text-sm font-bold text-slate-700">
          Special Requests
          <textarea
            name="special_requests"
            rows={3}
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
            placeholder="Sushi, catered cholent, salami, setup notes..."
          />
          <span className="block text-xs font-semibold text-slate-500">
            Special requests are not included in this checkout and will be
            charged separately after review.
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-[#e3d9c7] bg-white p-4 sm:p-5">
        <h2 className="text-xl font-black text-slate-900">Payment</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Card payment continues to secure checkout. Zelle submissions go to
          accounting review.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#d8cdb7] bg-[#fbf8f2] p-4">
            <input
              name="payment_method"
              type="radio"
              value="card"
              required
              className="mt-1"
            />
            <span>
              <span className="block font-black text-slate-900">
                Pay by Card
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                Continue to secure card checkout and receive a receipt.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#d8cdb7] bg-[#fbf8f2] p-4">
            <input
              name="payment_method"
              type="radio"
              value="zelle"
              required
              className="mt-1"
            />
            <span>
              <span className="block font-black text-slate-900">
                I Paid by Zelle
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                Send to {zelleEmail}, then submit for review.
              </span>
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-full bg-[#8b6b2e] px-6 py-4 text-base font-black text-white transition hover:bg-[#745822]"
      >
        Submit Kiddush Reservation
      </button>
    </form>
  );
}
