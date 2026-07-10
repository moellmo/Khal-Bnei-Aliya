import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createMember } from "./actions";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  hebrew_name: string | null;
  tribe_status: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  membership_type: string | null;
  custom_dues_amount: number | null;
  status: string | null;
  seating_location: string | null;
  notes: string | null;
  created_at: string;
};

type PageProps = {
  searchParams?: Promise<{
    created?: string;
  }>;
};

async function getMembers(): Promise<Member[]> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, hebrew_name, tribe_status, email, phone, address, membership_type, custom_dues_amount, status, seating_location, notes, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading members:", error.message);
    return [];
  }

  return data || [];
}

function formatMoney(amount: number | null) {
  const value = Number(amount || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function AdminMembersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const members = await getMembers();

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin" className="text-sm font-semibold text-[#8b6b2e]">
            ← Back to Admin
          </Link>

          <Link href="/" className="text-sm font-semibold text-[#8b6b2e]">
            View Site
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-8 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-bold">Members</h1>
          <p className="mt-4 max-w-2xl text-slate-200">
            Add and manage shul members, Hebrew names, custom dues, seating, and
            account status.
          </p>
        </div>

        {params?.created === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Member was added successfully.
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <form
            action={createMember}
            className="space-y-5 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
          >
            <div>
              <h2 className="text-2xl font-bold">Add Member</h2>
              <p className="mt-1 text-sm text-slate-500">
                Start with the main member. Family, Hebrew names, and other
                Mishaberach names can be added from the member file.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">First Name</span>
                <input
                  name="first_name"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="Moshe"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Last Name / Family Name</span>
                <input
                  name="last_name"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="Moeller"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="font-semibold">Main Hebrew Name</span>
              <input
                name="hebrew_name"
                dir="rtl"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right text-lg"
                placeholder="משה בן ..."
              />
            </label>

            <label className="block space-y-2">
              <span className="font-semibold">Kohen / Levi / Yisroel</span>
              <select
                name="tribe_status"
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                defaultValue="Yisroel"
              >
                <option value="Yisroel">Yisroel</option>
                <option value="Kohen">Kohen</option>
                <option value="Levi">Levi</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="font-semibold">Email</span>
              <input
                name="email"
                type="email"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="member@example.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="font-semibold">Phone</span>
              <input
                name="phone"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="555-555-5555"
              />
            </label>

            <label className="block space-y-2">
              <span className="font-semibold">Address</span>
              <input
                name="address"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="Street, city, state, zip"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">Membership Type</span>
                <select
                  name="membership_type"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                  defaultValue="Family"
                >
                  <option value="Family">Family</option>
                  <option value="Single">Single</option>
                  <option value="Associate">Associate</option>
                  <option value="Custom">Custom</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Custom Dues Amount</span>
                <input
                  name="custom_dues_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="1200"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">Status</span>
                <select
                  name="status"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                  defaultValue="active"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Seat / Location</span>
                <input
                  name="seating_location"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="Seat 12, Row B"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="font-semibold">Notes</span>
              <textarea
                name="notes"
                className="min-h-24 w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="Admin notes..."
              />
            </label>

            <button
              type="submit"
              className="rounded-full bg-[#8b6b2e] px-6 py-3 font-semibold text-white"
            >
              Add Member
            </button>
          </form>

          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Member List</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {members.length} member{members.length === 1 ? "" : "s"}{" "}
                  currently in the system.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[1050px] border-separate border-spacing-y-3 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4">Member</th>
                    <th className="px-4">Action</th>
                    <th className="px-4">Contact</th>
                    <th className="px-4">Type</th>
                    <th className="px-4">Dues</th>
                    <th className="px-4">Status</th>
                    <th className="px-4">Seat</th>
                  </tr>
                </thead>

                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="bg-[#fbf8f2]">
                      <td className="rounded-l-2xl px-4 py-4">
                        <p className="font-bold">
                          {member.first_name} {member.last_name}
                        </p>

                        {member.hebrew_name && (
                          <p dir="rtl" className="mt-1 text-right text-sm">
                            {member.hebrew_name}
                          </p>
                        )}

                        <p className="mt-1 text-xs font-bold text-[#8b6b2e]">
                          {member.tribe_status || "Yisroel"}
                        </p>

                        {member.notes && (
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                            {member.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/members/${member.id}`}
                          className="inline-flex rounded-full bg-[#1d2940] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#10192b]"
                        >
                          View / Edit
                        </Link>
                      </td>

                      <td className="px-4 py-4">
                        <p>{member.email || "—"}</p>
                        <p className="text-xs text-slate-500">
                          {member.phone || "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        {member.membership_type || "—"}
                      </td>

                      <td className="px-4 py-4 font-bold">
                        {formatMoney(member.custom_dues_amount)}
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize text-slate-700">
                          {member.status || "pending"}
                        </span>
                      </td>

                      <td className="rounded-r-2xl px-4 py-4">
                        {member.seating_location || "—"}
                      </td>
                    </tr>
                  ))}

                  {members.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="rounded-2xl bg-[#fbf8f2] px-4 py-10 text-center text-slate-500"
                      >
                        No members added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}