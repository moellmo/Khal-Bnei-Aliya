"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
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

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id, portal_role, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    memberError ||
    member?.portal_role !== "admin" ||
    member.portal_status === "disabled"
  ) {
    redirect("/member/dashboard");
  }
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function sendTestEmail(formData: FormData) {
  await requireAdmin();

  const recipient = getString(formData, "recipient").toLowerCase();
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RECEIPT_FROM_EMAIL ||
    process.env.PAYMENT_ALERT_FROM_EMAIL ||
    process.env.MEMBERSHIP_FROM_EMAIL;

  if (!recipient) {
    redirect("/admin/email-test?error=Recipient%20email%20is%20required.");
  }

  if (!apiKey || !fromEmail) {
    redirect(
      "/admin/email-test?error=RESEND_API_KEY%20or%20sender%20email%20is%20missing."
    );
  }

  try {
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [recipient],
      subject: "Khal Bnei Aliya email test",
      html: `
        <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">
            <div style="background:#1d2940;padding:28px;color:#ffffff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#d9bf7a;">
                KHAL BNEI ALIYA
              </div>
              <h1 style="margin:10px 0 0;font-size:28px;">Email test successful</h1>
            </div>
            <div style="padding:28px;">
              <p>This confirms Resend accepted mail from:</p>
              <p><strong>${fromEmail}</strong></p>
              <p>If this reached your inbox, receipts and alerts can use this sender.</p>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send test email.";

    redirect(`/admin/email-test?error=${encodeURIComponent(message)}`);
  }

  redirect(`/admin/email-test?sent=1&recipient=${encodeURIComponent(recipient)}`);
}
