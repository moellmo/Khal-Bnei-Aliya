import Link from "next/link";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

const logoUrl = "/kba-logo.png";

type DaveningSchedule = {
  title: string;
  weekday_shacharis: string | null;
  sunday_shacharis: string | null;
  mincha: string | null;
  maariv: string | null;
  notes: string | null;
};

type SchedulePdf = {
  title: string;
  parsha: string | null;
  file_url: string;
  effective_from: string | null;
  effective_to: string | null;
  friday_mincha: string | null;
  candle_lighting: string | null;
  friday_shkia: string | null;
  shabbos_shacharis: string | null;
  sof_zman_shema: string | null;
  shabbos_mincha: string | null;
  shabbos_shkia: string | null;
  shabbos_maariv: string | null;
  announcements: string | null;
  created_at?: string | null;
};

function cleanValue(value: string | null | undefined) {
  return value?.trim() || "";
}

function isGoodParsha(value: string | null | undefined) {
  const parsha = value?.trim().toLowerCase();

  if (!parsha) return false;
  if (parsha === "this week") return false;
  if (parsha === "this week's shabbos schedule") return false;
  if (parsha === "this week’s shabbos schedule") return false;
  if (parsha === "weekly shul schedule") return false;
  if (parsha === "weekly times pdf") return false;

  return true;
}

async function getCurrentSchedule(): Promise<DaveningSchedule | null> {
  const { data, error } = await supabase
    .from("davening_schedules")
    .select("title, weekday_shacharis, sunday_shacharis, mincha, maariv, notes")
    .eq("is_published", true)
    .eq("show_on_homepage", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error loading davening schedule:", error.message);
    return null;
  }

  return data;
}

async function getCurrentPdf(): Promise<SchedulePdf | null> {
  const { data, error } = await supabase
    .from("schedule_pdfs")
    .select(
      "title, parsha, file_url, effective_from, effective_to, friday_mincha, candle_lighting, friday_shkia, shabbos_shacharis, sof_zman_shema, shabbos_mincha, shabbos_shkia, shabbos_maariv, announcements, created_at"
    )
    .eq("is_published", true)
    .eq("show_on_homepage", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error loading schedule PDF:", error.message);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const rowWithRealParsha = data.find((row) => isGoodParsha(row.parsha));
  return rowWithRealParsha || data[0];
}

const quickLinks = [
  { label: "Membership", href: "/membership" },
  { label: "Donate", href: "/donate" },
  { label: "Member Login", href: "/login" },
  { label: "Full Schedule", href: "/davening-times" },
];

export default async function Home() {
  const schedule = await getCurrentSchedule();
  const weeklyPdf = await getCurrentPdf();

  const weeklyPdfUrl = cleanValue(weeklyPdf?.file_url);

  const savedParsha = cleanValue(weeklyPdf?.parsha);
  const savedTitle = cleanValue(weeklyPdf?.title);

  const parshaTitle = isGoodParsha(savedParsha)
    ? savedParsha
    : savedTitle &&
        !savedTitle.toLowerCase().includes("weekly") &&
        !savedTitle.toLowerCase().includes("schedule") &&
        !savedTitle.toLowerCase().includes("time sheet")
      ? savedTitle
      : "This Week’s Shabbos Schedule";

  const regularTimes = [
    {
      label: "Weekday Shacharis",
      time: cleanValue(schedule?.weekday_shacharis) || "7:00 AM",
    },
    {
      label: "Sunday Shacharis",
      time: cleanValue(schedule?.sunday_shacharis) || "8:00 AM",
    },
  ];

  const optionalRegularTimes = [
    {
      label: "Weekday Mincha",
      time: cleanValue(schedule?.mincha),
    },
    {
      label: "Weekday Maariv",
      time: cleanValue(schedule?.maariv),
    },
  ].filter((item) => {
    const time = item.time.toLowerCase();
    return time && time !== "see weekly schedule";
  });

  const fridayTimes = [
    {
      label: "Mincha / Kabbalas Shabbos / Maariv",
      time: cleanValue(weeklyPdf?.friday_mincha) || "7:10 PM",
    },
    {
      label: "Plag Hamincha / Candle Lighting",
      time: cleanValue(weeklyPdf?.candle_lighting) || "7:55 PM",
    },
    {
      label: "Shkia",
      time: cleanValue(weeklyPdf?.friday_shkia) || "8:31 PM",
    },
  ];

  const shabbosTimes = [
    {
      label: "Shacharis",
      time: cleanValue(weeklyPdf?.shabbos_shacharis) || "8:50 AM",
    },
    {
      label: "Sof Zman Krias Shema",
      time: cleanValue(weeklyPdf?.sof_zman_shema) || "9:15 AM",
    },
    {
      label: "Mincha",
      time: cleanValue(weeklyPdf?.shabbos_mincha) || "7:00 PM",
    },
    {
      label: "Shkia",
      time: cleanValue(weeklyPdf?.shabbos_shkia) || "8:31 PM",
    },
    {
      label: "Maariv",
      time: cleanValue(weeklyPdf?.shabbos_maariv) || "9:21 PM",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-5 py-6 md:px-10 lg:px-12">
        <header className="flex flex-col gap-5 border-b border-[#ddd4c2] pb-6 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex items-center gap-4">
            <img
              src={logoUrl}
              alt="Khal Bnei Aliya logo"
              className="h-16 w-auto rounded-xl bg-white p-2 shadow-sm md:h-20"
            />

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#8b6b2e]">
                Khal Bnei Aliya
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                קהל בני עלייה
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                A warm makom Torah, tefillah, and community
              </p>
            </div>
          </Link>

          <nav className="flex flex-wrap gap-3 text-sm font-bold">
            <Link
              href="/davening-times"
              className="rounded-full bg-[#1d2940] px-5 py-2.5 text-white transition hover:bg-[#10192b]"
            >
              Davening Times
            </Link>
            <Link
              href="/membership"
              className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 transition hover:bg-[#f2eadc]"
            >
              Membership
            </Link>
            <Link
              href="/donate"
              className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 transition hover:bg-[#f2eadc]"
            >
              Donate
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 transition hover:bg-[#f2eadc]"
            >
              Login
            </Link>
          </nav>
        </header>

        <section
          className="grid gap-8 py-10"
          style={
            {
              gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
            } as CSSProperties
          }
        >
          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#8b6b2e]">
              Welcome
            </p>

            <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Welcome to Khal Bnei Aliya
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              A welcoming kehilla dedicated to meaningful tefillah, growth in
              Torah, and building a strong community together.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/membership"
                className="rounded-full bg-[#8b6b2e] px-6 py-3 font-bold text-white transition hover:bg-[#745822]"
              >
                Apply for Membership
              </Link>

              <Link
                href="/donate"
                className="rounded-full border border-[#cbbd9d] bg-white px-6 py-3 font-bold transition hover:bg-[#f2eadc]"
              >
                Donate
              </Link>
            </div>

            <div className="mt-10 rounded-2xl bg-[#f8f4eb] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b6b2e]">
                Member Portal Coming
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Members will soon be able to view dues, pledges, payments,
                receipts, and family Mishaberach information.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl bg-[#fbf8f2] p-4 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-[#1d2940] p-6 text-white shadow-[0_10px_30px_rgba(0,0,0,0.08)] md:p-7">
            <div className="border-b border-white/10 pb-5">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
                Shabbos Schedule
              </p>
              <h3 className="mt-2 text-3xl font-black">{parshaTitle}</h3>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#d9bf7a]">
                Regular Times
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {[...regularTimes, ...optionalRegularTimes].map((item) => (
                  <div key={item.label} className="rounded-xl bg-white/5 p-3">
                    <p className="text-xs font-semibold text-slate-300">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xl font-black text-[#f0d99a]">
                      {item.time}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#d9bf7a]">
                  Friday
                </p>

                <div className="mt-3 space-y-3">
                  {fridayTimes.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <p className="text-sm font-semibold text-slate-200">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xl font-black text-[#f0d99a]">
                        {item.time}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#d9bf7a]">
                  Shabbos
                </p>

                <div className="mt-3 space-y-3">
                  {shabbosTimes.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <span className="font-bold">{item.label}</span>
                      <span className="text-right font-black text-[#f0d99a]">
                        {item.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {weeklyPdf?.announcements && (
              <p className="mt-5 rounded-xl bg-white/5 p-4 text-sm leading-6 text-slate-300">
                {weeklyPdf.announcements}
              </p>
            )}

            {schedule?.notes && (
              <p className="mt-5 rounded-xl bg-white/5 p-4 text-sm leading-6 text-slate-300">
                {schedule.notes}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/davening-times"
                className="rounded-full bg-white px-5 py-3 font-bold text-[#1d2940] transition hover:bg-[#f5efe2]"
              >
                View Full Schedule
              </Link>

              {weeklyPdfUrl && (
                <a
                  href={weeklyPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/20 px-5 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  Open PDF
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="pb-12">
          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
                  Weekly Times PDF
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  {weeklyPdf?.title || "This Week’s Schedule"}
                </h2>

                {weeklyPdf?.parsha && (
                  <p className="mt-1 text-lg font-bold text-[#8b6b2e]">
                    {weeklyPdf.parsha}
                  </p>
                )}

                <p className="mt-2 max-w-2xl text-slate-600">
                  The full weekly schedule PDF is shown below.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {weeklyPdfUrl ? (
                  <>
                    <a
                      href={weeklyPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-[#8b6b2e] px-5 py-3 font-bold text-white"
                    >
                      Open Full PDF
                    </a>
                    <a
                      href={weeklyPdfUrl}
                      download
                      className="rounded-full border border-[#cbbd9d] bg-white px-5 py-3 font-bold"
                    >
                      Download
                    </a>
                  </>
                ) : (
                  <a
                    href="/admin/davening-times"
                    className="rounded-full bg-[#1d2940] px-5 py-3 font-bold text-white"
                  >
                    Upload PDF in Admin
                  </a>
                )}
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-[#e3d9c7] bg-[#f8f4eb]">
              {weeklyPdfUrl ? (
                <iframe
                  src={`${weeklyPdfUrl}#toolbar=0`}
                  className="h-[720px] w-full bg-white"
                  title="This Week's Khal Bnei Aliya Schedule"
                />
              ) : (
                <div className="flex min-h-[380px] items-center justify-center p-6 text-center">
                  <div>
                    <p className="text-2xl font-black text-slate-900">
                      No PDF uploaded yet
                    </p>
                    <p className="mt-3 max-w-md text-slate-600">
                      Once an admin uploads this week&apos;s schedule, the PDF
                      will display here directly on the homepage.
                    </p>
                    <a
                      href="/admin/davening-times"
                      className="mt-6 inline-block rounded-full bg-[#8b6b2e] px-5 py-3 font-bold text-white"
                    >
                      Go to Admin Upload
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}