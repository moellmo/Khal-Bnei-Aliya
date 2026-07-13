"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createAndSendReceipt } from "@/lib/payments/createReceipt";
import { sendPaymentRequestEmail } from "@/lib/payments/sendPaymentRequestEmail";
import { headers } from "next/headers";
import { sendPortalInvitationEmail } from "@/lib/members/sendPortalInvitationEmail";

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

function memberDisplayName(member: {
  first_name: string | null;
  last_name: string | null;
}) {
  return [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
}

function refreshMemberPages(memberId: string) {
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath(`/admin/members/${memberId}/payments`);
  revalidatePath("/admin/members");
  revalidatePath("/admin/mishaberach-cards");
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
      sola_customer_id:
  getString(formData, "sola_customer_id") || null,

sola_recurring_id:
  getString(formData, "sola_recurring_id") || null,

autopay_active:
  formData.get("autopay_active") === "on",

recurring_amount:
  getNumber(formData, "recurring_amount"),

recurring_status:
  getString(formData, "recurring_status") || null,

next_billing_date:
  getString(formData, "next_billing_date") || null,
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

  await supabaseAdmin
    .from("members")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", memberId);

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

  await supabaseAdmin
    .from("members")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", memberId);

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

  await supabaseAdmin
    .from("members")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", memberId);

  refreshMemberPages(memberId);

  redirect(`/admin/members/${memberId}?tab=mishaberach&familyUpdated=1`);
}

export async function addCharge(memberId: string, formData: FormData) {
  const amount = getNumber(formData, "amount");
  const dueDate = getString(formData, "due_date");
  const chargeType = getString(formData, "charge_type") || "Other";
  const rawDescription = getString(formData, "description") || null;
  const guestName = getString(formData, "guest_name");
  const guestOfMember = formData.get("guest_of_member") === "on";
  const isOpenAmount =
    formData.get("open_amount") === "on" ||
    chargeType.toLowerCase() === "matana";

  if (!isOpenAmount && amount <= 0) {
    throw new Error("Amount must be greater than 0.");
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("first_name, last_name, email")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    console.error("PAYMENT_REQUEST_MEMBER_LOOKUP_ERROR", {
      memberId,
      error: memberError.message,
    });
  }

  const hostName = member ? memberDisplayName(member) : "this member";
  const description =
    guestOfMember && guestName
      ? rawDescription
        ? `${rawDescription} (Guest of ${hostName}: ${guestName})`
        : `Guest of ${hostName}: ${guestName}`
      : rawDescription;

  const { data: charge, error } = await supabaseAdmin
    .from("member_charges")
    .insert({
      member_id: memberId,
      charge_type: chargeType,
      description,
      amount: isOpenAmount ? 0 : amount,
      status: "unpaid",
      due_date: dueDate || null,
      payment_note: isOpenAmount
        ? "Open amount: member chooses amount when paying"
        : guestOfMember && guestName
        ? `Guest charge: ${guestName}`
        : null,
    })
    .select("id")
    .single();

  if (error || !charge) {
    throw new Error(error?.message || "Unable to save charge.");
  }

  if (member?.email) {
    try {
      await sendPaymentRequestEmail({
        recipient: member.email,
        memberFirstName: member.first_name || "Member",
        amount,
        chargeType,
        description,
        chargeId: charge.id,
        isOpenAmount,
      });
    } catch (emailError) {
      console.error("PAYMENT_REQUEST_EMAIL_ERROR", {
        memberId,
        chargeId: charge.id,
        error: emailError,
      });
    }
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
export async function inviteMemberToPortal(memberId: string) {
  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id, first_name, last_name, email, auth_user_id, portal_status")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error("Member not found.");
  }

  const email = String(member.email || "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect(
      `/admin/members/${memberId}?tab=overview&portalError=${encodeURIComponent(
        "Add an email address before inviting this member."
      )}`
    );
  }

  const headerStore = await headers();
  const inviteResult = await sendPortalInvitationEmail({
    memberId,
    email,
    firstName: member.first_name,
    lastName: member.last_name,
    requestOrigin: headerStore.get("origin"),
  });

  if (!inviteResult.sent || !inviteResult.userId) {
    redirect(
      `/admin/members/${memberId}?tab=overview&portalError=${encodeURIComponent(
        inviteResult.error || "Unable to send portal invitation."
      )}`
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("members")
    .update({
      auth_user_id: inviteResult.userId,
      portal_status: "invited",
      portal_invited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  refreshMemberPages(memberId);

  redirect(
    `/admin/members/${memberId}?tab=overview&portalInvited=1`
  );
}
