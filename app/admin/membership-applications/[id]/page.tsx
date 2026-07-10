import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  approveMembershipApplication,
  rejectMembershipApplication,
} from "./actions";

export const dynamic = "force-dynamic";

type FamilyMember = {
  first_name?: string;
  last_name?: string;
  hebrew_name?: string;
  relationship?: string;
  tribe_status?: string;
  include_on_mishaberach_card?: boolean;
};

type MembershipApplication = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;

  hebrew_name: string | null;
  tribe_status: string | null;

  spouse_first_name: string | null;
  spouse_last_name: string | null;
  spouse_hebrew_name: string | null;
  spouse_email: string | null;
  spouse_phone: string | null;

  membership_type: string | null;
  requested_dues_amount: number | null;
  notes: string | null;

  family_members: FamilyMember[] | null;
  agreed_to_terms: boolean;

  status: string;
  reviewed_at: string | null;
  created_member_id: string | null;

  created_at: string;
  updated_at: string;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    approved?: string;
    rejected?: string;
    alreadyApproved?: string;
  }>;
};

function formatMoney(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return "Not requested";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayValue(value: string | null | undefined) {
  return value?.trim() || "—";
}

function statusClasses(status: string) {
  if (status === "approved") {
    return "border-green-200 bg-green-50 text-green-800";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

async function getApplication(id: string) {
  const { data, error } = await supabaseAdmin
    .from("membership_applications")
    .select(
      `
        id,
        first_name,
        last_name,
        email,
        phone,
        address,
        hebrew_name,
        tribe_status,
        spouse_first_name,
        spouse_last_name,
        spouse_hebrew_name,
        spouse_email,
        spouse_phone,
        membership_type,
        requested_dues_amount,
        notes,
        family_members,
        agreed_to_terms,
        status,
        reviewed_at,
        created_member_id,
        created_at,
        updated_at
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(
      "Unable to load membership application:",
      error.message
    );

    return null;
  }

  return data as MembershipApplication | null;
}

export default async function MembershipApplicationDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const application = await getApplication(id);

  if (!application) {
    notFound();
  }

  const familyMembers = Array.isArray(application.family_members)
    ? application.family_members
    : [];

  const isPending = application.status === "pending";
  const isApproved = application.status === "approved";
  const isRejected = application.status === "rejected";

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/membership-applications"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            ← Back to Applications
          </Link>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="text-sm font-bold text-[#8b6b2e] hover:underline"
            >
              Admin Dashboard
            </Link>

            <Link
              href="/"
              className="text-sm font-bold text-[#8b6b2e] hover:underline"
            >
              Main Site
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d9bf7a]">
                Membership Application
              </p>

              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                {application.first_name} {application.last_name}
              </h1>

              <p className="mt-3 text-slate-200">
                Submitted {formatDate(application.created_at)}
              </p>
            </div>

            <span
              className={`self-start rounded-full border px-4 py-2 text-sm font-bold capitalize ${statusClasses(
                application.status
              )}`}
            >
              {application.status}
            </span>
          </div>
        </section>

        {query.approved === "1" ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Application approved. The member record was created and the
            portal invitation was sent.
          </div>
        ) : null}

        {query.rejected === "1" ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
            Application rejected.
          </div>
        ) : null}

        {query.alreadyApproved === "1" ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-800">
            This application was already approved.
          </div>
        ) : null}

        {application.created_member_id ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-green-800">
              Member account created
            </p>

            <p className="mt-2 text-sm text-slate-600">
              This application is connected to an active member record.
            </p>

            <Link
              href={`/admin/members/${application.created_member_id}`}
              className="mt-4 inline-flex rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
            >
              Open Member Record
            </Link>
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div className="space-y-8">
            <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold">
                Primary Applicant
              </h2>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <InfoItem
                  label="Full Name"
                  value={`${application.first_name} ${application.last_name}`}
                />

                <InfoItem
                  label="Email"
                  value={application.email}
                />

                <InfoItem
                  label="Phone"
                  value={displayValue(application.phone)}
                />

                <InfoItem
                  label="Kohen / Levi / Yisroel"
                  value={displayValue(application.tribe_status)}
                />
              </div>

              <div className="mt-5">
                <InfoItem
                  label="Address"
                  value={displayValue(application.address)}
                />
              </div>

              <div className="mt-5">
                <InfoItem
                  label="Hebrew Name"
                  value={displayValue(application.hebrew_name)}
                  rtl={Boolean(application.hebrew_name)}
                />
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold">
                Spouse Information
              </h2>

              {application.spouse_first_name ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <InfoItem
                    label="Full Name"
                    value={[
                      application.spouse_first_name,
                      application.spouse_last_name,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />

                  <InfoItem
                    label="Email"
                    value={displayValue(application.spouse_email)}
                  />

                  <InfoItem
                    label="Phone"
                    value={displayValue(application.spouse_phone)}
                  />

                  <InfoItem
                    label="Hebrew Name"
                    value={displayValue(
                      application.spouse_hebrew_name
                    )}
                    rtl={Boolean(application.spouse_hebrew_name)}
                  />
                </div>
              ) : (
                <p className="mt-5 rounded-2xl bg-[#fbf8f2] p-5 text-slate-500">
                  No spouse information was provided.
                </p>
              )}
            </section>

            <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Family and Mishaberach Names
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    These names will be added to the household member record
                    after approval.
                  </p>
                </div>

                <span className="rounded-full bg-[#f7f3ea] px-4 py-2 text-sm font-bold text-[#8b6b2e]">
                  {familyMembers.length}{" "}
                  {familyMembers.length === 1 ? "name" : "names"}
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {familyMembers.map((person, index) => (
                  <div
                    key={`${person.first_name}-${index}`}
                    className="rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold">
                          {[
                            person.first_name,
                            person.last_name,
                          ]
                            .filter(Boolean)
                            .join(" ") || "Unnamed family member"}
                        </p>

                        {person.hebrew_name ? (
                          <p
                            dir="rtl"
                            className="mt-2 text-right text-lg"
                          >
                            {person.hebrew_name}
                          </p>
                        ) : null}
                      </div>

                      <span className="self-start rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#8b6b2e]">
                        {person.relationship || "Other"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                      <span>
                        {person.tribe_status || "Yisroel"}
                      </span>

                      <span>
                        {person.include_on_mishaberach_card === false
                          ? "Hidden from card"
                          : "Included on card"}
                      </span>
                    </div>
                  </div>
                ))}

                {familyMembers.length === 0 ? (
                  <p className="rounded-2xl bg-[#fbf8f2] p-6 text-center text-slate-500">
                    No family members were included.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold">
                Additional Notes
              </h2>

              <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-[#fbf8f2] p-5 leading-7 text-slate-700">
                {application.notes || "No additional notes were provided."}
              </p>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">
                Membership Request
              </h2>

              <div className="mt-5 space-y-5">
                <InfoItem
                  label="Membership Type"
                  value={displayValue(application.membership_type)}
                />

                <InfoItem
                  label="Requested Dues"
                  value={formatMoney(
                    application.requested_dues_amount
                  )}
                />

                <InfoItem
                  label="Agreement Confirmed"
                  value={
                    application.agreed_to_terms ? "Yes" : "No"
                  }
                />

                <InfoItem
                  label="Reviewed"
                  value={formatDate(application.reviewed_at)}
                />
              </div>
            </section>

            {isPending ? (
              <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">
                  Review Application
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Approving creates the member and family records, then sends
                  the applicant a portal invitation.
                </p>

                <form
                  action={approveMembershipApplication.bind(
                    null,
                    application.id
                  )}
                  className="mt-6"
                >
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-green-700 px-5 py-3.5 font-bold text-white transition hover:bg-green-800"
                  >
                    Approve &amp; Create Member
                  </button>
                </form>

                <form
                  action={rejectMembershipApplication.bind(
                    null,
                    application.id
                  )}
                  className="mt-3"
                >
                  <button
                    type="submit"
                    className="w-full rounded-2xl border border-red-200 bg-white px-5 py-3.5 font-bold text-red-700 transition hover:bg-red-50"
                  >
                    Reject Application
                  </button>
                </form>
              </section>
            ) : null}

            {isApproved ? (
              <section className="rounded-[2rem] border border-green-200 bg-green-50 p-6">
                <p className="font-bold text-green-800">
                  Application Approved
                </p>

                <p className="mt-2 text-sm leading-6 text-green-700">
                  The member record has been created and linked to this
                  application.
                </p>
              </section>
            ) : null}

            {isRejected ? (
              <section className="rounded-[2rem] border border-red-200 bg-red-50 p-6">
                <p className="font-bold text-red-800">
                  Application Rejected
                </p>

                <p className="mt-2 text-sm leading-6 text-red-700">
                  This application is marked as rejected.
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoItem({
  label,
  value,
  rtl = false,
}: {
  label: string;
  value: string;
  rtl?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>

      <p
        dir={rtl ? "rtl" : undefined}
        className={`mt-2 font-semibold text-slate-900 ${
          rtl ? "text-right text-lg" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}