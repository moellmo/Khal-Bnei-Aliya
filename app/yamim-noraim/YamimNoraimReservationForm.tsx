"use client";

import { useMemo, useState } from "react";
import {
  calculateYamimNoraimPrice,
  type YamimNoraimMembershipType,
  type YamimNoraimPricingSettings,
} from "@/lib/yamimNoraim/pricing";

type ReservationAction = (formData: FormData) => void | Promise<void>;

type Props = {
  action: ReservationAction;
  settings: YamimNoraimPricingSettings;
  error?: string;
  reserved?: string;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function YamimNoraimReservationForm({
  action,
  settings,
  error,
  reserved,
}: Props) {
  const [membershipType, setMembershipType] =
    useState<YamimNoraimMembershipType>("member");
  const [roshHashanaMenSeats, setRoshHashanaMenSeats] = useState(0);
  const [roshHashanaWomenSeats, setRoshHashanaWomenSeats] = useState(0);
  const [yomKippurMenSeats, setYomKippurMenSeats] = useState(0);
  const [yomKippurWomenSeats, setYomKippurWomenSeats] = useState(0);

  const pricing = useMemo(
    () =>
      calculateYamimNoraimPrice({
        membershipType,
        counts: {
          roshHashanaMenSeats,
          roshHashanaWomenSeats,
          yomKippurMenSeats,
          yomKippurWomenSeats,
        },
        settings,
      }),
    [
      membershipType,
      roshHashanaMenSeats,
      roshHashanaWomenSeats,
      yomKippurMenSeats,
      yomKippurWomenSeats,
      settings,
    ]
  );

  return (
    <form action={action} className="space-y-5">
      <div>
        <h2 className="text-2xl font-black">Reserve Seats</h2>
        <p className="mt-1 text-sm text-slate-500">
          Submit once per family. Your reservation will be received first, then
          you can choose card payment or Zelle.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
          {error}
        </p>
      ) : null}

      {reserved ? (
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
            required
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Phone
          <input
            name="phone"
            type="tel"
            required
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
          />
        </label>
      </div>

      <fieldset className="rounded-2xl bg-[#fbf8f2] p-4">
        <legend className="text-lg font-black">Membership pricing</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-3 rounded-xl border border-[#d8cdb7] bg-white p-4">
            <input
              type="radio"
              name="membership_type"
              value="member"
              checked={membershipType === "member"}
              onChange={() => setMembershipType("member")}
              className="mt-1"
            />
            <span>
              <span className="block font-black">Khal Bnei Aliya member</span>
              <span className="mt-1 block text-xs text-slate-500">
                Member/family pricing
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer gap-3 rounded-xl border border-[#d8cdb7] bg-white p-4">
            <input
              type="radio"
              name="membership_type"
              value="non_member"
              checked={membershipType === "non_member"}
              onChange={() => setMembershipType("non_member")}
              className="mt-1"
            />
            <span>
              <span className="block font-black">Non-member</span>
              <span className="mt-1 block text-xs text-slate-500">
                Base price includes up to two seats per holiday
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="grid gap-4 rounded-2xl bg-[#fbf8f2] p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h3 className="text-lg font-black">Rosh Hashana</h3>
        </div>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Men&apos;s Seats
          <input
            name="rosh_hashana_men_seats"
            type="number"
            min="0"
            max="100"
            value={roshHashanaMenSeats}
            onChange={(event) =>
              setRoshHashanaMenSeats(Math.max(0, Number(event.target.value) || 0))
            }
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Women&apos;s Seats
          <input
            name="rosh_hashana_women_seats"
            type="number"
            min="0"
            max="100"
            value={roshHashanaWomenSeats}
            onChange={(event) =>
              setRoshHashanaWomenSeats(Math.max(0, Number(event.target.value) || 0))
            }
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
          />
        </label>
      </div>

      <div className="grid gap-4 rounded-2xl bg-[#fbf8f2] p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h3 className="text-lg font-black">Yom Kippur</h3>
        </div>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Men&apos;s Seats
          <input
            name="yom_kippur_men_seats"
            type="number"
            min="0"
            max="100"
            value={yomKippurMenSeats}
            onChange={(event) =>
              setYomKippurMenSeats(Math.max(0, Number(event.target.value) || 0))
            }
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Women&apos;s Seats
          <input
            name="yom_kippur_women_seats"
            type="number"
            min="0"
            max="100"
            value={yomKippurWomenSeats}
            onChange={(event) =>
              setYomKippurWomenSeats(Math.max(0, Number(event.target.value) || 0))
            }
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
          />
        </label>
      </div>

      <div className="rounded-2xl border-2 border-[#d9bf7a] bg-[#fffaf0] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8b6b2e]">
              Estimated total
            </p>
            <p className="mt-1 text-3xl font-black">
              {formatMoney(pricing.totalAmount)}
            </p>
          </div>
          <p className="text-right text-sm font-bold text-slate-600">
            {pricing.label}
            {pricing.additionalAmount > 0 ? (
              <span className="block text-xs font-normal">
                Includes {formatMoney(pricing.additionalAmount)} for additional
                seats
              </span>
            ) : null}
          </p>
        </div>
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
        className="w-full rounded-full bg-[#1d2940] px-6 py-4 text-base font-black text-white transition hover:bg-[#10192b]"
      >
        Submit · {formatMoney(pricing.totalAmount)}
      </button>
    </form>
  );
}
