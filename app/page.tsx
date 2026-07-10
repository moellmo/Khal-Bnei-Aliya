import Link from "next/link";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signOut } from "./member/actions";

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

type FlexibleScheduleEntry = {
  id: string;
  event_name: string;
  event_time: string | null;
  note: string | null;
  is_highlighted: boolean;
  display_order: number;
};

type FlexibleScheduleDay = {
  id: string;
  day_title: string;
  day_date: string | null;
  hebrew_day_title: string | null;
  display_order: number;
  schedule_entries: FlexibleScheduleEntry[];
};

type WeeklyAnnouncement = {
  id: string;
  announcement_type: string;
  title: string;
  body: string;
  sponsor_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  display_order: number;
};

type FlexibleWeeklySchedule = {
  id: string;
  title: string;
  hebrew_title: string | null;
  hebrew_date: string | null;
  schedule_type: string;
  start_date: string;
  end_date: string;
  subtitle: string | null;
  general_note: string | null;
  source_pdf_url: string | null;
  source_pdf_name: string | null;
  schedule_days: FlexibleScheduleDay[];
  weekly_announcements: WeeklyAnnouncement[];
};

type SeasonalSchedule = {
  id: string;
  title: string;
  schedule_type: string;
  description: string | null;
  pdf_url: string;
  pdf_name: string | null;
  effective_start_date: string | null;
  effective_end_date: string | null;
  display_order: number;
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
  const { data, error } = await supabaseAdmin
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
  const { data, error } = await supabaseAdmin
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

async function getCurrentFlexibleSchedule(): Promise<FlexibleWeeklySchedule | null> {
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
      subtitle,
      general_note,
      source_pdf_url,
      source_pdf_name,
      schedule_days (
        id,
        day_title,
        day_date,
        hebrew_day_title,
        display_order,
        schedule_entries (
          id,
          event_name,
          event_time,
          note,
          is_highlighted,
          display_order
        )
      ),
      weekly_announcements (
        id,
        announcement_type,
        title,
        body,
        sponsor_name,
        contact_name,
        contact_phone,
        contact_email,
        display_order
      )
      `
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error loading flexible weekly schedule:", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  const schedule = data as FlexibleWeeklySchedule;

  schedule.schedule_days = [...(schedule.schedule_days || [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map((day) => ({
      ...day,
      schedule_entries: [...(day.schedule_entries || [])].sort(
        (a, b) => a.display_order - b.display_order
      ),
    }));

  schedule.weekly_announcements = [
    ...(schedule.weekly_announcements || []),
  ].sort((a, b) => a.display_order - b.display_order);

  return schedule;
}

async function getSeasonalSchedules(): Promise<SeasonalSchedule[]> {
  const today = new Date().toISOString().slice(0, 10);

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
      display_order
      `
    )
    .eq("is_published", true)
    .eq("display_on_homepage", true)
    .or(`effective_start_date.is.null,effective_start_date.lte.${today}`)
    .or(`effective_end_date.is.null,effective_end_date.gte.${today}`)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading seasonal schedules:", error.message);
    return [];
  }

  return (data ?? []) as SeasonalSchedule[];
}

export default async function Home() {
    const authSupabase = await createClient();

  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  let portalRole: "member" | "admin" | null = null;
  let memberAccountLinked = false;

  if (user) {
    const { data: member } = await supabaseAdmin
      .from("members")
      .select("id, portal_role, portal_status")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (member) {
      memberAccountLinked = true;
      portalRole =
        member.portal_role === "admin" ? "admin" : "member";
    }
  }

  const isLoggedIn = Boolean(user);
  const isAdmin = portalRole === "admin";

  const quickLinks = isLoggedIn
    ? [
        {
          label: "Member Dashboard",
          href: "/member/dashboard",
        },
        ...(isAdmin
          ? [
              {
                label: "Admin Dashboard",
                href: "/admin",
              },
              {
                label: "Accounting Dashboard",
                href: "/admin/accounting",
              },
            ]
          : []),
        {
          label: "Full Schedule",
          href: "/davening-times",
        },
      ]
    : [
        {
          label: "Create Account",
          href: "/membership",
        },
        {
          label: "Member Login",
          href: "/login",
        },
        {
          label: "Donate",
          href: "/donate",
        },
        {
          label: "Full Schedule",
          href: "/davening-times",
        },
      ];
  const [schedule, weeklyPdf, flexibleSchedule, seasonalSchedules] =
  await Promise.all([
    getCurrentSchedule(),
    getCurrentPdf(),
    getCurrentFlexibleSchedule(),
    getSeasonalSchedules(),
  ]);

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

  const flexiblePdfUrl = cleanValue(
  flexibleSchedule?.source_pdf_url
);

const activeWeeklyPdfUrl =
  flexiblePdfUrl || weeklyPdfUrl;

const activeScheduleTitle =
  cleanValue(flexibleSchedule?.title) || parshaTitle;

const scheduleLabel =
  flexibleSchedule?.schedule_type === "shabbos"
    ? "Shabbos Schedule"
    : flexibleSchedule?.schedule_type === "yom_tov"
      ? "Yom Tov Schedule"
      : flexibleSchedule?.schedule_type === "yom_tov_shabbos"
        ? "Yom Tov & Shabbos Schedule"
        : flexibleSchedule?.schedule_type === "fast_day"
          ? "Special Schedule"
          : flexibleSchedule
            ? "Weekly Schedule"
            : "Shabbos Schedule";

const announcementTypeLabels: Record<string, string> = {
  kiddush: "Kiddush",
  simcha: "Simcha",
  mazel_tov: "Mazel Tov",
  ner_lamaor: "Ner Lamaor",
  shiur: "Shiur",
  sponsorship: "Sponsorship",
  general: "Announcement",
};

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

         <nav className="flex flex-wrap items-center gap-3 text-sm font-bold">
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

  {!isLoggedIn ? (
    <>
      <Link
        href="/login"
        className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 transition hover:bg-[#f2eadc]"
      >
        Log In
      </Link>

      <Link
        href="/membership"
        className="rounded-full bg-[#8b6b2e] px-5 py-2.5 text-white transition hover:bg-[#745822]"
      >
        Create Account
      </Link>
    </>
  ) : (
    <>
      {memberAccountLinked ? (
        <Link
          href="/member/dashboard"
          className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 transition hover:bg-[#f2eadc]"
        >
          Member Dashboard
        </Link>
      ) : null}

      {isAdmin ? (
        <>
          <Link
            href="/admin"
            className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 transition hover:bg-[#f2eadc]"
          >
            Admin Dashboard
          </Link>

          <Link
            href="/admin/accounting"
            className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 transition hover:bg-[#f2eadc]"
          >
            Accounting Dashboard
          </Link>
        </>
      ) : null}

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-red-700 transition hover:bg-red-50"
        >
          Sign Out
        </button>
      </form>
    </>
  )}
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
    {isLoggedIn ? "Your Online Account" : "Member Portal"}
  </p>

  <p className="mt-2 text-sm leading-6 text-slate-700">
    {isLoggedIn
      ? isAdmin
        ? "Access your member account, member administration, billing, and accounting tools."
        : "View your membership dues, pledges, payments, receipts, and account information."
      : "Log in to view dues, pledges, payments, receipts, and membership information."}
  </p>

  <div className="mt-4 flex flex-wrap gap-3">
    {!isLoggedIn ? (
      <>
        <Link
          href="/login"
          className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
        >
          Log In
        </Link>

        <Link
          href="/membership"
          className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold"
        >
          Create Account
        </Link>
      </>
    ) : (
      <>
        <Link
          href="/member/dashboard"
          className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
        >
          Member Dashboard
        </Link>

        {isAdmin ? (
          <Link
            href="/admin"
            className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold"
          >
            Admin Dashboard
          </Link>
        ) : null}
      </>
    )}
  </div>
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
      {scheduleLabel}
    </p>

    <h3 className="mt-2 text-3xl font-black">
      {activeScheduleTitle}
    </h3>

    {flexibleSchedule?.hebrew_title && (
      <p className="mt-2 text-xl font-bold text-[#f0d99a]" dir="rtl">
        {flexibleSchedule.hebrew_title}
      </p>
    )}

    {flexibleSchedule?.hebrew_date && (
      <p className="mt-1 text-sm font-semibold text-slate-300" dir="rtl">
        {flexibleSchedule.hebrew_date}
      </p>
    )}

    {flexibleSchedule?.subtitle && (
      <p className="mt-3 text-sm leading-6 text-slate-300">
        {flexibleSchedule.subtitle}
      </p>
    )}
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

  {flexibleSchedule ? (
    <div
      className={`mt-6 grid gap-5 ${
        flexibleSchedule.schedule_days.length > 1
          ? "md:grid-cols-2"
          : ""
      }`}
    >
      {flexibleSchedule.schedule_days.map((day) => (
        <section key={day.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#d9bf7a]">
              {day.day_title}
            </p>

            {day.hebrew_day_title && (
              <p className="text-sm font-bold text-[#f0d99a]" dir="rtl">
                {day.hebrew_day_title}
              </p>
            )}
          </div>

          {day.day_date && (
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              }).format(new Date(`${day.day_date}T12:00:00Z`))}
            </p>
          )}

          <div className="mt-3 space-y-3">
            {day.schedule_entries.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-xl border p-4 ${
                  entry.is_highlighted
                    ? "border-[#d9bf7a]/60 bg-[#d9bf7a]/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="font-bold">
                    {entry.event_name}
                  </span>

                  {entry.event_time && (
                    <span className="shrink-0 text-right font-black text-[#f0d99a]">
                      {entry.event_time}
                    </span>
                  )}
                </div>

                {entry.note && (
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {entry.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  ) : (
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
  )}

  {flexibleSchedule?.general_note && (
    <p className="mt-5 rounded-xl bg-white/5 p-4 text-sm leading-6 text-slate-300">
      {flexibleSchedule.general_note}
    </p>
  )}

  {!flexibleSchedule && weeklyPdf?.announcements && (
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

    {activeWeeklyPdfUrl && (
      <a
        href={activeWeeklyPdfUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-white/20 px-5 py-3 font-bold text-white transition hover:bg-white/10"
      >
        Open Weekly PDF
      </a>
    )}
  </div>
</div>
        </section>

        {flexibleSchedule &&
  flexibleSchedule.weekly_announcements.length > 0 && (
    <section className="pb-8">
      <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
          This Week at Khal Bnei Aliya
        </p>

        <h2 className="mt-3 text-3xl font-black">
          Announcements &amp; Simchas
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {flexibleSchedule.weekly_announcements.map(
            (announcement) => (
              <article
                key={announcement.id}
                className="rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
                  {announcementTypeLabels[
                    announcement.announcement_type
                  ] || "Announcement"}
                </p>

                <h3 className="mt-2 text-xl font-black">
                  {announcement.title}
                </h3>

                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                  {announcement.body}
                </p>

                {announcement.sponsor_name && (
                  <p className="mt-3 text-sm font-bold text-[#755a25]">
                    Sponsor: {announcement.sponsor_name}
                  </p>
                )}

                {(announcement.contact_name ||
                  announcement.contact_phone ||
                  announcement.contact_email) && (
                  <div className="mt-4 border-t border-[#e3d9c7] pt-4 text-sm text-slate-600">
                    {announcement.contact_name && (
                      <p>{announcement.contact_name}</p>
                    )}

                    {announcement.contact_phone && (
                      <p>
                        <a
                          href={`tel:${announcement.contact_phone.replace(
                            /[^\d+]/g,
                            ""
                          )}`}
                          className="font-semibold text-[#8b6b2e]"
                        >
                          {announcement.contact_phone}
                        </a>
                      </p>
                    )}

                    {announcement.contact_email && (
                      <p>
                        <a
                          href={`mailto:${announcement.contact_email}`}
                          className="font-semibold text-[#8b6b2e]"
                        >
                          {announcement.contact_email}
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </article>
            )
          )}
        </div>
      </div>
    </section>
  )}

        <section className="pb-12">
          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
                  Weekly Times PDF
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  {flexibleSchedule?.title ||
  weeklyPdf?.title ||
  "This Week’s Schedule"}
                </h2>

                {flexibleSchedule?.hebrew_title ? (
  <p
    className="mt-1 text-lg font-bold text-[#8b6b2e]"
    dir="rtl"
  >
    {flexibleSchedule.hebrew_title}
  </p>
) : weeklyPdf?.parsha ? (
  <p className="mt-1 text-lg font-bold text-[#8b6b2e]">
    {weeklyPdf.parsha}
  </p>
) : null}

                <p className="mt-2 max-w-2xl text-slate-600">
                  The full weekly schedule PDF is shown below.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {activeWeeklyPdfUrl ? (
                  <>
                    <a
                      href={activeWeeklyPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-[#8b6b2e] px-5 py-3 font-bold text-white"
                    >
                      Open Full PDF
                    </a>
                    <a
                      href={activeWeeklyPdfUrl}
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
              {activeWeeklyPdfUrl? (
                <iframe
  src={`${activeWeeklyPdfUrl}#toolbar=0`}
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
          {seasonalSchedules.length > 0 && (
  <section className="pb-12">
    <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
        Full Schedules
      </p>

      <h2 className="mt-3 text-3xl font-black">
        Seasonal &amp; Long-Term Schedules
      </h2>

      <p className="mt-3 max-w-2xl text-slate-600">
        View the current winter, summer, Yom Tov, or other
        long-term schedules.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {seasonalSchedules.map((seasonalSchedule) => (
          <a
            key={seasonalSchedule.id}
            href={seasonalSchedule.pdf_url}
            target="_blank"
            rel="noreferrer"
            className="group rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
              {seasonalSchedule.schedule_type.replaceAll(
                "_",
                " "
              )}
            </p>

            <h3 className="mt-2 text-xl font-black">
              {seasonalSchedule.title}
            </h3>

            {seasonalSchedule.description && (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {seasonalSchedule.description}
              </p>
            )}

            <span className="mt-4 inline-flex rounded-full bg-[#1d2940] px-4 py-2 text-sm font-bold text-white">
              Open PDF
            </span>
          </a>
        ))}
      </div>
    </div>
  </section>
)}
        </section>
      </section>
    </main>
  );
}