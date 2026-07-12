import Link from "next/link";
import SeatingChartEditor from "./SeatingChartEditor";

export const dynamic = "force-dynamic";

export default function SeatingChartPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <Link
            href="/admin"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            ← Admin Home
          </Link>

          <a
            href="/admin-assets/kba-seating-chart-shabbos-morning-2026-06-01.pdf"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            Open Source PDF
          </a>
        </div>

        <div className="my-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm print:bg-white print:p-0 print:text-slate-900">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a] print:text-slate-700">
            Admin
          </p>

          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Seating Chart
          </h1>

          <p className="mt-3 max-w-2xl text-slate-200 print:hidden">
            Modify the Shabbos morning seating chart and print a clean copy.
          </p>
        </div>

        <SeatingChartEditor />
      </section>
    </main>
  );
}
