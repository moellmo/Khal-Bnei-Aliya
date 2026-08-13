import Link from "next/link";
import { requestPasswordReset } from "./actions";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-md">
        <Link
          href="/login"
          className="text-sm font-semibold text-[#8b6b2e] hover:underline"
        >
          ← Back to Login
        </Link>

        <div className="mt-8 rounded-[2rem] bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
            Khal Bnei Aliya
          </p>
          <h1 className="mt-2 text-3xl font-bold">Reset Your Password</h1>
          <p className="mt-3 text-slate-600">
            Enter your account email and we’ll send you a secure password-reset
            link.
          </p>

          {params.error ? (
            <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {params.error}
            </div>
          ) : null}

          {params.message ? (
            <div role="status" className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {params.message}
            </div>
          ) : null}

          <form action={requestPasswordReset} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#8b6b2e] focus:ring-2 focus:ring-[#8b6b2e]/20"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-2xl bg-[#8b6b2e] px-5 py-3.5 font-bold text-white transition hover:bg-[#755923]"
            >
              Send Reset Link
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
