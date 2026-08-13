"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=Please%20enter%20your%20email%20address.");
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "https";
  const origin = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL;

  if (!origin) {
    redirect("/forgot-password?error=Password%20reset%20is%20not%20configured.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    console.error("PASSWORD_RESET_REQUEST_ERROR", error.message);
  }

  redirect(
    "/forgot-password?message=If%20an%20account%20exists%20for%20that%20email%2C%20a%20secure%20reset%20link%20has%20been%20sent."
  );
}
