"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  MISHABERACH_PENDING_START_AT,
  MISHABERACH_REVIEWED_AT,
} from "@/lib/mishaberachReview";

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

  if (error) {
    throw new Error(error.message);
  }

  if (
    !member ||
    member.portal_role !== "admin" ||
    member.portal_status === "disabled"
  ) {
    redirect("/member/dashboard");
  }
}

function refreshCards() {
  revalidatePath("/admin/mishaberach-cards");
  revalidatePath("/admin/members");
}

export async function markMishaberachCardReviewed(formData: FormData) {
  await requireAdmin();

  const memberId = String(formData.get("member_id") || "").trim();

  if (!memberId) {
    throw new Error("Member ID is required.");
  }

  const { error } = await supabaseAdmin
    .from("members")
    .update({ updated_at: MISHABERACH_REVIEWED_AT })
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  refreshCards();
  revalidatePath(`/admin/members/${memberId}`);

  redirect("/admin/mishaberach-cards?reviewed=1");
}

export async function clearMishaberachPendingChanges() {
  await requireAdmin();

  const { error } = await supabaseAdmin
    .from("members")
    .update({ updated_at: MISHABERACH_REVIEWED_AT })
    .gte("updated_at", MISHABERACH_PENDING_START_AT);

  if (error) {
    throw new Error(error.message);
  }

  refreshCards();

  redirect("/admin/mishaberach-cards?cleared=1");
}
