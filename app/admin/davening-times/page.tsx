import Link from "next/link";
import {
  publishWeeklySchedule,
  saveDaveningTimes,
  toggleSeasonalSchedule,
  unpublishWeeklySchedule,
  uploadSeasonalSchedule,
} from "./actions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import WeeklyScheduleForm from "./WeeklyScheduleForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    saved?: string;
    created?: string;
    published?: string;
    unpublished?: string;
    seasonalUploaded?: string;
    seasonalUpdated?: string;
  }>;
};

type WeeklyScheduleRow = {
  id: string;
  title: string;
  hebrew_title: string | null;
  hebrew_date: string | null;
  schedule_type: string;
  start_date: string;
  end_date: string;
  source_pdf_url: string | null;
  source_pdf_name: string | null;
  is_published: boolean;
  created_at: string;
};

type SeasonalScheduleRow = {
  id: string;
  title: string;
  schedule_type: string;
  description: string | null;
  pdf_url: string;
  pdf_name: string | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  display_on_homepage: boolean;
  is_published: boolean;
  created_at: string;
};

async function getCurrentRegularSchedule() {
  const { data, error } = await supabaseAdmin
    .from("davening_schedules")
    .select(
      "title, weekday_shacharis, sunday_shacharis, mincha, maariv, notes"
    )
    .eq("is_published", true)
    .eq("show_on_homepage", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Could not load regular davening schedule:", error.message);
  }

  return data;
}

async function getWeeklySchedules(): Promise<WeeklyScheduleRow[]> {
  const { data, error } = await supabaseAdmin
    .from("weekly_schedules")
    .select(
      `
      id,
      title,
      hebrew_title,
      hebrew_date,
      schedule_type,
      start_date,
      end_date,
      source_pdf_url,
      source_pdf_name,
      is_published,
      created_at
      `
    )
    .order("start_date", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Could not load weekly schedules:", error.message);
    return [];
  }

  return data ?? [];
}

async function getSeasonalSchedules(): Promise<SeasonalScheduleRow[]> {
  const { data, error } = await supabaseAdmin
    .from("seasonal_schedules")
    .select(
      `
      id,
      title,
      schedule_type,
      description,
      pdf_url,
      pdf_name,
      effective_start_date,
      effective_end_date,
      display_on_homepage,
      is_published,
      created_at
      `
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Could not load seasonal schedules:", error.message);
    return [];
  }

  return data ?? [];
}

function formatDate(value: string | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default async function AdminDaveningTimesPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const [regularSchedule, weeklySchedules, seasonalSchedules] =
    await Promise.all([
      getCurrentRegularSchedule(),
      getWeeklySchedules(),
      getSeasonalSchedules(),
    ]);

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <Link
          href="/admin"
          className="text-sm font-semibold text-[#8b6b2e] hover:underline"
        >
          ← Back to Admin
        </Link>

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-7 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
            Admin
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Davening Times &amp; Schedules
          </h1>

          <p className="mt-4 max-w-3xl leading-7 text-slate-600">
            Manage regular weekday times, weekly Shabbos and Yom Tov schedules,
            announcements, and full seasonal PDF schedules.
          </p>
        </div>

        {params?.saved === "1" && (
          <SuccessMessage>
            Regular davening times were saved successfully.
          </SuccessMessage>
        )}

        {params?.created === "1" && (
          <SuccessMessage>
            The weekly schedule was saved as a draft. Review it below and click
            Publish when ready.
          </SuccessMessage>
        )}

        {params?.published === "1" && (
          <SuccessMessage>
            The weekly schedule is now published on the homepage.
          </SuccessMessage>
        )}

        {params?.unpublished === "1" && (
          <SuccessMessage>The weekly schedule was unpublished.</SuccessMessage>
        )}

        {params?.seasonalUploaded === "1" && (
          <SuccessMessage>
            The seasonal schedule PDF was uploaded and published.
          </SuccessMessage>
        )}

        {params?.seasonalUpdated === "1" && (
          <SuccessMessage>
            The seasonal schedule visibility was updated.
          </SuccessMessage>
        )}

        <form
          action={saveDaveningTimes}
          className="mt-8 space-y-6 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e]">
              Regular Schedule
            </p>

            <h2 className="mt-2 text-2xl font-bold">Regular Weekday Times</h2>
          </div>

          <label className="block space-y-2">
            <span className="font-semibold">Schedule Title</span>
            <input
              name="title"
              className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              defaultValue={
                regularSchedule?.title || "Current Shul Times"
              }
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <ScheduleInput
              label="Weekday Shacharis"
              name="weekday_shacharis"
              placeholder="7:00 AM"
              defaultValue={regularSchedule?.weekday_shacharis}
            />

            <ScheduleInput
              label="Sunday Shacharis"
              name="sunday_shacharis"
              placeholder="8:00 AM"
              defaultValue={regularSchedule?.sunday_shacharis}
            />

            <ScheduleInput
              label="Weekday Mincha"
              name="mincha"
              placeholder="8:00 PM"
              defaultValue={regularSchedule?.mincha}
            />

            <ScheduleInput
              label="Weekday Maariv"
              name="maariv"
              placeholder="See weekly schedule"
              defaultValue={regularSchedule?.maariv}
            />
          </div>

          <label className="block space-y-2">
            <span className="font-semibold">Notes</span>
            <textarea
              name="notes"
              className="min-h-28 w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              placeholder="Special weekday notes or changes"
              defaultValue={regularSchedule?.notes || ""}
            />
          </label>

          <button
            type="submit"
            className="rounded-full bg-[#8b6b2e] px-6 py-3 font-semibold text-white transition hover:bg-[#745822]"
          >
            Save Regular Times
          </button>
        </form>

        <WeeklyScheduleForm />

        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e]">
              Weekly Records
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Weekly Schedule Drafts &amp; Published Schedules
            </h2>
          </div>

          {weeklySchedules.length === 0 ? (
            <EmptyMessage>No weekly schedules have been created yet.</EmptyMessage>
          ) : (
            <div className="mt-6 space-y-4">
              {weeklySchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{schedule.title}</h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          schedule.is_published
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {schedule.is_published ? "Published" : "Draft"}
                      </span>

                      <span className="rounded-full bg-[#eee5d5] px-3 py-1 text-xs font-bold capitalize text-[#755a25]">
                        {schedule.schedule_type.replaceAll("_", " ")}
                      </span>
                    </div>

                    {schedule.hebrew_title && (
                      <p className="mt-1 text-lg font-semibold" dir="rtl">
                        {schedule.hebrew_title}
                      </p>
                    )}

                    <p className="mt-2 text-sm text-slate-600">
                      {formatDate(schedule.start_date)} through{" "}
                      {formatDate(schedule.end_date)}
                    </p>

                    {schedule.source_pdf_name && (
                      <p className="mt-1 truncate text-xs text-slate-500">
                        PDF: {schedule.source_pdf_name}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {schedule.source_pdf_url && (
                      <a
                        href={schedule.source_pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-sm font-bold"
                      >
                        Open PDF
                      </a>
                    )}

                    {schedule.is_published ? (
                      <form action={unpublishWeeklySchedule}>
                        <input
                          type="hidden"
                          name="schedule_id"
                          value={schedule.id}
                        />

                        <button
                          type="submit"
                          className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900"
                        >
                          Unpublish
                        </button>
                      </form>
                    ) : (
                      <form action={publishWeeklySchedule}>
                        <input
                          type="hidden"
                          name="schedule_id"
                          value={schedule.id}
                        />

                        <button
                          type="submit"
                          className="rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white"
                        >
                          Publish
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e]">
              Long-Term Schedule
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Upload Winter, Summer, or Yom Tov PDF
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              This PDF appears beneath the weekly announcements and weekly PDF
              on the homepage.
            </p>
          </div>

          <form action={uploadSeasonalSchedule} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <ScheduleInput
                label="Schedule Title"
                name="seasonal_title"
                placeholder="Winter 2026–2027 Schedule"
                required
              />

              <label className="space-y-2">
                <span className="font-semibold">Schedule Type</span>

                <select
                  name="seasonal_type"
                  defaultValue="winter"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                >
                  <option value="winter">Winter</option>
                  <option value="summer">Summer</option>
                  <option value="selichos">Selichos</option>
                  <option value="yom_tov">Yom Tov</option>
                  <option value="seasonal">Seasonal</option>
                  <option value="special">Special</option>
                </select>
              </label>

              <ScheduleInput
                label="Effective Start Date"
                name="seasonal_start_date"
                type="date"
              />

              <ScheduleInput
                label="Effective End Date"
                name="seasonal_end_date"
                type="date"
              />
            </div>

            <label className="block space-y-2">
              <span className="font-semibold">Description</span>

              <textarea
                name="seasonal_description"
                className="min-h-24 w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="Full winter weekday and Motzei Shabbos schedule"
              />
            </label>

            <label className="block space-y-2">
              <span className="font-semibold">PDF File</span>

              <input
                name="seasonal_pdf_file"
                type="file"
                accept="application/pdf"
                required
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
              />
            </label>

            <button
              type="submit"
              className="rounded-full bg-[#1d2940] px-6 py-3 font-semibold text-white"
            >
              Upload Seasonal Schedule
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold">Existing Seasonal Schedules</h2>

          {seasonalSchedules.length === 0 ? (
            <EmptyMessage>
              No seasonal schedule PDFs have been uploaded yet.
            </EmptyMessage>
          ) : (
            <div className="mt-6 space-y-4">
              {seasonalSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{schedule.title}</h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          schedule.is_published
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {schedule.is_published ? "Published" : "Hidden"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm capitalize text-slate-600">
                      {schedule.schedule_type.replaceAll("_", " ")}
                    </p>

                    {schedule.effective_start_date && (
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(schedule.effective_start_date)}
                        {schedule.effective_end_date
                          ? ` through ${formatDate(
                              schedule.effective_end_date
                            )}`
                          : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={schedule.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-sm font-bold"
                    >
                      Open PDF
                    </a>

                    <form action={toggleSeasonalSchedule}>
                      <input
                        type="hidden"
                        name="schedule_id"
                        value={schedule.id}
                      />

                      <input
                        type="hidden"
                        name="publish"
                        value={schedule.is_published ? "false" : "true"}
                      />

                      <button
                        type="submit"
                        className={`rounded-full px-4 py-2 text-sm font-bold ${
                          schedule.is_published
                            ? "bg-amber-100 text-amber-900"
                            : "bg-green-700 text-white"
                        }`}
                      >
                        {schedule.is_published ? "Hide" : "Publish"}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function SuccessMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
      {children}
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-[#d8cdb7] bg-[#fbf8f2] p-8 text-center text-sm text-slate-600">
      {children}
    </div>
  );
}

function ScheduleInput({
  label,
  name,
  placeholder,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="font-semibold">{label}</span>

      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue || ""}
        required={required}
        className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
      />
    </label>
  );
}