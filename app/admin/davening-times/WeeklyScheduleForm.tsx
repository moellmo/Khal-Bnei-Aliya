"use client";

import { uploadWeeklySchedule } from "./actions";

export default function WeeklyScheduleForm() {
  return (
    <form
      action={uploadWeeklySchedule}
      className="relative mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8"
    >
      <input
        type="hidden"
        name="schedule_days_json"
        value="[]"
      />

      <input
        type="hidden"
        name="announcements_json"
        value="[]"
      />

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e]">
          Weekly Schedule
        </p>

        <h2 className="mt-2 text-2xl font-bold">
          Upload This Week’s PDF
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Upload the weekly PDF and the system will extract
          the Friday times, Shabbos times, Kiddush information,
          sponsors, and announcements automatically.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field
          label="Display Title"
          name="title"
          placeholder="Matos-Masei"
          required
        />

        <Field
          label="Hebrew Title"
          name="hebrew_title"
          placeholder="פרשת מטות-מסעי"
          dir="rtl"
        />

        <Field
          label="Hebrew Date"
          name="hebrew_date"
          placeholder='כ"ו תמוז'
          dir="rtl"
        />

        <label className="space-y-2">
          <span className="font-semibold">
            Schedule Type
          </span>

          <select
            name="schedule_type"
            defaultValue="shabbos"
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
          >
            <option value="shabbos">
              Regular Shabbos
            </option>

            <option value="yom_tov">
              Yom Tov
            </option>

            <option value="yom_tov_shabbos">
              Yom Tov and Shabbos
            </option>

            <option value="fast_day">
              Fast Day
            </option>

            <option value="special">
              Special Schedule
            </option>
          </select>
        </label>

        <Field
          label="Effective From"
          name="start_date"
          type="date"
          required
        />

        <Field
          label="Effective To"
          name="end_date"
          type="date"
          required
        />
      </div>

      <label className="mt-5 block space-y-2">
        <span className="font-semibold">
          Optional Subtitle
        </span>

        <input
          name="subtitle"
          className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          placeholder="This week at Khal Bnei Aliya"
        />
      </label>

      <label className="mt-5 block space-y-2">
        <span className="font-semibold">
          Optional General Note
        </span>

        <textarea
          name="general_note"
          className="min-h-24 w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          placeholder="Only enter something here if it is not already in the PDF."
        />
      </label>

      <label className="mt-5 block space-y-2">
        <span className="font-semibold">
          Weekly PDF
        </span>

        <input
          name="pdf_file"
          type="file"
          accept="application/pdf"
          required
          className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
        />
      </label>

      <div className="sticky bottom-3 z-20 mt-7 rounded-2xl border border-[#d8cdb7] bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          type="submit"
          className="w-full rounded-full bg-[#1d2940] px-7 py-3.5 font-bold text-white transition hover:bg-[#10192b]"
        >
          Upload PDF &amp; Create Draft
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
  dir,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="space-y-2">
      <span className="font-semibold">
        {label}
      </span>

      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        dir={dir}
        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
      />
    </label>
  );
}