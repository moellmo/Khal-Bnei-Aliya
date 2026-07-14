import { Resend } from "resend";

type ZelleReviewEmailOptions = {
  memberName: string;
  memberEmail?: string | null;
  amount: number;
  purpose: string;
  note?: string | null;
  chargeId: string;
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

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function getAccountingRecipients() {
  const recipients =
    process.env.ACCOUNTING_ADMIN_EMAIL ||
    process.env.PAYMENT_ADMIN_EMAIL ||
    process.env.MEMBERSHIP_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "";

  return recipients
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export async function sendZelleReviewEmail({
  memberName,
  memberEmail,
  amount,
  purpose,
  note,
  chargeId,
}: ZelleReviewEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.PAYMENT_ALERT_FROM_EMAIL ||
    process.env.RECEIPT_FROM_EMAIL ||
    process.env.MEMBERSHIP_FROM_EMAIL;
  const recipients = getAccountingRecipients();

  if (!apiKey || !fromEmail || recipients.length === 0) {
    console.warn("ZELLE_REVIEW_EMAIL_NOT_CONFIGURED", {
      chargeId,
      hasApiKey: Boolean(apiKey),
      hasFromEmail: Boolean(fromEmail),
      recipientCount: recipients.length,
    });
    return;
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.khalbneialiya.com";
  const accountingUrl = `${siteUrl}/admin/accounting?view=payments#zelle-matching`;
  const resend = new Resend(apiKey);
  const safeNote = note?.trim();

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: recipients,
    subject: `Zelle payment needs review: ${memberName}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e3d9c7;">
          <div style="background:#1d2940;padding:28px;color:#ffffff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#d9bf7a;">
              KHAL BNEI ALIYA
            </div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">
              Zelle Payment Submitted
            </h1>
          </div>
          <div style="padding:28px;line-height:1.6;">
            <p>A member marked a charge as paid by Zelle. Please review and match it in Accounting.</p>
            <p><strong>Member:</strong> ${escapeHtml(memberName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(memberEmail || "Not provided")}</p>
            <p><strong>Amount:</strong> ${escapeHtml(formatMoney(amount))}</p>
            <p><strong>Purpose:</strong> ${escapeHtml(purpose)}</p>
            <p><strong>Charge ID:</strong> ${escapeHtml(chargeId)}</p>
            ${
              safeNote
                ? `<p><strong>Member note:</strong> ${escapeHtml(safeNote)}</p>`
                : ""
            }
            <p style="margin:28px 0;">
              <a href="${accountingUrl}" style="background:#1d2940;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;display:inline-block;">
                Review in Accounting
              </a>
            </p>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("ZELLE_REVIEW_EMAIL_ERROR", {
      chargeId,
      error: error.message,
    });
  }
}
