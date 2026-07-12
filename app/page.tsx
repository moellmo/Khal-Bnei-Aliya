import Link from "next/link";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signOut } from "./member/actions";

export const dynamic = "force-dynamic";

const logoUrl = "/kba-logo.png";

type WeeklyPdf = {
  id: string;
  title: string;
  source_pdf_url: string | null;
  source_pdf_name: string | null;
  created_at: string;
};

type LegacyWeeklyPdf = {
  title: string;
  parsha: string | null;
  file_url: string;
};

type SeasonalPdf = {
  id: string;
  title: string;
  schedule_type: string;
  description: string | null;
  pdf_url: string;
};

async function getCurrentWeeklyPdf(): Promise<WeeklyPdf | null> {
  const { data, error } = await supabaseAdmin
    .from("weekly_schedules")
    .select(
      `
      id,
      title,
      source_pdf_url,
      source_pdf_name,
      created_at
      `
    )
    .eq("is_published", true)
    .not("source_pdf_url", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Unable to load weekly PDF:",
      error.message
    );

    return null;
  }

  return data as WeeklyPdf | null;
}

async function getLegacyWeeklyPdf(): Promise<LegacyWeeklyPdf | null> {
  const { data, error } = await supabaseAdmin
    .from("schedule_pdfs")
    .select("title, parsha, file_url")
    .eq("is_published", true)
    .eq("show_on_homepage", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Unable to load legacy weekly PDF:",
      error.message
    );

    return null;
  }

  return data as LegacyWeeklyPdf | null;
}

async function getSeasonalPdfs(): Promise<
  SeasonalPdf[]
> {
  const { data, error } = await supabaseAdmin
    .from("seasonal_schedules")
    .select(
      `
      id,
      title,
      schedule_type,
      description,
      pdf_url
      `
    )
    .eq("is_published", true)
    .eq("display_on_homepage", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "Unable to load seasonal PDFs:",
      error.message
    );

    return [];
  }

  return (data || []) as SeasonalPdf[];
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
      .select("portal_role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (member) {
      memberAccountLinked = true;
      portalRole =
        member.portal_role === "admin"
          ? "admin"
          : "member";
    }
  }

  const isLoggedIn = Boolean(user);
  const isAdmin = portalRole === "admin";

  const [
    weeklyPdf,
    legacyWeeklyPdf,
    seasonalPdfs,
  ] = await Promise.all([
    getCurrentWeeklyPdf(),
    getLegacyWeeklyPdf(),
    getSeasonalPdfs(),
  ]);

  const weeklyPdfUrl =
    weeklyPdf?.source_pdf_url ||
    legacyWeeklyPdf?.file_url ||
    "";

  const weeklyTitle =
    weeklyPdf?.title ||
    legacyWeeklyPdf?.parsha ||
    legacyWeeklyPdf?.title ||
    "This Week’s Schedule";

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

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-[#ddd4c2] pb-6 lg:flex-row lg:items-center lg:justify-between">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 sm:gap-4"
          >
            <img
              src={logoUrl}
              alt="Khal Bnei Aliya logo"
              className="h-16 w-auto shrink-0 rounded-xl bg-white p-2 shadow-sm sm:h-20"
            />

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#8b6b2e] sm:text-xs sm:tracking-[0.35em]">
                Khal Bnei Aliya
              </p>

              <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl md:text-3xl">
                קהל בני עליה
              </h1>

              <p className="mt-1 hidden text-sm text-slate-600 sm:block">
                A warm makom Torah, tefillah, and
                community
              </p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm font-bold sm:gap-3">
            <Link
              href="/davening-times"
              className="rounded-full bg-[#1d2940] px-4 py-2.5 text-white transition hover:bg-[#10192b] sm:px-5"
            >
              Davening Times
            </Link>

            <Link
              href="/membership"
              className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2.5 transition hover:bg-[#f2eadc] sm:px-5"
            >
              Membership
            </Link>

            <Link
              href="/donate"
              className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2.5 transition hover:bg-[#f2eadc] sm:px-5"
            >
              Donate
            </Link>

            {!isLoggedIn ? (
              <>
                <Link
                  href="/login"
                  className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2.5 transition hover:bg-[#f2eadc] sm:px-5"
                >
                  Log In
                </Link>

                <Link
                  href="/membership"
                  className="rounded-full bg-[#8b6b2e] px-4 py-2.5 text-white transition hover:bg-[#745822] sm:px-5"
                >
                  Create Account
                </Link>
              </>
            ) : (
              <>
                {memberAccountLinked && (
                  <Link
                    href="/member/dashboard"
                    className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2.5 transition hover:bg-[#f2eadc] sm:px-5"
                  >
                    Member Dashboard
                  </Link>
                )}

                {isAdmin && (
                  <Link
                    href="/admin"
                    className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2.5 transition hover:bg-[#f2eadc] sm:px-5"
                  >
                    Admin Dashboard
                  </Link>
                )}

                <form action={signOut}>
                  <button
                    type="submit"
                    className="rounded-full border border-red-200 bg-white px-4 py-2.5 text-red-700 transition hover:bg-red-50 sm:px-5"
                  >
                    Sign Out
                  </button>
                </form>
              </>
            )}
          </nav>
        </header>

        <section className="grid grid-cols-1 gap-8 py-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:py-10">
          {/* WELCOME */}
          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] sm:p-8 md:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#8b6b2e]">
              Welcome
            </p>

            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Welcome to Khal Bnei Aliya
            </h2>

            <p className="mt-6 text-base leading-8 text-slate-600 sm:text-lg">
              A welcoming kehilla dedicated to
              meaningful tefillah, growth in Torah, and
              building a strong community together.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/membership"
                className="rounded-full bg-[#8b6b2e] px-5 py-3 text-center font-bold text-white transition hover:bg-[#745822] sm:px-6"
              >
                Apply for Membership
              </Link>

              <Link
                href="/donate"
                className="rounded-full border border-[#cbbd9d] bg-white px-5 py-3 text-center font-bold transition hover:bg-[#f2eadc] sm:px-6"
              >
                Donate
              </Link>
            </div>

            <div className="mt-10 rounded-2xl bg-[#f8f4eb] p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b6b2e]">
                {isLoggedIn
                  ? "Your Online Account"
                  : "Member Portal"}
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-700">
                {isLoggedIn
                  ? isAdmin
                    ? "Access your member account, administration, billing, and accounting tools."
                    : "View your membership dues, payments, receipts, and account information."
                  : "Log in to view dues, payments, receipts, and membership information."}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
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

                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold"
                      >
                        Admin Dashboard
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {quickLinks.map((item) => (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  className="rounded-2xl bg-[#fbf8f2] p-4 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* WEEKLY PDF */}
          <div className="min-w-0 rounded-[2rem] border border-[#e3d9c7] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] sm:p-6 md:p-7">
            <div className="flex flex-col gap-4 border-b border-[#e3d9c7] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e] sm:text-sm">
                  Weekly Schedule
                </p>

                <h2 className="mt-2 break-words text-2xl font-black sm:text-3xl">
                  {weeklyTitle}
                </h2>
              </div>

              {weeklyPdfUrl && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={weeklyPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-[#1d2940] px-4 py-2.5 text-sm font-bold text-white"
                  >
                    Open PDF
                  </a>

                  <a
                    href={weeklyPdfUrl}
                    download
                    className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2.5 text-sm font-bold"
                  >
                    Download
                  </a>
                </div>
              )}
            </div>

            {weeklyPdfUrl ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-[#e3d9c7] bg-[#f8f4eb]">
                <iframe
                  src={`${weeklyPdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="hidden h-[780px] w-full bg-white md:block"
                  title="Khal Bnei Aliya Weekly Schedule"
                />

                <div className="md:hidden">
                  <a
                    href={weeklyPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                    aria-label="Open weekly schedule PDF full size"
                  >
                    <div className="relative overflow-hidden bg-white">
                      <iframe
                        src={`${weeklyPdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                        className="pointer-events-none h-[520px] w-full bg-white"
                        title="Khal Bnei Aliya Weekly Schedule Mobile Preview"
                      />

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4 pt-14 text-center">
                        <span className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-[#1d2940] shadow-lg">
                          Tap to open full size
                        </span>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-[#d8cdb7] bg-[#fbf8f2] p-8 text-center">
                <p className="text-xl font-black">
                  No weekly schedule uploaded
                </p>

                {isAdmin && (
                  <Link
                    href="/admin/davening-times"
                    className="mt-5 inline-flex rounded-full bg-[#1d2940] px-5 py-3 font-bold text-white"
                  >
                    Upload Weekly PDF
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        {seasonalPdfs.length > 0 && (
          <section className="pb-12">
            <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
                Full Schedules
              </p>

              <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                Seasonal &amp; Long-Term Schedules
              </h2>

              <p className="mt-3 max-w-2xl text-slate-600">
                View the current winter, summer, Yom
                Tov, or other long-term schedules.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {seasonalPdfs.map((pdf) => (
                  <a
                    key={pdf.id}
                    href={pdf.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
                      {pdf.schedule_type.replaceAll(
                        "_",
                        " "
                      )}
                    </p>

                    <h3 className="mt-2 text-xl font-black">
                      {pdf.title}
                    </h3>

                    {pdf.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {pdf.description}
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
    </main>
  );
}
