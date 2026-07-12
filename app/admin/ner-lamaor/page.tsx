import Link from "next/link";
import NerLamaorEditor from "./NerLamaorEditor";

export const dynamic = "force-dynamic";

export default function NerLamaorPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6">
        <div className="print:hidden">
          <Link
            href="/admin"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            ← Admin Home
          </Link>
        </div>

        <div className="my-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm print:hidden">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Admin
          </p>

          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Monthly Ner Lamaor Sign
          </h1>

          <p className="mt-3 max-w-2xl text-slate-200">
            Edit the donor name and month, then print the finished sign.
          </p>
        </div>

        <NerLamaorEditor />
      </section>
    </main>
  );
}
