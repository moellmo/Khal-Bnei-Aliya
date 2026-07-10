import Link from "next/link";
import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-sm font-semibold text-[#8b6b2e] hover:underline"
        >
          ← Back Home
        </Link>

        <div className="mt-8 rounded-[2rem] bg-white p-7 shadow-sm sm:p-9">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
              Khal Bnei Aliya
            </p>

            <h1 className="mt-2 text-3xl font-bold">Member Login</h1>

            <p className="mt-3 text-slate-600">
              Sign in to view your charges, payments, and receipts.
            </p>
          </div>

          {params.error ? (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {params.error}
            </div>
          ) : null}

          {params.message ? (
            <div
              role="status"
              className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700"
            >
              {params.message}
            </div>
          ) : null}

          <form action={login} className="space-y-5">
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

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold">
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#8b6b2e] focus:ring-2 focus:ring-[#8b6b2e]/20"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-[#8b6b2e] px-5 py-3.5 font-bold text-white transition hover:bg-[#755923]"
            >
              Sign In
            </button>
          </form>

          <p className="mt-6 text-center text-sm leading-6 text-slate-500">
            Member portal access is available by invitation from the shul office.
          </p>
        </div>
      </div>
    </main>
  );
}
