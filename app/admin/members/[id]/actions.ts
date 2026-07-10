"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function addFamilyMember(memberId: string, formData: FormData) {
  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const hebrew_name = String(formData.get("hebrew_name") || "").trim();
  const relationship = String(formData.get("relationship") || "").trim();
  const tribe_status = String(formData.get("tribe_status") || "Yisroel").trim();
  const includeValue = formData.get("include_on_mishaberach_card");

  if (!first_name) {
    throw new Error("First name is required.");
  }

  const { error } = await supabaseAdmin.from("member_family_members").insert({
    member_id: memberId,
    first_name,
    last_name: last_name || null,
    hebrew_name: hebrew_name || null,
    relationship: relationship || null,
    tribe_status,
    include_on_mishaberach_card: includeValue === "on",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/members/${memberId}`);
  redirect(`/admin/members/${memberId}?familyAdded=1`);
}

export async function addCharge(memberId: string, formData: FormData) {
  const charge_type = String(formData.get("charge_type") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const due_date = String(formData.get("due_date") || "").trim();

  if (!charge_type) {
    throw new Error("Charge type is required.");
  }

  if (!amount || amount <= 0) {
    throw new Error("Amount must be greater than 0.");
  }

  const { error } = await supabaseAdmin.from("member_charges").insert({
    member_id: memberId,
    charge_type,
    description: description || null,
    amount,
    status: "unpaid",
    due_date: due_date || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/members/${memberId}`);
  redirect(`/admin/members/${memberId}?chargeAdded=1`);
}

export async function markChargePaid(memberId: string, chargeId: string) {
  const { error } = await supabaseAdmin
    .from("member_charges")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: "manual",
    })
    .eq("id", chargeId)
    .eq("member_id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/members/${memberId}`);
  redirect(`/admin/members/${memberId}?chargePaid=1`);
}

export async function deleteCharge(memberId: string, chargeId: string) {
  const { error } = await supabaseAdmin
    .from("member_charges")
    .delete()
    .eq("id", chargeId)
    .eq("member_id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/members/${memberId}`);
  redirect(`/admin/members/${memberId}?chargeDeleted=1`);
}
export async function deleteFamilyMember(memberId: string, familyMemberId: string) {
  const { error } = await supabaseAdmin
    .from("member_family_members")
    .delete()
    .eq("id", familyMemberId)
    .eq("member_id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/members/${memberId}`);
  redirect(`/admin/members/${memberId}?familyDeleted=1`);
}

export async function toggleFamilyMemberOnCard(
  memberId: string,
  familyMemberId: string,
  showOnCard: boolean
) {
  const { error } = await supabaseAdmin
    .from("member_family_members")
    .update({
      include_on_mishaberach_card: showOnCard,
    })
    .eq("id", familyMemberId)
    .eq("member_id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/members/${memberId}`);
  redirect(`/admin/members/${memberId}?familyUpdated=1`);
}

export async function updateMember(memberId: string, formData: FormData) {
  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const hebrew_name = String(formData.get("hebrew_name") || "").trim();
  const tribe_status = String(formData.get("tribe_status") || "Yisroel").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const membership_type = String(formData.get("membership_type") || "").trim();
  const custom_dues_amount = Number(formData.get("custom_dues_amount") || 0);
  const status = String(formData.get("status") || "active").trim();
  const seating_location = String(formData.get("seating_location") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!first_name || !last_name) {
    throw new Error("First name and last name are required.");
  }

  const { error } = await supabaseAdmin
    .from("members")
    .update({
      first_name,
      last_name,
      hebrew_name: hebrew_name || null,
      tribe_status,
      email: email || null,
      phone: phone || null,
      address: address || null,
      membership_type: membership_type || null,
      custom_dues_amount,
      status,
      seating_location: seating_location || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/admin/members");

  redirect(`/admin/members/${memberId}?memberUpdated=1`);
}