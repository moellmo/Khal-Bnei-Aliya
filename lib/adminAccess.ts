import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PortalRole = "admin" | "kiddush_admin" | "member";

export async function requirePortalAccess(
  allowedRoles: PortalRole[] = ["admin"]
) {
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
    .select("id, portal_role, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (
    !member ||
    member.portal_status === "disabled" ||
    !allowedRoles.includes(member.portal_role as PortalRole)
  ) {
    redirect("/member/dashboard");
  }

  return { user, member };
}
