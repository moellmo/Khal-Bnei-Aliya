"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createAndSendReceipt } from "@/lib/payments/createReceipt";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getPaymentProvider(paymentMethod: string) {
  return paymentMethod.toLowerCase() === "sola" ? "sola" : "manual";
}

function refreshMemberPages(memberId: string) {
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath(`/admin/members/${memberId}/payments`);
  revalidatePath("/admin/members");
}

export async function updateMember(memberId: string, formData: FormData) {
  const firstName = getString(formData, "first_name");
  const lastName = getString(formData, "last_name");

  if (!firstName || !lastName) {
    throw new Error("First name and last name are required.");
  }

  const { error } = await supabaseAdmin
    .from("members")
    .update({
      first_name: firstName,
      last_name: lastName,
      hebrew_name: getString(formData, "hebrew_name") || null,
      tribe_status: getString(formData, "tribe_status") || "Yisroel",
      email: getString(formData, "email") || null,
      phone: getString(formData, "phone") || null,
      address: getString(formData, "address") || null,
      membership_type: getString(formData, "membership_type") || null,
      custom_dues_amount: getNumber(formData, "custom_dues_amount"),
      status: getString(formData, "status") || "active",
      seating_location: getString(formData, "seating_location") || null,
      notes: getString(formData, "notes") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  refreshMemberPages(memberId);

  redirect(`/admin/members/${memberId}?tab=overview&memberUpdated=1`);
}

export async function addFamilyMember(
  memberId: string,
  formData: FormData
) {
  const firstName = getString(formData, "first_name");

  if (!firstName) {
    throw new Error("First name is required.");
  }

  const { error } = await supabaseAdmin
    .from("member_family_members")
    .insert({
      member_id: memberId,
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

  refreshMemberPages(memberId);

  redirect(`/admin/members/${memberId}?tab=mishaberach&familyAdded=1`);
}

export async function deleteFamilyMember(
  memberId: string,
  familyMemberId: string
) {
  const { error } = await supabaseAdmin
    .from("member_family_members")
    .delete()
    .eq("id", familyMemberId)
    .eq("member_id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  refreshMemberPages(memberId);

  redirect(`/admin/members/${memberId}?tab=mishaberach&familyDeleted=1`);
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

  refreshMemberPages(memberId);

  redirect(`/admin/members/${memberId}?tab=mishaberach&familyUpdated=1`);
}

export async function addCharge(memberId: string, formData: FormData) {
  const amount = getNumber(formData, "amount");

  if (amount <= 0) {
    throw new Error("Amount must be greater than 0.");
  }

  const dueDate = getString(formData, "due_date");
  const chargeType = getString(formData, "charge_type") || "Other";
  const description = getString(formData, "description") || null;

  const { error } = await supabaseAdmin.from("member_charges").insert({
    member_id: memberId,
    charge_type: chargeType,
    description,
    amount,
    status: "unpaid",
    due_date: dueDate || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  refreshMemberPages(memberId);

  redirect(`/admin/members/${memberId}?tab=payments&chargeAdded=1`);
}

export async function markChargePaid(
  memberId: string,
  chargeId: string,
  formData: FormData
) {
  const paidAmount = getNumber(formData, "paid_amount");
  const paymentMethod =
    getString(formData, "payment_method") || "Other";
  const paymentNote =
    getString(formData, "payment_note") || null;

  if (paidAmount <= 0) {
    throw new Error("Paid amount must be greater than 0.");
  }

  const { data: charge, error: chargeError } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, member_id, amount, status, charge_type, description"
    )
    .eq("id", chargeId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (chargeError) {
    throw new Error(chargeError.message);
  }

  if (!charge) {
    throw new Error("Charge not found.");
  }

  if (charge.status === "paid") {
    throw new Error("This charge has already been paid.");
  }

  const paidAt = new Date().toISOString();
  const paymentProvider = getPaymentProvider(paymentMethod);

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .insert({
      member_id: memberId,
      charge_id: chargeId,
      amount: paidAmount,
      payment_method: paymentMethod,
      payment_provider: paymentProvider,
      status: "paid",
      note: paymentNote,
      paid_at: paidAt,
    })
    .select("id")
    .single();

  if (paymentError || !payment) {
    throw new Error(
      paymentError?.message || "Unable to save payment."
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("member_charges")
    .update({
      status: "paid",
      paid_at: paidAt,
      payment_method: paymentMethod,
      payment_provider: paymentProvider,
      paid_amount: paidAmount,
      payment_note: paymentNote,
    })
    .eq("id", chargeId)
    .eq("member_id", memberId);

  if (updateError) {
    throw new Error(
      `Payment was saved, but the charge could not be updated: ${updateError.message}`
    );
  }

  try {
    await createAndSendReceipt({
      paymentId: payment.id,
    });
  } catch (receiptError) {
    console.error("MANUAL_PAYMENT_RECEIPT_ERROR", {
      memberId,
      chargeId,
      paymentId: payment.id,
      error: receiptError,
    });
  }

  refreshMemberPages(memberId);

  redirect(`/admin/members/${memberId}?tab=payments&chargePaid=1`);
}

export async function deleteCharge(
  memberId: string,
  chargeId: string
) {
  const { data: paymentRows, error: paymentLookupError } =
    await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("charge_id", chargeId)
      .limit(1);

  if (paymentLookupError) {
    throw new Error(paymentLookupError.message);
  }

  if (paymentRows && paymentRows.length > 0) {
    throw new Error(
      "This charge has payment history and cannot be deleted."
    );
  }

  const { error } = await supabaseAdmin
    .from("member_charges")
    .delete()
    .eq("id", chargeId)
    .eq("member_id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  refreshMemberPages(memberId);

  redirect(`/admin/members/${memberId}?tab=payments&chargeDeleted=1`);
}