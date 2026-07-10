import Link from "next/link";

const weekdayTimes = [
  { label: "Weekday Shacharis", time: "7:00 AM" },
  { label: "Sunday Shacharis", time: "8:00 AM" },
  { label: "Mincha", time: "See weekly schedule" },
  { label: "Maariv", time: "See weekly schedule" },
];

const shabbosTimes = [
  { label: "Shabbos Shacharis", time: "8:45 AM" },
  { label: "Shabbos Mincha", time: "See weekly schedule" },
  { label: "Motzei Shabbos Maariv", time: "See weekly schedule" },
];

export default function DaveningTimesPage() {
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
            Current davening times are shown below. The weekly PDF schedule will be
            available here once uploaded by the admin.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] bg-[#1d2940] p-6 text-white">
            <h2 className="text-2xl font-bold">Weekday Times</h2>
            <div className="mt-5 space-y-3">
              {weekdayTimes.map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between rounded-2xl bg-white/10 p-4"
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-[#f0d99a]">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">Shabbos Times</h2>
            <div className="mt-5 space-y-3">
              {shabbosTimes.map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between rounded-2xl bg-[#f8f4eb] p-4"
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-[#8b6b2e]">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
        Weekly PDF Schedule
      </p>
      <h2 className="mt-3 text-2xl font-bold">This Week’s Schedule</h2>
      <p className="mt-2 text-slate-600">
        The weekly shul times PDF will appear directly below once uploaded by an admin.
      </p>
    </div>

    <div className="flex gap-3">
      <a
        href="#"
        className="rounded-full bg-[#8b6b2e] px-5 py-3 font-semibold text-white"
      >
        Open Full PDF
      </a>
      <a
        href="#"
        className="rounded-full border border-[#cbbd9d] bg-white px-5 py-3 font-semibold"
      >
        Download
      </a>
    </div>
  </div>

  <div className="mt-6 overflow-hidden rounded-2xl border border-[#e3d9c7] bg-[#f8f4eb]">
    <div className="flex items-center justify-between border-b border-[#e3d9c7] bg-[#fbf8f2] px-4 py-3">
      <p className="font-semibold text-slate-900">Schedule Preview</p>
      <p className="text-sm text-slate-500">PDF preview</p>
    </div>

    <div className="flex min-h-[520px] items-center justify-center p-6 text-center">
      <div>
        <p className="text-xl font-bold text-slate-900">No PDF uploaded yet</p>
        <p className="mt-2 max-w-md text-slate-600">
          Once the admin uploads this week’s schedule, the PDF will display here on the page.
        </p>
      </div>
    </div>
  </div>
</div>
      </section>
    </main>
  );
}