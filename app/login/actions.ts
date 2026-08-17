"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/login?error=Please%20enter%20your%20email%20and%20password.");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect("/login?error=Invalid%20email%20or%20password.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = user
    ? await supabaseAdmin
        .from("members")
        .select("portal_role")
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  if (member?.portal_role === "kiddush_admin") {
    redirect("/admin/kiddush");
  }

  if (member?.portal_role === "admin") {
    redirect("/admin");
  }

  redirect("/member/dashboard");
}
