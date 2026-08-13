import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { updatePassword } from "./actions";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Please%20open%20the%20password%20reset%20link%20from%20your%20email.");
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-md">
        <Link href="/login" className="text-sm font-semibold text-[#8b6b2e] hover:underline">
          ← Back to Login
        </Link>
        <div className="mt-8 rounded-[2rem] bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
            Khal Bnei Aliya
          </p>
          <h1 className="mt-2 text-3xl font-bold">Choose a New Password</h1>
          <p className="mt-3 text-slate-600">Enter a new password for your account.</p>

          {params.error ? (
            <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {params.error}
            </div>
          ) : null}

          <form action={updatePassword} className="mt-7 space-y-5">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-[#8b6b2e] focus:ring-2 focus:ring-[#8b6b2e]/20"
              />
            </div>
            <div>
              <label htmlFor="confirm_password" className="mb-2 block text-sm font-semibold">
                Confirm new password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-[#8b6b2e] focus:ring-2 focus:ring-[#8b6b2e]/20"
              />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-[#8b6b2e] px-5 py-3.5 font-bold text-white hover:bg-[#755923]">
              Save New Password
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
