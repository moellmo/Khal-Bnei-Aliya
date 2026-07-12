import Link from "next/link";

const adminLinks = [
  {
  label: "Davening Times",
  description:
    "Manage weekday, Shabbos, Yom Tov, announcements, and schedule PDFs.",
  href: "/admin/davening-times",
},
  {
    label: "Members",
    description: "Manage member records, dues, payments, and portal access.",
    href: "/admin/members",
  },
  {
    label: "Membership Applications",
    description: "Review new membership requests and approve or reject applicants.",
    href: "/admin/membership-applications",
  },
  {
    label: "Billing",
    description: "Generate dues and review member billing.",
    href: "/admin/billing",
  },
  {
    label: "Mishaberach Cards",
    description: "View and print member Mishaberach cards.",
    href: "/admin/mishaberach-cards",
  },
  {
    label: "Seating Chart",
    description: "Edit and print the Shabbos morning seating chart.",
    href: "/admin/seating-chart",
  },
  {
    label: "Ner Lamaor Signs",
    description: "Edit and print monthly Ner Lamaor dedication signs.",
    href: "/admin/ner-lamaor",
  },
  {
  label: "Recurring Schedules",
  description:
    "Link existing Sola schedules to members and review automatic-payment status.",
  href: "/admin/recurring-schedules",
},
{
  label: "Admin Users",
  description: "Manage who can access the admin and accounting dashboards.",
  href: "/admin/admin-users",
},
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            ← Back to Main Site
          </Link>

          <Link
            href="/member/dashboard"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            Member Dashboard
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Admin Portal
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Khal Bnei Aliya Admin
          </h1>

          <p className="mt-4 max-w-2xl text-slate-200">
            Manage davening times, members, dues, pledges, Mishaberach cards,
            and payments.
          </p>
        </div>

        <Link
          href="/admin/accounting"
          className="mt-6 block rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xl font-bold text-slate-900">
                Accountant Dashboard
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Review monthly billing, paid members, unpaid balances, and
                automatic-payment status.
              </p>
            </div>

            <span className="self-start rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white sm:self-center">
              Open Accounting
            </span>
          </div>
        </Link>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {adminLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="min-w-0 rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-lg font-bold">{item.label}</p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {item.description}
              </p>
            </Link>
            
          ))}
        </div>
      </section>
    </main>
  );
}
