import Link from "next/link";
import { submitYomTovAssistanceRequest } from "./actions";
import YomTovAssistanceForm from "./YomTovAssistanceForm";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ error?: string; submitted?: string }>;
};

export default async function YomTovAssistancePage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-4xl px-5 py-8 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-[#8b6b2e] hover:underline">
          ← Back Home
        </Link>
        <div className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-10">
          {params?.submitted ? (
            <div className="rounded-2xl bg-green-50 p-6 text-green-900">
              <p className="text-xs font-bold uppercase tracking-[0.2em]">Request received</p>
              <h1 className="mt-2 text-3xl font-black">Thank you</h1>
              <p className="mt-3">Your confidential family ID number is:</p>
              <p className="mt-2 text-4xl font-black">{params.submitted}</p>
              <p className="mt-3 text-sm">Please keep this number for your records.</p>
            </div>
          ) : (
            <YomTovAssistanceForm
              action={submitYomTovAssistanceRequest}
              error={params?.error}
            />
          )}
        </div>
      </section>
    </main>
  );
}
