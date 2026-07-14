"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function toPaidAt(date: string | null | undefined) {
  return date ? `${date}T12:00:00.000Z` : new Date().toISOString();
}

async function getEditablePayment(paymentId: string, memberId: string) {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("id, member_id, charge_id, payment_provider, payment_method")
    .eq("id", paymentId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (error || !payment) {
    throw new Error(error?.message || "Payment not found.");
  }

  if (payment.payment_provider === "sola") {
    throw new Error("Online Sola payments are read-only here.");
  }

  return payment as {
    id: string;
    member_id: string;
    charge_id: string | null;
    payment_provider: string | null;
    payment_method: string | null;
  };
}

export async function updateManualPayment(formData: FormData) {
  const memberId = getString(formData, "member_id");
  const paymentId = getString(formData, "payment_id");
  const chargeId = getString(formData, "charge_id") || null;
  const amount = getNumber(formData, "amount");
  const paymentMethod = getString(formData, "payment_method") || "Zelle";
  const payerEmail = getString(formData, "payer_email") || null;
  const paidDate = getString(formData, "paid_date");
  const note = getString(formData, "note") || null;

  if (!memberId || !paymentId || amount <= 0 || !paidDate) {
    redirect(
      `/admin/members/${memberId}/payments?paymentError=${encodeURIComponent(
        "Payment amount and paid date are required."
      )}`
    );
  }

  let payment: Awaited<ReturnType<typeof getEditablePayment>>;

  try {
    payment = await getEditablePayment(paymentId, memberId);
  } catch (error) {
    redirect(
      `/admin/members/${memberId}/payments?paymentError=${encodeURIComponent(
        error instanceof Error ? error.message : "Unable to edit payment."
      )}`
    );
  }

  if (payment.charge_id && payment.charge_id !== chargeId) {
    await supabaseAdmin
      .from("member_charges")
      .update({
        status: "unpaid",
        paid_at: null,
        payment_method: null,
        payment_provider: null,
        paid_amount: null,
        payment_note: null,
      })
      .eq("id", payment.charge_id);
  }

  const paidAt = toPaidAt(paidDate);
  const { error: paymentError } = await supabaseAdmin
    .from("payments")
    .update({
      charge_id: chargeId,
      amount,
      payment_method: paymentMethod,
      payment_provider: "manual",
      payer_email: payerEmail,
      note,
      paid_at: paidAt,
    })
    .eq("id", paymentId)
    .eq("member_id", memberId);

  if (paymentError) {
    redirect(
      `/admin/members/${memberId}/payments?paymentError=${encodeURIComponent(
        paymentError.message
      )}`
    );
  }

  if (chargeId) {
    const { error: chargeError } = await supabaseAdmin
      .from("member_charges")
      .update({
        status: "paid",
        paid_at: paidAt,
        payment_method: paymentMethod,
        payment_provider: "manual",
        paid_amount: amount,
        payment_note: note,
      })
      .eq("id", chargeId)
      .eq("member_id", memberId);

    if (chargeError) {
      redirect(
        `/admin/members/${memberId}/payments?paymentError=${encodeURIComponent(
          `Payment updated, but charge was not updated: ${chargeError.message}`
        )}`
      );
    }
  }

  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath(`/admin/members/${memberId}/payments`);
  revalidatePath("/admin/accounting");
  redirect(`/admin/members/${memberId}/payments?paymentUpdated=1`);
}

export async function deleteManualPayment(formData: FormData) {
  const memberId = getString(formData, "member_id");
  const paymentId = getString(formData, "payment_id");

  if (!memberId || !paymentId) {
    redirect(`/admin/members/${memberId}/payments`);
  }

  let payment: Awaited<ReturnType<typeof getEditablePayment>>;

  try {
    payment = await getEditablePayment(paymentId, memberId);
  } catch (error) {
    redirect(
      `/admin/members/${memberId}/payments?paymentError=${encodeURIComponent(
        error instanceof Error ? error.message : "Unable to delete payment."
      )}`
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("member_id", memberId);

  if (deleteError) {
    redirect(
      `/admin/members/${memberId}/payments?paymentError=${encodeURIComponent(
        deleteError.message
      )}`
    );
  }

  if (payment.charge_id) {
    await supabaseAdmin
      .from("member_charges")
      .update({
        status: "unpaid",
        paid_at: null,
        payment_method: null,
        payment_provider: null,
        paid_amount: null,
        payment_note: null,
      })
      .eq("id", payment.charge_id)
      .eq("member_id", memberId);
  }

  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath(`/admin/members/${memberId}/payments`);
  revalidatePath("/admin/accounting");
  redirect(`/admin/members/${memberId}/payments?paymentDeleted=1`);
}
