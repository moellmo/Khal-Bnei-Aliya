"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEmailSender } from "@/lib/emailSender";
import { getSiteOrigin } from "@/lib/siteUrl";

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
  const requestOrigin = host ? `${protocol}://${host}` : null;
  const origin = getSiteOrigin(requestOrigin);

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${origin}/auth/confirm?next=/reset-password`,
    },
  });

  if (error) {
    console.error("PASSWORD_RESET_REQUEST_ERROR", {
      message: error.message,
      emailDomain: email.split("@")[1] || "unknown",
    });
  } else {
    const tokenHash = data.properties?.hashed_token;
    const userId = data.user?.id;
    const resetUrl = tokenHash
      ? `${origin}/auth/confirm?token_hash=${encodeURIComponent(
          tokenHash
        )}&type=recovery&next=%2Freset-password`
      : "";

    if (!tokenHash || !userId) {
      console.error("PASSWORD_RESET_LINK_ERROR", {
        hasToken: Boolean(tokenHash),
        hasUser: Boolean(userId),
      });
    } else if (!process.env.RESEND_API_KEY) {
      console.error("PASSWORD_RESET_EMAIL_NOT_CONFIGURED", {
        hasResendApiKey: false,
      });
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: emailError } = await resend.emails.send({
        from: getEmailSender(
          "MEMBERSHIP_FROM_EMAIL",
          "RECEIPT_FROM_EMAIL",
          "PAYMENT_ALERT_FROM_EMAIL"
        ),
        to: [email],
        subject: "Reset your Khal Bnei Aliya password",
        html: `
          <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
            <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;">
              <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#8b6b2e;">KHAL BNEI ALIYA</div>
              <h1 style="font-size:28px;">Reset your password</h1>
              <p>Use the button below to choose a new member portal password.</p>
              <p style="margin:28px 0;"><a href="${resetUrl}" style="background:#1d2940;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:700;display:inline-block;">Reset Password</a></p>
              <p style="font-size:13px;color:#475569;">This link expires according to your account security settings. If you did not request it, you can ignore this email.</p>
            </div>
          </div>
        `,
      });

      if (emailError) {
        console.error("PASSWORD_RESET_EMAIL_ERROR", {
          message: emailError.message,
          emailDomain: email.split("@")[1] || "unknown",
        });
      }
    }
  }

  redirect(
    "/forgot-password?message=If%20an%20account%20exists%20for%20that%20email%2C%20a%20secure%20reset%20link%20has%20been%20sent."
  );
}
