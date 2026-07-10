import Link from "next/link";

const logoUrl =
  "https://lh3.googleusercontent.com/sitesv/AA5AbUBOBiJ3ZyHEQsgQeS5AnlHZG6UC7SiEm3dlp3kYOvxEZ3N7_OGZCzaoVfDUtrPonoq7ZPnpK_8vDrkXESrXi5HPm_reVBRY_l0PYxLMrYoa-uFOb3fsypEma8Eo8ubrpN3MFfSSMBs1sifxdtfHZlnin6ql7pTbsF35QCxICEtSUYKxxUqPYGzhqoN2hZb-27RwliyE1vTUbDSQ1b0dGM61Yg6mZUcFp-utkHUH=w1280";

/*
  Later this will come from Supabase after admin uploads the weekly PDF.
  For now leave it blank.
  When we have a real uploaded PDF URL, set it here or pull it from database.
*/
const weeklyPdfUrl = "";

const todayTimes = [
  { label: "Shacharis", time: "7:00 AM" },
  { label: "Mincha", time: "See weekly schedule" },
  { label: "Maariv", time: "See weekly schedule" },
];

const quickLinks = [
  { label: "Membership", href: "/membership" },
  { label: "Donate", href: "/donate" },
  { label: "Member Login", href: "/login" },
  { label: "Zmanim & Times", href: "/davening-times" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-5 py-6 md:px-10 lg:px-12">
        {/* Header */}
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

        {/* Hero */}
        <section className="grid gap-8 py-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#8b6b2e]">
              Welcome
            </p>

            <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
              Welcome to Khal Bnei Aliya
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              A welcoming kehilla dedicated to meaningful tefillah, growth in
              Torah, and building a strong community together.
            </p>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Members will soon be able to access their portal, view dues and
              pledges, pay balances, and keep their family Mishaberach
              information updated.
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

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f8f4eb] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b6b2e]">
                  Tefillah
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Current shul times and weekly schedule updates.
                </p>
              </div>

              <div className="rounded-2xl bg-[#f8f4eb] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b6b2e]">
                  Members
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Portal for dues, pledges, payments, and receipts.
                </p>
              </div>

              <div className="rounded-2xl bg-[#f8f4eb] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b6b2e]">
                  Kehilla
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Built for the needs of the shul and its families.
                </p>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="rounded-[2rem] bg-[#1d2940] p-6 text-white shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
                    Today&apos;s Times
                  </p>
                  <h3 className="mt-2 text-2xl font-black">
                    Davening Schedule
                  </h3>
                </div>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#f0d99a]">
                  Updated weekly
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {todayTimes.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <span className="font-bold">{item.label}</span>
                    <span className="text-right font-semibold text-[#f0d99a]">
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300">
                These times will later be pulled from the admin schedule or
                extracted from the uploaded weekly PDF.
              </p>

              <Link
                href="/davening-times"
                className="mt-5 inline-block rounded-full bg-white px-5 py-3 font-bold text-[#1d2940] transition hover:bg-[#f5efe2]"
              >
                View Full Schedule
              </Link>
            </div>

            <div className="rounded-[2rem] border border-[#e3d9c7] bg-[#fbf8f2] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
                Quick Access
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PDF schedule section */}
        <section className="pb-12">
          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
                  This Week&apos;s Schedule
                </p>
                <h2 className="mt-3 text-3xl font-black">
                  Weekly Shul Times PDF
                </h2>
                <p className="mt-2 max-w-2xl text-slate-600">
                  The weekly PDF schedule will show directly on the homepage.
                  Later, the site can also read the PDF and display the main
                  times above automatically.
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
                  <Link
                    href="/admin/davening-times"
                    className="rounded-full bg-[#1d2940] px-5 py-3 font-bold text-white"
                  >
                    Upload PDF in Admin
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-[#e3d9c7] bg-[#f8f4eb]">
              <div className="flex items-center justify-between border-b border-[#e3d9c7] bg-[#fbf8f2] px-4 py-3">
                <p className="font-bold text-slate-900">Schedule Preview</p>
                <p className="text-sm text-slate-500">PDF shown on page</p>
              </div>

              {weeklyPdfUrl ? (
                <iframe
                  src={weeklyPdfUrl}
                  className="h-[720px] w-full bg-white"
                  title="This Week's Khal Bnei Aliya Schedule"
                />
              ) : (
                <div className="flex min-h-[420px] items-center justify-center p-6 text-center">
                  <div>
                    <p className="text-2xl font-black text-slate-900">
                      No PDF uploaded yet
                    </p>
                    <p className="mt-3 max-w-md text-slate-600">
                      Once an admin uploads this week&apos;s schedule, the PDF
                      will display here directly on the homepage.
                    </p>
                    <Link
                      href="/admin/davening-times"
                      className="mt-6 inline-block rounded-full bg-[#8b6b2e] px-5 py-3 font-bold text-white"
                    >
                      Go to Admin Upload
                    </Link>
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