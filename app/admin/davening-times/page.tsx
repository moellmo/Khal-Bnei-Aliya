import Link from "next/link";
import { saveDaveningTimes, uploadSchedulePdf } from "./actions";

type PageProps = {
  searchParams?: Promise<{
    saved?: string;
    uploaded?: string;
  }>;
};

export default async function AdminDaveningTimesPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

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
            Update regular weekday times and upload this week’s Shabbos schedule
            PDF.
          </p>
        </div>

        {params?.saved === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Regular davening times were saved successfully.
          </div>
        )}

        {params?.uploaded === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Weekly PDF and Shabbos schedule were uploaded successfully.
          </div>
        )}

        <form
          action={saveDaveningTimes}
          className="mt-8 space-y-6 rounded-[2rem] border border-[#e3d9c7] bg-white p-8 shadow-sm"
        >
          <h2 className="text-2xl font-bold">Regular Weekday Times</h2>

          <label className="block space-y-2">
            <span className="font-semibold">Schedule Title</span>
            <input
              name="title"
              className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              defaultValue="Current Shul Times"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="font-semibold">Weekday Shacharis</span>
              <input
                name="weekday_shacharis"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="7:00 AM"
              />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Sunday Shacharis</span>
              <input
                name="sunday_shacharis"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="8:00 AM"
              />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Weekday Mincha</span>
              <input
                name="mincha"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="8:00 PM"
              />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Weekday Maariv</span>
              <input
                name="maariv"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="See weekly schedule"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="font-semibold">Notes</span>
            <textarea
              name="notes"
              className="min-h-28 w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              placeholder="Special notes, changes, zmanim, etc."
            />
          </label>

          <button
            type="submit"
            className="rounded-full bg-[#8b6b2e] px-6 py-3 font-semibold text-white"
          >
            Save Regular Times
          </button>
        </form>

        <form
          action={uploadSchedulePdf}
          className="mt-8 space-y-6 rounded-[2rem] border border-[#e3d9c7] bg-white p-8 shadow-sm"
        >
          <h2 className="text-2xl font-bold">
            Upload Weekly PDF + Shabbos Times
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="font-semibold">Schedule Title</span>
              <input
                name="pdf_title"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="KBA Time Sheet - 2026.07.04"
              />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Parsha / Week Title</span>
              <input
                name="parsha"
                required
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="פרשת פינחס / Parshas Pinchas"
              />
              <p className="text-sm text-slate-500">
                This is the title shown on the homepage.
              </p>
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Effective From</span>
              <input
                name="effective_from"
                type="date"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>

            <label className="space-y-2">
              <span className="font-semibold">Effective To</span>
              <input
                name="effective_to"
                type="date"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              />
            </label>
          </div>

          <div className="rounded-2xl bg-[#f8f4eb] p-5">
            <h3 className="text-xl font-bold">Friday Times</h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="font-semibold">
                  Mincha / Kabbalas Shabbos / Maariv
                </span>
                <input
                  name="friday_mincha"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="7:10 PM"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Plag / Candle Lighting</span>
                <input
                  name="candle_lighting"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="7:55 PM"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Friday Shkia</span>
                <input
                  name="friday_shkia"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="8:31 PM"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl bg-[#f8f4eb] p-5">
            <h3 className="text-xl font-bold">Shabbos Times</h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="font-semibold">Shacharis</span>
                <input
                  name="weekly_shabbos_shacharis"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="8:50 AM"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Sof Zman Krias Shema</span>
                <input
                  name="sof_zman_shema"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="9:15 AM"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Mincha</span>
                <input
                  name="weekly_shabbos_mincha"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="7:00 PM"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Shabbos Shkia</span>
                <input
                  name="shabbos_shkia"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="8:31 PM"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Maariv</span>
                <input
                  name="weekly_shabbos_maariv"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="9:21 PM"
                />
              </label>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="font-semibold">Announcements / Notes</span>
            <textarea
              name="announcements"
              className="min-h-28 w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              placeholder="Kiddush, chabura, sponsorships, announcements..."
            />
          </label>

          <label className="block space-y-2">
            <span className="font-semibold">PDF File</span>
            <input
              name="pdf_file"
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
            Upload PDF + Publish Schedule
          </button>
        </form>
      </section>
    </main>
  );
}