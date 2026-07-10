import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Application = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  membership_type: string | null;
  status: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MembershipApplicationsPage() {
  const { data, error } = await supabaseAdmin
    .from("membership_applications")
    .select(
      `
        id,
        first_name,
        last_name,
        email,
        phone,
        membership_type,
        status,
        created_at
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const applications = (data || []) as Application[];

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="text-sm font-bold text-[#8b6b2e] hover:underline"
        >
          ← Back to Admin
        </Link>

        <section className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d9bf7a]">
            Admin
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Membership Applications
          </h1>

          <p className="mt-3 text-slate-200">
            Review, approve, or reject submitted membership requests.
          </p>
        </section>

        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-4">
            {applications.map((application) => (
              <Link
                key={application.id}
                href={`/admin/membership-applications/${application.id}`}
                className="block rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-bold">
                      {application.first_name} {application.last_name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {application.email}
                      {application.phone
                        ? ` · ${application.phone}`
                        : ""}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {application.membership_type || "Membership type not selected"}
                      {" · "}
                      Submitted {formatDate(application.created_at)}
                    </p>
                  </div>

                  <span className="self-start rounded-full bg-white px-4 py-2 text-sm font-bold capitalize text-[#8b6b2e] sm:self-center">
                    {application.status}
                  </span>
                </div>
              </Link>
            ))}

            {applications.length === 0 ? (
              <p className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
                No membership applications have been submitted.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}