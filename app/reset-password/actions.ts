"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (password.length < 8) {
    redirect("/reset-password?error=Password%20must%20be%20at%20least%208%20characters.");
  }

  if (password !== confirmPassword) {
    redirect("/reset-password?error=The%20passwords%20do%20not%20match.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Your%20reset%20link%20has%20expired.%20Please%20request%20a%20new%20one.");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Your%20password%20was%20updated.%20Please%20sign%20in.");
}
