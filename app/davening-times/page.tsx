import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  parseKbaSchedulePdf,
  type ParsedKbaSchedule,
} from "@/lib/schedules/parseKbaSchedulePdf";

export const dynamic = "force-dynamic";

type WeeklySchedule = {
  title: string;
  source_pdf_url: string | null;
  source_pdf_name: string | null;
};

async function getPublishedWeeklySchedule() {
  const { data, error } = await supabaseAdmin
    .from("weekly_schedules")
    .select("title, source_pdf_url, source_pdf_name")
    .eq("is_published", true)
    .not("source_pdf_url", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Unable to load published weekly schedule:", error.message);
    return null;
  }

  return data as WeeklySchedule | null;
}

async function parsePublishedSchedule(
  schedule: WeeklySchedule | null
): Promise<ParsedKbaSchedule | null> {
  if (!schedule?.source_pdf_url) {
    return null;
  }

  try {
    const response = await fetch(schedule.source_pdf_url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Unable to fetch PDF: ${response.status}`);
    }

    const blob = await response.blob();
    const file = new File(
      [blob],
      schedule.source_pdf_name || "weekly-schedule.pdf",
      { type: "application/pdf" }
    );

    return await parseKbaSchedulePdf(file);
  } catch (error) {
    console.error("Unable to parse weekly schedule PDF:", error);
    return null;
  }
}

export default async function DaveningTimesPage() {
  const weeklySchedule = await getPublishedWeeklySchedule();
  const parsedSchedule = await parsePublishedSchedule(weeklySchedule);
  const days = parsedSchedule?.days || [];
  const weeklyPdfUrl = weeklySchedule?.source_pdf_url || "";

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/" className="text-sm font-semibold text-[#8b6b2e]">
          ← Back Home
        </Link>

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-8 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
            Davening Times
          </p>
          <h1 className="mt-3 text-4xl font-bold md:text-5xl">
            Zmanim & Shul Schedule
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Times are pulled from the current weekly PDF whenever the uploaded
            file has readable text.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {days.length > 0 ? (
            days.map((day) => (
              <div
                key={day.dayTitle}
                className={
                  day.dayTitle.toLowerCase() === "shabbos"
                    ? "rounded-[2rem] bg-white p-6 shadow-sm"
                    : "rounded-[2rem] bg-[#1d2940] p-6 text-white"
                }
              >
                <h2 className="text-2xl font-bold">{day.dayTitle}</h2>
                <div className="mt-5 space-y-3">
                  {day.entries.map((entry) => (
                    <div
                      key={`${day.dayTitle}-${entry.eventName}`}
                      className={
                        day.dayTitle.toLowerCase() === "shabbos"
                          ? "flex justify-between gap-4 rounded-2xl bg-[#f8f4eb] p-4"
                          : "flex justify-between gap-4 rounded-2xl bg-white/10 p-4"
                      }
                    >
                      <span className="font-semibold">{entry.eventName}</span>
                      <span
                        className={
                          day.dayTitle.toLowerCase() === "shabbos"
                            ? "font-bold text-[#8b6b2e]"
                            : "font-bold text-[#f0d99a]"
                        }
                      >
                        {entry.eventTime || entry.note}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[2rem] bg-[#1d2940] p-6 text-white md:col-span-2">
              <h2 className="text-2xl font-bold">Current Times</h2>
              <p className="mt-3 text-slate-200">
                Open the weekly PDF below for the current schedule.
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
                Weekly PDF Schedule
              </p>
              <h2 className="mt-3 text-2xl font-bold">
                {weeklySchedule?.title || "This Week's Schedule"}
              </h2>
              <p className="mt-2 text-slate-600">
                The uploaded PDF remains the official source for all times.
              </p>
            </div>

            {weeklyPdfUrl ? (
              <div className="flex gap-3">
                <a
                  href={weeklyPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[#8b6b2e] px-5 py-3 font-semibold text-white"
                >
                  Open Full PDF
                </a>
              </div>
            ) : null}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[#e3d9c7] bg-[#f8f4eb]">
            <div className="flex items-center justify-between border-b border-[#e3d9c7] bg-[#fbf8f2] px-4 py-3">
              <p className="font-semibold text-slate-900">Schedule Preview</p>
              <p className="text-sm text-slate-500">PDF preview</p>
            </div>

            {weeklyPdfUrl ? (
              <iframe
                src={`${weeklyPdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                title="Khal Bnei Aliya weekly schedule"
                className="h-[720px] w-full bg-white"
              />
            ) : (
              <div className="flex min-h-[520px] items-center justify-center p-6 text-center">
                <div>
                  <p className="text-xl font-bold text-slate-900">
                    No PDF uploaded yet
                  </p>
                  <p className="mt-2 max-w-md text-slate-600">
                    Once the admin uploads this week&apos;s schedule, the PDF will
                    display here on the page.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
