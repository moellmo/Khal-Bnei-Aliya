"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: currentMember, error: memberError } =
    await supabaseAdmin
      .from("members")
      .select("id, portal_role, portal_status")
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (
    !currentMember ||
    currentMember.portal_role !== "admin" ||
    currentMember.portal_status === "disabled"
  ) {
    redirect("/member/dashboard");
  }

  return {
    user,
    currentMember,
  };
}

export async function promoteMemberToAdmin(memberId: string) {
  await requireAdmin();

  const { data: member, error: memberError } =
    await supabaseAdmin
      .from("members")
      .select("id, auth_user_id, email, portal_status")
      .eq("id", memberId)
      .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error("Member not found.");
  }

  if (!member.auth_user_id) {
    redirect(
      `/admin/admin-users?error=${encodeURIComponent(
        "This member must activate portal access before becoming an admin."
      )}`
    );
  }

  if (member.portal_status !== "active") {
    redirect(
      `/admin/admin-users?error=${encodeURIComponent(
        "This member's portal account must be active before becoming an admin."
      )}`
    );
  }

  const { error } = await supabaseAdmin
    .from("members")
    .update({
      portal_role: "admin",
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/admin-users");
  revalidatePath("/admin");
  revalidatePath("/");

  redirect("/admin/admin-users?promoted=1");
}

export async function removeMemberAdminAccess(memberId: string) {
  const { currentMember } = await requireAdmin();

  if (currentMember.id === memberId) {
    redirect(
      `/admin/admin-users?error=${encodeURIComponent(
        "You cannot remove your own admin access."
      )}`
    );
  }

  const { data: member, error: memberError } =
    await supabaseAdmin
      .from("members")
      .select("id, portal_role")
      .eq("id", memberId)
      .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error("Member not found.");
  }

  const { error } = await supabaseAdmin
    .from("members")
    .update({
      portal_role: "member",
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/admin-users");
  revalidatePath("/admin");
  revalidatePath("/");

  redirect("/admin/admin-users?removed=1");
}