"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPaymentRequestEmail } from "@/lib/payments/sendPaymentRequestEmail";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("id, portal_role, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    error ||
    member?.portal_role !== "admin" ||
    member.portal_status === "disabled"
  ) {
    redirect("/member/dashboard");
  }
}

export async function createQuickCharge(formData: FormData) {
  await requireAdmin();

  const memberId = getString(formData, "member_id");
  const chargeType = getString(formData, "charge_type") || "Mishaberach";
  const description = getString(formData, "description") || null;
  const dueDate =
    getString(formData, "due_date") ||
    new Date().toISOString().slice(0, 10);
  const amount = getNumber(formData, "amount");

  if (!memberId) {
    redirect(
      `/admin?quickChargeError=${encodeURIComponent("Choose a member.")}`
    );
  }

  if (amount <= 0) {
    redirect(
      `/admin?quickChargeError=${encodeURIComponent(
        "Amount must be greater than $0."
      )}`
    );
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id, first_name, email")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError || !member) {
    redirect(
      `/admin?quickChargeError=${encodeURIComponent(
        memberError?.message || "Member was not found."
      )}`
    );
  }

  const { data: charge, error } = await supabaseAdmin
    .from("member_charges")
    .insert({
      member_id: memberId,
      charge_type: chargeType,
      description,
      amount,
      status: "unpaid",
      due_date: dueDate,
    })
    .select("id")
    .single();

  if (error || !charge) {
    redirect(
      `/admin?quickChargeError=${encodeURIComponent(
        error?.message || "Unable to create the charge."
      )}`
    );
  }

  if (member.email) {
    try {
      await sendPaymentRequestEmail({
        recipient: member.email,
        memberFirstName: member.first_name || "Member",
        amount,
        chargeType,
        description,
        chargeId: charge.id,
        isOpenAmount: false,
      });
    } catch (emailError) {
      console.error("QUICK_CHARGE_EMAIL_ERROR", {
        memberId,
        chargeId: charge.id,
        error: emailError,
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath(`/admin/members/${memberId}/payments`);
  revalidatePath("/member/dashboard");

  redirect(
    `/admin?quickChargeCreated=1&memberId=${encodeURIComponent(memberId)}`
  );
}
