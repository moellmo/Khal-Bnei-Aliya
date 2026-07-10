import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  hebrew_name: string | null;
  tribe_status: string | null;
  email: string | null;
  status: string | null;
};

async function getMembers(): Promise<Member[]> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, hebrew_name, tribe_status, email, status"
    )
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    console.error("Error loading Mishaberach members:", error.message);
    return [];
  }

  return (data || []) as Member[];
}

export default async function MishaberachCardsPage() {
  const members = await getMembers();

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

        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Member Cards</h2>

              <p className="mt-2 text-sm text-slate-500">
                {members.length} {members.length === 1 ? "member" : "members"}{" "}
                currently in the system.
              </p>
            </div>

            <Link
              href="/admin/members"
              className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold transition hover:bg-[#f2eadc]"
            >
              Manage Members
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">
                      {member.first_name} {member.last_name}
                    </p>

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
                  </div>

                  <Link
                    href={`/admin/members/${member.id}/mishaberach-card`}
                    className="shrink-0 rounded-full bg-[#1d2940] px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-[#10192b]"
                  >
                    Open Card
                  </Link>
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