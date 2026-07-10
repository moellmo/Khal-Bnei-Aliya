import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addFamilyMember,
  deleteFamilyMember,
  toggleFamilyMemberOnCard,
  updateFamilyMember,
  updateMainMishaberach,
} from "./actions";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  hebrew_name: string | null;
  tribe_status: string | null;
};

type FamilyMember = {
  id: string;
  first_name: string;
  last_name: string | null;
  hebrew_name: string | null;
  relationship: string | null;
  tribe_status: string | null;
  include_on_mishaberach_card: boolean | null;
};

type PageProps = {
  searchParams: Promise<{
    mainUpdated?: string;
    familyAdded?: string;
    familyUpdated?: string;
    familyDeleted?: string;
  }>;
};

export default async function MemberMishaberachPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id, first_name, last_name, hebrew_name, tribe_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    redirect("/member/dashboard");
  }

  const { data: familyData, error: familyError } = await supabaseAdmin
    .from("member_family_members")
    .select(
      "id, first_name, last_name, hebrew_name, relationship, tribe_status, include_on_mishaberach_card"
    )
    .eq("member_id", member.id)
    .order("created_at", { ascending: true });

  if (familyError) {
    throw new Error(familyError.message);
  }

  const typedMember = member as Member;
  const familyMembers = (familyData || []) as FamilyMember[];

  const successMessage =
    params.mainUpdated === "1"
      ? "Your main Hebrew-name information was updated."
      : params.familyAdded === "1"
        ? "Family member added."
        : params.familyUpdated === "1"
          ? "Family member updated."
          : params.familyDeleted === "1"
            ? "Family member removed."
            : "";

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/member/dashboard"
            className="text-sm font-bold text-[#8b6b2e] hover:underline"
          >
            ← Back to Member Dashboard
          </Link>

          <Link
            href="/member/mishaberach/preview"
            className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
          >
            Preview Card
          </Link>
        </div>

        <section className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d9bf7a]">
            Member Portal
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Mishaberach Card
          </h1>

          <p className="mt-3 max-w-2xl text-slate-200">
            Update the Hebrew names and family members that should appear on
            your household card.
          </p>
        </section>

        {successMessage ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            {successMessage}
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-8">
            <form
              action={updateMainMishaberach}
              className="space-y-5 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
            >
              <div>
                <h2 className="text-2xl font-bold">
                  Main Member
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {typedMember.first_name} {typedMember.last_name}
                </p>
              </div>

              <label className="block space-y-2">
                <span className="font-semibold">Hebrew Name</span>

                <input
                  name="hebrew_name"
                  dir="rtl"
                  defaultValue={typedMember.hebrew_name || ""}
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right text-lg"
                  placeholder="משה בן ..."
                />
              </label>

              <label className="block space-y-2">
                <span className="font-semibold">
                  Kohen / Levi / Yisroel
                </span>

                <select
                  name="tribe_status"
                  defaultValue={typedMember.tribe_status || "Yisroel"}
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                >
                  <option value="Yisroel">Yisroel</option>
                  <option value="Kohen">Kohen</option>
                  <option value="Levi">Levi</option>
                </select>
              </label>

              <button
                type="submit"
                className="rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
              >
                Save Main Information
              </button>
            </form>

            <form
              action={addFamilyMember}
              className="space-y-5 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
            >
              <div>
                <h2 className="text-2xl font-bold">
                  Add Family Member
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Add a spouse, child, parent, guest, or other name.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="font-semibold">First Name</span>
                  <input
                    name="first_name"
                    required
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  />
                </label>

                <label className="space-y-2">
                  <span className="font-semibold">Last Name</span>
                  <input
                    name="last_name"
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="font-semibold">Hebrew Name</span>
                <input
                  name="hebrew_name"
                  dir="rtl"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right text-lg"
                  placeholder="..."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="font-semibold">Relationship</span>

                  <select
                    name="relationship"
                    defaultValue="Child"
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Child">Child</option>
                    <option value="Parent">Parent</option>
                    <option value="Guest Of">Guest Of</option>
                    <option value="Other">Other</option>
                  </select>
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

              <label className="flex items-center gap-3 rounded-xl bg-[#fbf8f2] p-4">
                <input
                  name="include_on_mishaberach_card"
                  type="checkbox"
                  defaultChecked
                  className="h-5 w-5"
                />

                <span className="font-semibold">
                  Include this name on the card
                </span>
              </label>

              <button
                type="submit"
                className="rounded-full bg-[#8b6b2e] px-6 py-3 font-bold text-white"
              >
                Add Family Member
              </button>
            </form>
          </div>

          <section className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  Family and Card Names
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Edit names or choose whether they appear on the printed card.
                </p>
              </div>

              <span className="rounded-full bg-[#f7f3ea] px-4 py-2 text-sm font-bold text-[#8b6b2e]">
                {familyMembers.length} names
              </span>
            </div>

            <div className="mt-6 space-y-5">
              {familyMembers.map((person) => (
                <form
                  key={person.id}
                  action={updateFamilyMember.bind(null, person.id)}
                  className="space-y-4 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold">
                        First Name
                      </span>

                      <input
                        name="first_name"
                        defaultValue={person.first_name}
                        required
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold">
                        Last Name
                      </span>

                      <input
                        name="last_name"
                        defaultValue={person.last_name || ""}
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                      />
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold">
                      Hebrew Name
                    </span>

                    <input
                      name="hebrew_name"
                      dir="rtl"
                      defaultValue={person.hebrew_name || ""}
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-right text-lg"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold">
                        Relationship
                      </span>

                      <select
                        name="relationship"
                        defaultValue={person.relationship || "Other"}
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                      >
                        <option value="Spouse">Spouse</option>
                        <option value="Child">Child</option>
                        <option value="Parent">Parent</option>
                        <option value="Guest Of">Guest Of</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold">
                        Kohen / Levi / Yisroel
                      </span>

                      <select
                        name="tribe_status"
                        defaultValue={person.tribe_status || "Yisroel"}
                        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                      >
                        <option value="Yisroel">Yisroel</option>
                        <option value="Kohen">Kohen</option>
                        <option value="Levi">Levi</option>
                      </select>
                    </label>
                  </div>

                  <label className="flex items-center gap-3">
                    <input
                      name="include_on_mishaberach_card"
                      type="checkbox"
                      defaultChecked={
                        Boolean(person.include_on_mishaberach_card)
                      }
                      className="h-5 w-5"
                    />

                    <span className="font-semibold">
                      Include on card
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
                    >
                      Save Changes
                    </button>

                    <button
                      formAction={toggleFamilyMemberOnCard.bind(
                        null,
                        person.id,
                        !person.include_on_mishaberach_card
                      )}
                      className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold"
                    >
                      {person.include_on_mishaberach_card
                        ? "Hide From Card"
                        : "Show On Card"}
                    </button>

                    <button
                      formAction={deleteFamilyMember.bind(null, person.id)}
                      className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </form>
              ))}

              {familyMembers.length === 0 ? (
                <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
                  No family names have been added yet.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}