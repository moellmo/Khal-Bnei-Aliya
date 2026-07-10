"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function getSignedInMember() {
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
    .select("id, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error("Your login is not linked to a member account.");
  }

  if (member.portal_status === "disabled") {
    throw new Error("Member portal access is disabled.");
  }

  return member;
}

function refreshMishaberachPages() {
  revalidatePath("/member/dashboard");
  revalidatePath("/member/mishaberach");
  revalidatePath("/member/mishaberach/preview");
}

export async function updateMainMishaberach(formData: FormData) {
  const member = await getSignedInMember();

  const { error } = await supabaseAdmin
    .from("members")
    .update({
      hebrew_name: getString(formData, "hebrew_name") || null,
      tribe_status: getString(formData, "tribe_status") || "Yisroel",
      updated_at: new Date().toISOString(),
    })
    .eq("id", member.id);

  if (error) {
    throw new Error(error.message);
  }

  refreshMishaberachPages();

  redirect("/member/mishaberach?mainUpdated=1");
}

export async function addFamilyMember(formData: FormData) {
  const member = await getSignedInMember();

  const firstName = getString(formData, "first_name");

  if (!firstName) {
    throw new Error("First name is required.");
  }

  const { error } = await supabaseAdmin
    .from("member_family_members")
    .insert({
      member_id: member.id,
      first_name: firstName,
      last_name: getString(formData, "last_name") || null,
      hebrew_name: getString(formData, "hebrew_name") || null,
      relationship: getString(formData, "relationship") || "Other",
      tribe_status: getString(formData, "tribe_status") || "Yisroel",
      include_on_mishaberach_card:
        formData.get("include_on_mishaberach_card") === "on",
    });

  if (error) {
    throw new Error(error.message);
  }

  refreshMishaberachPages();

  redirect("/member/mishaberach?familyAdded=1");
}

export async function updateFamilyMember(
  familyMemberId: string,
  formData: FormData
) {
  const member = await getSignedInMember();

  const firstName = getString(formData, "first_name");

  if (!firstName) {
    throw new Error("First name is required.");
  }

  const { error } = await supabaseAdmin
    .from("member_family_members")
    .update({
      first_name: firstName,
      last_name: getString(formData, "last_name") || null,
      hebrew_name: getString(formData, "hebrew_name") || null,
      relationship: getString(formData, "relationship") || "Other",
      tribe_status: getString(formData, "tribe_status") || "Yisroel",
      include_on_mishaberach_card:
        formData.get("include_on_mishaberach_card") === "on",
    })
    .eq("id", familyMemberId)
    .eq("member_id", member.id);

  if (error) {
    throw new Error(error.message);
  }

  refreshMishaberachPages();

  redirect("/member/mishaberach?familyUpdated=1");
}

export async function deleteFamilyMember(familyMemberId: string) {
  const member = await getSignedInMember();

  const { error } = await supabaseAdmin
    .from("member_family_members")
    .delete()
    .eq("id", familyMemberId)
    .eq("member_id", member.id);

  if (error) {
    throw new Error(error.message);
  }

  refreshMishaberachPages();

  redirect("/member/mishaberach?familyDeleted=1");
}

export async function toggleFamilyMemberOnCard(
  familyMemberId: string,
  showOnCard: boolean
) {
  const member = await getSignedInMember();

  const { error } = await supabaseAdmin
    .from("member_family_members")
    .update({
      include_on_mishaberach_card: showOnCard,
    })
    .eq("id", familyMemberId)
    .eq("member_id", member.id);

  if (error) {
    throw new Error(error.message);
  }

  refreshMishaberachPages();

  redirect("/member/mishaberach?familyUpdated=1");
}