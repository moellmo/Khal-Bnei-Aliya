import Link from "next/link";
import { sendTestEmail } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    sent?: string;
    recipient?: string;
    error?: string;
  }>;
};

export default async function EmailTestPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const fromEmail =
    process.env.RECEIPT_FROM_EMAIL ||
    process.env.PAYMENT_ALERT_FROM_EMAIL ||
    process.env.MEMBERSHIP_FROM_EMAIL ||
    "Not configured";

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-3xl px-5 py-8 sm:px-6">
        <Link
          href="/admin"
          className="text-sm font-semibold text-[#8b6b2e] hover:underline"
        >
          ← Admin Home
        </Link>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Admin
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Email Test
          </h1>
          <p className="mt-4 text-slate-200">
            Send a test through Resend using the same sender used for receipts.
          </p>
        </div>

        {query?.sent === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Test email sent to {query.recipient || "the recipient"}.
          </div>
        )}

        {query?.error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
            {query.error}
          </div>
        )}

        <form
          action={sendTestEmail}
          className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
        >
          <div className="rounded-2xl bg-[#fbf8f2] p-4 text-sm">
            <p className="font-bold text-slate-700">Current sender</p>
            <p className="mt-1 break-words text-slate-600">{fromEmail}</p>
          </div>

          <label className="mt-5 block space-y-2">
            <span className="font-semibold">Send Test To</span>
            <input
              name="recipient"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
            />
          </label>

          <button
            type="submit"
            className="mt-6 rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
          >
            Send Test Email
          </button>
        </form>
      </section>
    </main>
  );
}
