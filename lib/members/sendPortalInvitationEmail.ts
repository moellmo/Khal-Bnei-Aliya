import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteOrigin } from "@/lib/siteUrl";

type PortalInvitationOptions = {
  memberId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  requestOrigin?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendPortalInvitationEmail({
  memberId,
  email,
  firstName,
  lastName,
  requestOrigin,
}: PortalInvitationOptions) {
  const recipient = email.trim().toLowerCase();
  const siteOrigin = getSiteOrigin(requestOrigin);
  const redirectTo = `${siteOrigin}/auth/confirm?next=${encodeURIComponent(
    "/member/set-password"
  )}`;

  let linkType: "invite" | "recovery" = "invite";
  let { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: linkType,
    email: recipient,
    options: {
      redirectTo,
      data: {
        member_id: memberId,
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error && /already.*registered/i.test(error.message)) {
    linkType = "recovery";
    const recoveryResult = await supabaseAdmin.auth.admin.generateLink({
      type: linkType,
      email: recipient,
      options: {
        redirectTo,
      },
    });
    data = recoveryResult.data;
    error = recoveryResult.error;
  }

  if (error) {
    return {
      sent: false,
      userId: null,
      error: error.message,
      inviteUrl: null,
    };
  }

  const tokenHash = data.properties?.hashed_token;
  const type = data.properties?.verification_type || linkType;
  const userId = data.user?.id || null;

  if (!tokenHash || !userId) {
    return {
      sent: false,
      userId,
      error: "Supabase did not return an invitation token.",
      inviteUrl: null,
    };
  }

  const inviteUrl = `${siteOrigin}/member/accept-invite?token_hash=${encodeURIComponent(
    tokenHash
  )}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(
    "/member/set-password"
  )}`;

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.MEMBERSHIP_FROM_EMAIL ||
    process.env.RECEIPT_FROM_EMAIL ||
    process.env.PAYMENT_ALERT_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return {
      sent: false,
      userId,
      error: !resendApiKey ? "Missing Resend API key." : "Missing sender email.",
      inviteUrl,
    };
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Member";
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(inviteUrl);

  const resend = new Resend(resendApiKey);
  const { error: emailError } = await resend.emails.send({
    from: fromEmail,
    to: [recipient],
    subject: "Create your Khal Bnei Aliya member portal account",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">
          <div style="background:#1d2940;padding:28px;color:#ffffff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#d9bf7a;">
              KHAL BNEI ALIYA
            </div>
            <h1 style="margin:10px 0 0;font-size:28px;">
              Member portal invitation
            </h1>
          </div>

          <div style="padding:28px;">
            <p>Dear ${safeName},</p>

            <p>
              Please use the button below to create your Khal Bnei Aliya
              member portal password.
            </p>

            <p style="margin:28px 0;">
              <a href="${safeUrl}" style="display:inline-block;background:#1d2940;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:700;">
                Create my account
              </a>
            </p>

            <p style="font-size:14px;color:#475569;">
              If the button does not open, copy and paste this link into your
              browser:
            </p>

            <p style="word-break:break-all;font-size:13px;color:#334155;">
              ${safeUrl}
            </p>
          </div>
        </div>
      </div>
    `,
  });

  if (emailError) {
    return {
      sent: false,
      userId,
      error: emailError.message,
      inviteUrl,
    };
  }

  return {
    sent: true,
    userId,
    error: null,
    inviteUrl,
  };
}
