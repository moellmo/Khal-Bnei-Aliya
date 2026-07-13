"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
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

  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("id, first_name, last_name, email, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!member) {
    throw new Error("Your login is not linked to a member account.");
  }

  if (member.portal_status === "disabled") {
    throw new Error("Member portal access is disabled.");
  }

  return member;
}

export async function submitZellePaymentClaim(formData: FormData) {
  const member = await getSignedInMember();
  const chargeId = getString(formData, "charge_id");
  const amount = getNumber(formData, "amount");
  const note = getString(formData, "note") || null;

  if (!chargeId || amount <= 0) {
    throw new Error("Choose a charge and enter a valid Zelle amount.");
  }

  const { data: charge, error: chargeError } = await supabaseAdmin
    .from("member_charges")
    .select("id, amount, charge_type, description, status")
    .eq("id", chargeId)
    .eq("member_id", member.id)
    .neq("status", "paid")
    .maybeSingle();

  if (chargeError) {
    throw new Error(chargeError.message);
  }

  if (!charge) {
    throw new Error("Open charge not found.");
  }

  const memberName = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const purpose =
    charge.description || charge.charge_type || "Member payment";

  const { error } = await supabaseAdmin
    .from("zelle_payments")
    .insert({
      payer_name: memberName || "Member",
      payer_email: member.email,
      amount,
      received_date: new Date().toISOString().slice(0, 10),
      purpose,
      note: [
        `Member reported Zelle payment for charge ${charge.id}.`,
        note,
      ]
        .filter(Boolean)
        .join(" "),
      status: "pending_review",
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/member/dashboard");
  revalidatePath("/admin/accounting");

  redirect("/member/dashboard?zelleSubmitted=1");
}
