import Link from "next/link";
import { createQuickCharge } from "./actions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PageProps = {
  searchParams?: Promise<{
    quickChargeCreated?: string;
    quickChargeError?: string;
  }>;
};

type MemberOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

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
{
  label: "Email Test",
  description: "Send a Resend test email using the live receipt sender.",
  href: "/admin/email-test",
},
];

export default async function AdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const { data: members, error: membersError } = await supabaseAdmin
    .from("members")
    .select("id, first_name, last_name, email")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  const memberOptions = (members || []) as MemberOption[];

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

        <div className="mt-6 rounded-[1.5rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xl font-bold text-slate-900">
                Quick One-Time Charge
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Create a Mishaberach, pledge, aliyah, or sponsorship charge and
                send the member a payment request.
              </p>
            </div>

            {params?.quickChargeCreated ? (
              <p className="rounded-full bg-green-50 px-4 py-2 text-xs font-bold text-green-800">
                Charge created
              </p>
            ) : null}
          </div>

          {params?.quickChargeError ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
              {params.quickChargeError}
            </p>
          ) : null}

          {membersError ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
              Members could not be loaded.
            </p>
          ) : (
            <form
              action={createQuickCharge}
              className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.9fr_0.7fr_1.5fr_0.8fr_auto]"
            >
              <label className="space-y-2 text-sm font-bold text-slate-700">
                Member
                <select
                  name="member_id"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-3 text-sm text-slate-900"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select member
                  </option>
                  {memberOptions.map((member) => {
                    const name = [member.first_name, member.last_name]
                      .filter(Boolean)
                      .join(" ")
                      .trim();

                    return (
                      <option key={member.id} value={member.id}>
                        {name || member.email || "Unnamed member"}
                        {member.email ? ` - ${member.email}` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="space-y-2 text-sm font-bold text-slate-700">
                Type
                <select
                  name="charge_type"
                  defaultValue="Mishaberach"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-3 text-sm text-slate-900"
                >
                  <option>Mishaberach</option>
                  <option>Pledge</option>
                  <option>Aliyah Pledge</option>
                  <option>Sponsorship</option>
                  <option>Donation</option>
                  <option>Other</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-bold text-slate-700">
                Amount
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3 text-sm text-slate-900"
                  placeholder="18"
                />
              </label>

              <label className="space-y-2 text-sm font-bold text-slate-700">
                Description
                <input
                  name="description"
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3 text-sm text-slate-900"
                  placeholder="Refuah sheleimah, pledge note..."
                />
              </label>

              <label className="space-y-2 text-sm font-bold text-slate-700">
                Due Date
                <input
                  name="due_date"
                  type="date"
                  defaultValue={today}
                  className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3 text-sm text-slate-900"
                />
              </label>

              <button
                type="submit"
                className="self-end rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
              >
                Create
              </button>
            </form>
          )}
        </div>

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
