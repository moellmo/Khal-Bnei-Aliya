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
    q?: string;
    status?: string;
  }>;
};

async function getMembers({
  query,
  status,
}: {
  query: string;
  status: string;
}): Promise<Member[]> {
  let request = supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, hebrew_name, tribe_status, email, phone, address, membership_type, custom_dues_amount, status, seating_location, notes, created_at"
    );

  if (query) {
    const escapedQuery = query.replaceAll(",", " ");
    request = request.or(
      [
        `first_name.ilike.%${escapedQuery}%`,
        `last_name.ilike.%${escapedQuery}%`,
        `hebrew_name.ilike.%${escapedQuery}%`,
        `email.ilike.%${escapedQuery}%`,
        `phone.ilike.%${escapedQuery}%`,
        `seating_location.ilike.%${escapedQuery}%`,
      ].join(",")
    );
  }

  if (status && status !== "all") {
    request = request.eq("status", status);
  }

  const { data, error } = await request.order("last_name", {
    ascending: true,
  });

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
  const query = String(params?.q || "").trim();
  const selectedStatus = String(params?.status || "all").trim();
  const members = await getMembers({
    query,
    status: selectedStatus,
  });

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin" className="text-sm font-semibold text-[#8b6b2e]">
            ← Back to Admin
          </Link>

          <Link href="/" className="text-sm font-semibold text-[#8b6b2e]">
            View Site
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-6 text-white shadow-sm sm:p-8">
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

        <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[minmax(440px,0.95fr)_minmax(0,1.55fr)]">
          <form
            action={createMember}
            className="min-w-0 space-y-5 rounded-[1.5rem] border border-[#e3d9c7] bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-6 xl:self-start"
          >
            <div>
              <h2 className="text-2xl font-bold">Add Member</h2>
              <p className="mt-1 text-sm text-slate-500">
                Start with the main member. Family, Hebrew names, and other
                Mishaberach names can be added from the member file.
              </p>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">First Name</span>
                <input
                  name="first_name"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="Reuven"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Last Name / Family Name</span>
                <input
                  name="last_name"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="Cohen"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="font-semibold">Main Hebrew Name</span>
              <input
                name="hebrew_name"
                dir="rtl"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right text-lg"
                placeholder="ראובן בן ..."
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

            <div className="grid gap-4 2xl:grid-cols-2">
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

            <div className="grid gap-4 2xl:grid-cols-2">
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
              className="w-full rounded-full bg-[#8b6b2e] px-6 py-3.5 font-bold text-white transition hover:bg-[#745822]"
            >
              Add Member
            </button>
          </form>

          <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-[#e3d9c7] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Member List</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {members.length} member{members.length === 1 ? "" : "s"}.
                </p>
              </div>
            </div>

            <form method="GET" className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <label className="space-y-2">
                <span className="text-sm font-bold text-slate-600">
                  Search
                </span>
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Name, email, phone, Hebrew name, seat..."
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold text-slate-600">
                  Status
                </span>
                <select
                  name="status"
                  defaultValue={selectedStatus}
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="donor">Donor</option>
                </select>
              </label>

              <button
                type="submit"
                className="self-end rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white transition hover:bg-[#10192b]"
              >
                Search
              </button>
            </form>

            <div className="mt-6 space-y-3 lg:hidden">
              {members.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-base font-bold">
                        {member.first_name} {member.last_name}
                      </p>

                      {member.hebrew_name && (
                        <p dir="rtl" className="mt-1 text-right text-sm">
                          {member.hebrew_name}
                        </p>
                      )}

                      <p className="mt-1 text-xs font-bold text-[#8b6b2e]">
                        {member.membership_type || "Member"} ·{" "}
                        {member.tribe_status || "Yisroel"}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold capitalize text-slate-700">
                      {member.status || "pending"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    <p className="break-words">{member.email || "No email"}</p>
                    <p>{member.phone || "No phone"}</p>
                    <p>Seat: {member.seating_location || "—"}</p>
                    <p className="font-bold text-slate-900">
                      Dues: {formatMoney(member.custom_dues_amount)}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link
                      href={`/admin/members/${member.id}`}
                      className="rounded-full bg-[#1d2940] px-4 py-2.5 text-center text-xs font-bold text-white transition hover:bg-[#10192b]"
                    >
                      View / Edit
                    </Link>

                    <Link
                      href={`/admin/members/${member.id}?tab=payments`}
                      className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2.5 text-center text-xs font-bold text-[#1d2940] transition hover:bg-[#f2eadc]"
                    >
                      Request Payment
                    </Link>
                  </div>
                </article>
              ))}

              {members.length === 0 && (
                <div className="rounded-2xl bg-[#fbf8f2] px-4 py-10 text-center text-slate-500">
                  No members added yet.
                </div>
              )}
            </div>

            <div className="mt-6 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[920px] border-separate border-spacing-y-3 text-left text-sm">
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
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/members/${member.id}`}
                            className="inline-flex rounded-full bg-[#1d2940] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#10192b]"
                          >
                            View / Edit
                          </Link>

                          <Link
                            href={`/admin/members/${member.id}?tab=payments`}
                            className="inline-flex rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-xs font-bold text-[#1d2940] transition hover:bg-[#f2eadc]"
                          >
                            Request Payment
                          </Link>
                        </div>
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
