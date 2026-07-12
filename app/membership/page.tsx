import Link from "next/link";
import { submitMembershipApplication } from "./actions";

type PageProps = {
  searchParams: Promise<{
    submitted?: string;
    error?: string;
  }>;
};

export default async function MembershipPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  if (params.submitted === "1") {
    return (
      <main className="min-h-screen bg-[#f7f3ea] px-5 py-10 text-slate-900">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            ← Back to Main Site
          </Link>

          <div className="mt-8 rounded-[2rem] border border-green-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-800">
              ✓
            </div>

            <h1 className="mt-6 text-3xl font-bold">
              Application Submitted
            </h1>

            <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-600">
              Thank you for applying for membership at Khal Bnei Aliya.
              Your application has been sent to the shul administration
              for review.
            </p>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
              After approval, you will receive an invitation to create your
              member portal password.
            </p>

            <Link
              href="/"
              className="mt-7 inline-flex rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
            >
              Return Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            ← Back to Main Site
          </Link>

          <Link
            href="/login"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            Already a member? Log in
          </Link>
        </div>

        <section className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-9">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d9bf7a]">
            Khal Bnei Aliya
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Membership Application
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-slate-200">
            Complete the application below. After review and approval,
            the shul office will create your member account and send your
            portal invitation.
          </p>
        </section>

        {params.error ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800"
          >
            {params.error}
          </div>
        ) : null}

        <form
          action={submitMembershipApplication}
          className="mt-8 space-y-8"
        >
          <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">
              Primary Applicant
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">First Name *</span>
                <input
                  name="first_name"
                  required
                  autoComplete="given-name"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Last Name *</span>
                <input
                  name="last_name"
                  required
                  autoComplete="family-name"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Email *</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Phone</span>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="font-semibold">Home Address</span>
              <input
                name="address"
                autoComplete="street-address"
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="Street, city, state, ZIP code"
              />
            </label>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">Hebrew Name</span>
                <input
                  name="hebrew_name"
                  dir="rtl"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right text-lg"
                  placeholder="ראובן בן ..."
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">
                  Kohen / Levi / Yisroel
                </span>

                <select
                  name="tribe_status"
                  defaultValue="Yisroel"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                >
                  <option value="Yisroel">Yisroel</option>
                  <option value="Kohen">Kohen</option>
                  <option value="Levi">Levi</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">
              Spouse Information
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Leave this section blank when it does not apply.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">First Name</span>
                <input
                  name="spouse_first_name"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Last Name</span>
                <input
                  name="spouse_last_name"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Email</span>
                <input
                  name="spouse_email"
                  type="email"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Phone</span>
                <input
                  name="spouse_phone"
                  type="tel"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">Hebrew Name</span>
                <input
                  name="spouse_hebrew_name"
                  dir="rtl"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right text-lg"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">
                  Kohen / Levi / Yisroel
                </span>

                <select
                  name="spouse_tribe_status"
                  defaultValue="Yisroel"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                >
                  <option value="Yisroel">Yisroel</option>
                  <option value="Kohen">Kohen</option>
                  <option value="Levi">Levi</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">
              Membership and Family
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="font-semibold">
                  Membership Type
                </span>

                <select
                  name="membership_type"
                  defaultValue="Family"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                >
                  <option value="Family">Family</option>
                  <option value="Single">Single</option>
                  <option value="Associate">Associate</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="font-semibold">
                  Requested Dues Amount
                </span>

                <input
                  name="requested_dues_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="Optional"
                />
              </label>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="font-semibold">
                Children and Other Family Members
              </span>

              <textarea
                name="family_members"
                rows={7}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder={`Enter one person per line using:\nFirst Name | Last Name | Hebrew Name | Relationship\n\nExample:\nSarah | Cohen | שרה בת ראובן | Child`}
              />

              <span className="block text-xs leading-5 text-slate-500">
                Use one line per person. Separate each field using the
                vertical line character: |
              </span>
            </label>

            <label className="mt-5 block space-y-2">
              <span className="font-semibold">
                Additional Information
              </span>

              <textarea
                name="notes"
                rows={5}
                className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                placeholder="Please share any additional membership, billing, or family information."
              />
            </label>
          </section>

          <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
            <label className="flex items-start gap-3">
              <input
                name="agreed_to_terms"
                type="checkbox"
                required
                className="mt-1 h-5 w-5"
              />

              <span className="text-sm leading-6 text-slate-700">
                I confirm that the information provided is accurate and
                understand that membership is subject to review and approval
                by Khal Bnei Aliya.
              </span>
            </label>

            <button
              type="submit"
              className="mt-6 w-full rounded-2xl bg-[#8b6b2e] px-6 py-4 text-lg font-bold text-white transition hover:bg-[#745822] sm:w-auto"
            >
              Submit Membership Application
            </button>
          </section>
        </form>
      </div>
    </main>
  );
}
