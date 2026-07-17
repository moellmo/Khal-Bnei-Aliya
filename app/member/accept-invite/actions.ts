"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";

function safeNextPath(value: FormDataEntryValue | null) {
  const next = String(value || "/member/set-password");

  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/member/set-password";
  }

  return next;
}

export async function acceptPortalInvitation(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") || "");
  const type = String(formData.get("type") || "") as EmailOtpType;
  const next = safeNextPath(formData.get("next"));

  if (!tokenHash || !type) {
    redirect(
      "/login?error=The%20invitation%20link%20is%20invalid%20or%20incomplete."
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    redirect(
      "/login?error=The%20invitation%20link%20has%20expired%20or%20is%20invalid."
    );
  }

  redirect(next);
}
