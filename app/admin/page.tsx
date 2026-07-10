import Link from "next/link";

const adminLinks = [
  { label: "Davening Times", href: "/admin/davening-times" },
  { label: "Members", href: "/admin/members" },
  { label: "Billing", href: "/admin/billing" },
  { label: "Mishaberach Cards", href: "/admin/mishaberach-cards" },
  { label: "Seating", href: "/admin/seating" },
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/" className="text-sm font-semibold text-[#8b6b2e]">
          ← Back Home
        </Link>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-8 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Admin Portal
          </p>
          <h1 className="mt-3 text-4xl font-bold">Khal Bnei Aliya Admin</h1>
          <p className="mt-4 max-w-2xl text-slate-200">
            Manage davening times, members, dues, pledges, seating, and payments.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {adminLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-[#e3d9c7] bg-white p-6 font-bold shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}