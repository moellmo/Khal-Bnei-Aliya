import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    console.error("ADMIN_ACCESS_CHECK_ERROR", memberError.message);
    redirect("/member/dashboard");
  }

  const isActiveAdmin =
    member?.portal_role === "admin" &&
    member.portal_status !== "disabled";

  if (!isActiveAdmin) {
    redirect("/member/dashboard");
  }

  return children;
}