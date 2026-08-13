"use client";

import { useMemo, useState } from "react";
import {
  assistanceFieldGroups,
  assistanceHolidays,
  calculateAssistanceTotals,
  type AssistanceCounts,
} from "@/lib/yomTovAssistance";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
};

const initialCounts: AssistanceCounts = {
  adultsCount: 0,
  childrenUnder3Count: 0,
  childrenAges3To8RoshHashanah: 0,
  childrenAges3To8FirstDaysSukkos: 0,
  childrenAges3To8SheminiAtzeres: 0,
  childrenAges9To13RoshHashanah: 0,
  childrenAges9To13FirstDaysSukkos: 0,
  childrenAges9To13SheminiAtzeres: 0,
  age14PlusRoshHashanah: 0,
  age14PlusFirstDaysSukkos: 0,
  age14PlusSheminiAtzeres: 0,
};

function numberFieldName(groupKey: string, holidayKey: string) {
  return `${groupKey}_${holidayKey}`;
}

const countFieldKeys: Record<string, keyof AssistanceCounts> = {
  children_ages_3_8_rosh_hashanah: "childrenAges3To8RoshHashanah",
  children_ages_3_8_first_days_sukkos: "childrenAges3To8FirstDaysSukkos",
  children_ages_3_8_shemini_atzeres: "childrenAges3To8SheminiAtzeres",
  children_ages_9_13_rosh_hashanah: "childrenAges9To13RoshHashanah",
  children_ages_9_13_first_days_sukkos: "childrenAges9To13FirstDaysSukkos",
  children_ages_9_13_shemini_atzeres: "childrenAges9To13SheminiAtzeres",
  age_14_plus_rosh_hashanah: "age14PlusRoshHashanah",
  age_14_plus_first_days_sukkos: "age14PlusFirstDaysSukkos",
  age_14_plus_shemini_atzeres: "age14PlusSheminiAtzeres",
};

export default function YomTovAssistanceForm({
  action,
  error,
}: Props) {
  const [counts, setCounts] = useState(initialCounts);
  const totals = useMemo(() => calculateAssistanceTotals(counts), [counts]);

  function setCount(key: keyof AssistanceCounts, value: string) {
    setCounts((current) => ({
      ...current,
      [key]: Math.min(50, Math.max(0, Math.floor(Number(value) || 0))),
    }));
  }

  return (
    <form action={action} className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b6b2e]">
          Private community request
        </p>
        <h1 className="mt-2 text-3xl font-black">Yom Tov Assistance</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Please complete this confidential request. Only authorized community
          staff will review it. The family ID and point total are assigned
          automatically after submission.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-bold text-slate-700">
          Family Name
          <input
            name="family_name"
            required
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          Contact Name (optional)
          <input
            name="contact_name"
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>
      </div>

      <div className="rounded-2xl bg-[#fbf8f2] p-5">
        <h2 className="text-xl font-black">Family count</h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter the number of people in each age group attending each holiday.
          The total uses the largest number entered for each age group, so a
          person attending multiple holidays is counted once.
        </p>
        <div className="mt-4 rounded-xl border border-[#d9bf7a] bg-[#fffaf0] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8b6b2e]">
            Total people in family · auto-calculated
          </p>
          <p className="mt-1 text-2xl font-black">{totals.totalPeopleInFamily}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#e3d9c7]">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[190px_repeat(3,minmax(150px,1fr))] bg-[#1d2940] text-xs font-bold uppercase tracking-[0.08em] text-white">
            <div className="p-3">Age group</div>
            {assistanceHolidays.map((holiday) => (
              <div key={holiday.key} className="p-3 text-center">
                {holiday.label}
              </div>
            ))}
          </div>
          {assistanceFieldGroups.map((group) => (
            <div
              key={group.key}
              className="grid grid-cols-[190px_repeat(3,minmax(150px,1fr))] border-t border-[#e3d9c7] bg-white"
            >
              <div className="p-3 text-sm font-black">
                {group.label}
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {group.points.toFixed(2)} point each
                </span>
              </div>
              {assistanceHolidays.map((holiday) => {
                const fieldName = numberFieldName(group.key, holiday.key);
                const key = countFieldKeys[fieldName];
                return (
                  <label key={holiday.key} className="p-3">
                    <span className="sr-only">{group.label}, {holiday.label}</span>
                    <input
                      name={fieldName}
                      type="number"
                      min="0"
                      max="50"
                      step="1"
                      inputMode="numeric"
                      value={counts[key]}
                      onChange={(event) => setCount(key, event.target.value)}
                      className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3 text-center"
                    />
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-[#d9bf7a] bg-[#fffaf0] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8b6b2e]">
          Calculated total points
        </p>
        <p className="mt-1 text-3xl font-black">{totals.totalPoints.toFixed(2)}</p>
      </div>

      <label className="block space-y-2 text-sm font-bold text-slate-700">
        Notes
        <textarea
          name="notes"
          rows={4}
          className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          placeholder="Optional confidential note"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-full bg-[#1d2940] px-6 py-4 font-black text-white"
      >
        Submit Confidential Request
      </button>
    </form>
  );
}
