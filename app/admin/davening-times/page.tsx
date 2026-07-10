import Link from "next/link";

export default function AdminDaveningTimesPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/admin" className="text-sm font-semibold text-[#8b6b2e]">
          ← Back to Admin
        </Link>

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-8 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8b6b2e]">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-bold">Update Davening Times</h1>
          <p className="mt-4 text-slate-600">
            This is the screen where admins will manually update shul times and upload the weekly PDF schedule.
          </p>
        </div>

        <form className="mt-8 space-y-6 rounded-[2rem] border border-[#e3d9c7] bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold">Manual Shul Times</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="font-semibold">Weekday Shacharis</span>
              <input className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" placeholder="7:00 AM" />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Sunday Shacharis</span>
              <input className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" placeholder="8:00 AM" />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Mincha</span>
              <input className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" placeholder="See weekly schedule" />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Maariv</span>
              <input className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" placeholder="See weekly schedule" />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Shabbos Shacharis</span>
              <input className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" placeholder="8:45 AM" />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Motzei Shabbos Maariv</span>
              <input className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" placeholder="See weekly schedule" />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="font-semibold">Notes</span>
            <textarea
              className="min-h-28 w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              placeholder="Special notes, changes, zmanim, etc."
            />
          </label>

          <button
            type="button"
            className="rounded-full bg-[#8b6b2e] px-6 py-3 font-semibold text-white"
          >
            Save Times
          </button>
        </form>

        <form className="mt-8 space-y-6 rounded-[2rem] border border-[#e3d9c7] bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold">Upload Weekly PDF</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="font-semibold">Schedule Title</span>
              <input className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" placeholder="Parshas Pinchas Schedule" />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Parsha / Week</span>
              <input className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" placeholder="Parshas Pinchas" />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Effective From</span>
              <input type="date" className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Effective To</span>
              <input type="date" className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3" />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="font-semibold">PDF File</span>
            <input type="file" accept="application/pdf" className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3" />
          </label>

          <button
            type="button"
            className="rounded-full bg-[#1d2940] px-6 py-3 font-semibold text-white"
          >
            Upload PDF
          </button>
        </form>
      </section>
    </main>
  );
}