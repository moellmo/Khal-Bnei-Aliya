import Link from "next/link";
import DonationForm from "./DonationForm";

type DonatePageProps = {
  searchParams?: Promise<{
    amount?: string;
    purpose?: string;
    note?: string;
    name?: string;
    email?: string;
    phone?: string;
  }>;
};

export default async function DonatePage({ searchParams }: DonatePageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold text-[#8b6b2e] hover:underline"
        >
          ← Back Home
        </Link>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
            <img
              src="/kba-logo.png"
              alt="Khal Bnei Aliya"
              className="h-20 w-auto rounded-xl bg-white p-2"
            />

            <p className="mt-8 text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
              Support the Kehilla
            </p>

            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Donate to Khal Bnei Aliya
            </h1>

            <p className="mt-4 text-base leading-7 text-slate-200">
              Make a secure donation by card without creating a member account.
              A receipt will be generated and emailed after payment.
            </p>

            <div className="mt-6 rounded-2xl bg-white/10 p-5">
              <p className="text-sm font-bold text-[#f0d99a]">
                Zelle
              </p>

              <p className="mt-2 text-xl font-black">
                khalbneialiyah@gmail.com
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-200">
                Please include your name and donation purpose in the Zelle memo.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
            <DonationForm
              initialAmount={params?.amount}
              initialPurpose={params?.purpose}
              initialNote={params?.note}
              initialName={params?.name}
              initialEmail={params?.email}
              initialPhone={params?.phone}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
