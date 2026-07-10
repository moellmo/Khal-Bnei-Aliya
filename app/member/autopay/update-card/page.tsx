import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import UpdateCardForm from "./UpdateCardForm";

export const dynamic = "force-dynamic";

export default async function UpdateAutopayCardPage() {
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
      .select(
        `
          id,
          first_name,
          last_name,
          status,
          portal_status,
          sola_customer_id,
          sola_recurring_id
        `
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    redirect("/member/dashboard");
  }

  if (
    member.portal_status === "disabled" ||
    member.status !== "active"
  ) {
    redirect("/member/dashboard");
  }

  if (
    !member.sola_customer_id ||
    !member.sola_recurring_id
  ) {
    redirect("/member/autopay");
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/member/autopay"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            ← Back to Automatic Payments
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
            Member Portal
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Replace Saved Card
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-slate-200">
            Update the card used for future automatic
            membership payments.
          </p>
        </section>

        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold">
            Enter Your New Card
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            This will replace the payment method used by
            your existing recurring schedule. It will not
            charge the card today.
          </p>

          <div className="mt-7">
            <UpdateCardForm
              memberName={`${member.first_name} ${member.last_name}`}
            />
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5">
          <p className="font-bold">
            Your card details remain secure
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your full card number is entered directly into
            Sola’s secure payment field and is not stored
            by the Khal Bnei Aliya website.
          </p>
        </section>
      </div>
    </main>
  );
}