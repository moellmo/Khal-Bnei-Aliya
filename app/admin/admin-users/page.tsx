import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  promoteMemberToAdmin,
  removeMemberAdminAccess,
} from "./actions";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  status: string | null;
  auth_user_id: string | null;
  portal_status: string | null;
  portal_role: string | null;
  portal_invited_at: string | null;
  portal_activated_at: string | null;
};

type PageProps = {
  searchParams: Promise<{
    promoted?: string;
    removed?: string;
    error?: string;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function portalLabel(member: Member) {
  if (!member.auth_user_id) {
    return "No login";
  }

  if (member.portal_status === "active") {
    return "Active";
  }

  if (member.portal_status === "invited") {
    return "Invited";
  }

  if (member.portal_status === "disabled") {
    return "Disabled";
  }

  return member.portal_status || "Not invited";
}

async function getCurrentAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: member, error: memberError } =
    await supabaseAdmin
      .from("members")
      .select("id, portal_role, portal_status")
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (
    !member ||
    member.portal_role !== "admin" ||
    member.portal_status === "disabled"
  ) {
    redirect("/member/dashboard");
  }

  return member;
}

async function getMembers(): Promise<Member[]> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      `
        id,
        first_name,
        last_name,
        email,
        status,
        auth_user_id,
        portal_status,
        portal_role,
        portal_invited_at,
        portal_activated_at
      `
    )
    .order("portal_role", {
      ascending: true,
    })
    .order("last_name", {
      ascending: true,
    })
    .order("first_name", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Member[];
}

export default async function AdminUsersPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const currentAdmin = await getCurrentAdmin();
  const members = await getMembers();

  const admins = members.filter(
    (member) => member.portal_role === "admin"
  );

  const regularMembers = members.filter(
    (member) => member.portal_role !== "admin"
  );

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            ← Back to Admin
          </Link>

          <Link
            href="/member/dashboard"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            Member Dashboard
          </Link>
        </div>

        <section className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d9bf7a]">
            Admin
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Admin Users
          </h1>

          <p className="mt-3 max-w-2xl text-slate-200">
            Manage who can access the admin and accounting dashboards.
          </p>
        </section>

        {params.promoted === "1" ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Member was promoted to admin.
          </div>
        ) : null}

        {params.removed === "1" ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Admin access was removed.
          </div>
        ) : null}

        {params.error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
            {params.error}
          </div>
        ) : null}

        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Current Administrators
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                These members can access the admin and accounting areas.
              </p>
            </div>

            <span className="rounded-full bg-[#f7f3ea] px-4 py-2 text-sm font-bold text-[#8b6b2e]">
              {admins.length} admins
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {admins.map((member) => {
              const isCurrentAdmin =
                member.id === currentAdmin.id;

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-lg font-bold">
                      {member.first_name} {member.last_name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {member.email || "No email"}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Portal: {portalLabel(member)}
                      {" · "}
                      Activated:{" "}
                      {formatDate(member.portal_activated_at)}
                    </p>

                    {isCurrentAdmin ? (
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8b6b2e]">
                        Your account
                      </p>
                    ) : null}
                  </div>

                  {isCurrentAdmin ? (
                    <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-500">
                      Current Admin
                    </span>
                  ) : (
                    <form
                      action={removeMemberAdminAccess.bind(
                        null,
                        member.id
                      )}
                    >
                      <button
                        type="submit"
                        className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"
                      >
                        Remove Admin Access
                      </button>
                    </form>
                  )}
                </div>
              );
            })}

            {admins.length === 0 ? (
              <p className="rounded-2xl bg-[#fbf8f2] p-6 text-center text-slate-500">
                No administrators were found.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="text-2xl font-bold">
              Promote a Member
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Only members with an active portal login can become admins.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {regularMembers.map((member) => {
              const canPromote =
                Boolean(member.auth_user_id) &&
                member.portal_status === "active";

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[#e3d9c7] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-lg font-bold">
                      {member.first_name} {member.last_name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {member.email || "No email"}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Portal: {portalLabel(member)}
                    </p>
                  </div>

                  {canPromote ? (
                    <form
                      action={promoteMemberToAdmin.bind(
                        null,
                        member.id
                      )}
                    >
                      <button
                        type="submit"
                        className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#10192b]"
                      >
                        Make Admin
                      </button>
                    </form>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500">
                      Portal must be active
                    </span>
                  )}
                </div>
              );
            })}

            {regularMembers.length === 0 ? (
              <p className="rounded-2xl bg-[#fbf8f2] p-6 text-center text-slate-500">
                All members are already administrators.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}