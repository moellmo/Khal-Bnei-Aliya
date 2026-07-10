"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function setMemberPassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(
    formData.get("confirm_password") || ""
  );

  if (password.length < 8) {
    redirect(
      "/member/set-password?error=Password%20must%20be%20at%20least%208%20characters."
    );
  }

  if (password !== confirmPassword) {
    redirect(
      "/member/set-password?error=The%20passwords%20do%20not%20match."
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      "/login?error=Your%20invitation%20session%20has%20expired.%20Please%20request%20a%20new%20invitation."
    );
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password,
  });

  if (passwordError) {
    redirect(
      `/member/set-password?error=${encodeURIComponent(
        passwordError.message
      )}`
    );
  }

  const { error: memberError } = await supabaseAdmin
    .from("members")
    .update({
      portal_status: "active",
      portal_activated_at: new Date().toISOString(),
      portal_last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", user.id);

  if (memberError) {
    throw new Error(memberError.message);
  }

  redirect("/member/dashboard");
}