import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  clearMishaberachPendingChanges,
  markMishaberachCardReviewed,
} from "./actions";
import { MISHABERACH_PENDING_START_AT } from "@/lib/mishaberachReview";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  hebrew_name: string | null;
  tribe_status: string | null;
  email: string | null;
  status: string | null;
  updated_at: string | null;
};

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    cleared?: string;
    reviewed?: string;
  }>;
};

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatDateTime(value: string | null) {
  if (!value) return "No changes recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isRecentChange(value: string | null) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() >= new Date(MISHABERACH_PENDING_START_AT).getTime();
}

async function getMembers(query: string): Promise<Member[]> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, hebrew_name, tribe_status, email, status, updated_at"
    )
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    console.error("Error loading Mishaberach members:", error.message);
    return [];
  }

  const members = (data || []) as Member[];
  const normalizedQuery = normalizeSearch(query);

  if (!normalizedQuery) {
    return members;
  }

  return members.filter((member) => {
    const haystack = normalizeSearch(
      [
        member.first_name,
        member.last_name,
        member.hebrew_name,
        member.email,
        member.status,
      ]
        .filter(Boolean)
        .join(" ")
    );

    return haystack.includes(normalizedQuery);
  });
}

export default async function MishaberachCardsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() || "";
  const members = await getMembers(query);
  const pendingCount = members.filter((member) =>
    isRecentChange(member.updated_at)
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            ← Back to Admin
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            Main Site
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Admin
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Mishaberach Cards
          </h1>

          <p className="mt-4 max-w-2xl text-slate-200">
            Open, review, and print the Mishaberach card for each member
            household.
          </p>
        </div>

        {params?.cleared || params?.reviewed ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
            {params?.cleared
              ? "Pending Mishaberach changes were cleared."
              : "Mishaberach card was marked reviewed."}
          </div>
        ) : null}

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Member Cards</h2>

              <p className="mt-2 text-sm text-slate-500">
                {members.length} {members.length === 1 ? "member" : "members"}{" "}
                shown. {pendingCount} pending for printing.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {pendingCount > 0 ? (
                <form action={clearMishaberachPendingChanges}>
                  <button
                    type="submit"
                    className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#10192b]"
                  >
                    Clear Pending Changes
                  </button>
                </form>
              ) : null}

              <Link
                href="/admin/members"
                className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold transition hover:bg-[#f2eadc]"
              >
                Manage Members
              </Link>
            </div>
          </div>

          <form method="GET" className="mt-6">
            <label className="block text-sm font-bold text-slate-700">
              Search cards
              <input
                name="q"
                defaultValue={query}
                className="mt-2 w-full rounded-2xl border border-[#d8cdb7] bg-white px-4 py-3 text-sm text-slate-900"
                placeholder="Search by name, Hebrew name, email, or status"
              />
            </label>
          </form>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {members.map((member) => (
              <div
                key={member.id}
                className={`rounded-2xl border p-5 ${
                  isRecentChange(member.updated_at)
                    ? "border-[#c49a3a] bg-[#fff8e6]"
                    : "border-[#e3d9c7] bg-[#fbf8f2]"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold">
                        {member.first_name} {member.last_name}
                      </p>

                      {isRecentChange(member.updated_at) ? (
                        <span className="rounded-full bg-[#8b6b2e] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">
                          Pending changes
                        </span>
                      ) : null}
                    </div>

                    {member.hebrew_name ? (
                      <p
                        dir="rtl"
                        className="mt-2 text-right text-lg text-slate-700"
                      >
                        {member.hebrew_name}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No main Hebrew name entered
                      </p>
                    )}

                    <p className="mt-2 text-sm text-slate-500">
                      {member.tribe_status || "Yisroel"}
                      {member.email ? ` · ${member.email}` : ""}
                    </p>

                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Last changed: {formatDateTime(member.updated_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <Link
                      href={`/admin/members/${member.id}/mishaberach-card`}
                      className="rounded-full bg-[#1d2940] px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[#10192b]"
                    >
                      Open Card
                    </Link>

                    {isRecentChange(member.updated_at) ? (
                      <form action={markMishaberachCardReviewed}>
                        <input
                          type="hidden"
                          name="member_id"
                          value={member.id}
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-[#f2eadc]"
                        >
                          Mark Reviewed
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {members.length === 0 ? (
              <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500 md:col-span-2">
                No members are available yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
