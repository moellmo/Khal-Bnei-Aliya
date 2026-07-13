"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendZelleReviewEmail } from "@/lib/payments/sendZelleReviewEmail";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function buildErrorRedirect(chargeId: string, message: string) {
  return `/pay/${encodeURIComponent(chargeId)}?zelleError=${encodeURIComponent(
    message
  )}`;
}

export async function submitPublicZellePaymentClaim(formData: FormData) {
  const chargeId = getString(formData, "charge_id");
  const amount = getNumber(formData, "amount");
  const payerName = getString(formData, "payer_name");
  const payerEmail = getString(formData, "payer_email").toLowerCase();
  const note = getString(formData, "note") || null;

  if (!chargeId) {
    redirect("/?paymentError=missing-charge");
  }

  if (amount <= 0) {
    redirect(buildErrorRedirect(chargeId, "Enter the Zelle amount sent."));
  }

  if (!payerName && !payerEmail) {
    redirect(
      buildErrorRedirect(
        chargeId,
        "Enter your name or email so accounting can identify the payment."
      )
    );
  }

  const { data: charge, error: chargeError } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, member_id, amount, charge_type, description, status, members(first_name, last_name, email)"
    )
    .eq("id", chargeId)
    .neq("status", "paid")
    .maybeSingle();

  if (chargeError) {
    throw new Error(chargeError.message);
  }

  if (!charge) {
    redirect(
      buildErrorRedirect(
        chargeId,
        "This charge is no longer open or could not be found."
      )
    );
  }

  const member = Array.isArray(charge.members)
    ? charge.members[0]
    : charge.members;
  const memberName = [member?.first_name, member?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName = payerName || memberName || "Payer";
  const purpose =
    charge.description || charge.charge_type || "Payment request";

  const { error } = await supabaseAdmin.from("zelle_payments").insert({
    payer_name: displayName,
    payer_email: payerEmail || member?.email || null,
    amount,
    received_date: new Date().toISOString().slice(0, 10),
    purpose,
    note: [
      `Public payment page Zelle claim for charge ${charge.id}.`,
      note,
    ]
      .filter(Boolean)
      .join(" "),
    status: "pending_review",
  });

  if (error) {
    throw new Error(error.message);
  }

  try {
    await sendZelleReviewEmail({
      memberName: memberName || displayName,
      memberEmail: payerEmail || member?.email || null,
      amount,
      purpose,
      note,
      chargeId: charge.id,
    });
  } catch (emailError) {
    console.error("PUBLIC_ZELLE_REVIEW_EMAIL_SEND_FAILED", {
      chargeId: charge.id,
      error:
        emailError instanceof Error ? emailError.message : String(emailError),
    });
  }

  revalidatePath(`/pay/${charge.id}`);
  revalidatePath("/admin/accounting");
  revalidatePath(`/admin/members/${charge.member_id}`);
  revalidatePath(`/admin/members/${charge.member_id}/payments`);

  redirect(`/pay/${charge.id}?zelleSubmitted=1`);
}
