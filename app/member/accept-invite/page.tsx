import { redirect } from "next/navigation";
import { acceptPortalInvitation } from "./actions";

type PageProps = {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
};

export default async function AcceptInvitePage({ searchParams }: PageProps) {
  const params = await searchParams;

  if (!params.token_hash || !params.type) {
    redirect(
      "/login?error=The%20invitation%20link%20is%20invalid%20or%20incomplete."
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
            Khal Bnei Aliya
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Accept Your Invitation
          </h1>

          <p className="mt-3 text-slate-600">
            Continue to create your member portal password.
          </p>

          <form action={acceptPortalInvitation} className="mt-7">
            <input
              type="hidden"
              name="token_hash"
              value={params.token_hash}
            />
            <input type="hidden" name="type" value={params.type} />
            <input
              type="hidden"
              name="next"
              value={params.next || "/member/set-password"}
            />

            <button
              type="submit"
              className="w-full rounded-2xl bg-[#8b6b2e] px-5 py-3.5 font-bold text-white hover:bg-[#755923]"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
