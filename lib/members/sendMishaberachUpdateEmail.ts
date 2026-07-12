import { Resend } from "resend";

type MishaberachUpdateEmailOptions = {
  memberId: string;
  memberName: string;
  memberEmail?: string | null;
  changeType: string;
  details?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function getAdminRecipients() {
  const recipients =
    process.env.MISHABERACH_ADMIN_EMAIL ||
    process.env.MEMBERSHIP_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "";

  return recipients
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export async function sendMishaberachUpdateEmail({
  memberId,
  memberName,
  memberEmail,
  changeType,
  details,
}: MishaberachUpdateEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.MEMBERSHIP_FROM_EMAIL ||
    process.env.RECEIPT_FROM_EMAIL ||
    process.env.PAYMENT_ALERT_FROM_EMAIL;
  const recipients = getAdminRecipients();

  if (!apiKey || !fromEmail || recipients.length === 0) {
    console.warn("MISHABERACH_UPDATE_EMAIL_NOT_CONFIGURED", {
      memberId,
      hasApiKey: Boolean(apiKey),
      hasFromEmail: Boolean(fromEmail),
      recipientCount: recipients.length,
    });
    return;
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.khalbneialiya.com";
  const memberUrl = `${siteUrl}/admin/members/${memberId}?tab=mishaberach`;
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: recipients,
    subject: `Mishaberach card updated: ${memberName}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e3d9c7;">
          <div style="background:#1d2940;padding:28px;color:#ffffff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#d9bf7a;">
              KHAL BNEI ALIYA
            </div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">
              Mishaberach Card Updated
            </h1>
          </div>
          <div style="padding:28px;line-height:1.6;">
            <p><strong>Member:</strong> ${escapeHtml(memberName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(memberEmail || "Not provided")}</p>
            <p><strong>Change:</strong> ${escapeHtml(changeType)}</p>
            ${
              details
                ? `<p><strong>Details:</strong> ${escapeHtml(details)}</p>`
                : ""
            }
            <p style="margin:28px 0;">
              <a href="${memberUrl}" style="background:#1d2940;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;display:inline-block;">
                Review Member Card
              </a>
            </p>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("MISHABERACH_UPDATE_EMAIL_ERROR", {
      memberId,
      error: error.message,
    });
  }
}
