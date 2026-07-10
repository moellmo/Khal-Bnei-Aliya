import { Resend } from "resend";

type PaymentFailureEmailOptions = {
  recipient: string;
  firstName: string;
  amount: number;
  failureMessage?: string | null;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendPaymentFailureEmail({
  recipient,
  firstName,
  amount,
  failureMessage,
}: PaymentFailureEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.PAYMENT_ALERT_FROM_EMAIL ||
    process.env.RECEIPT_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return {
      sent: false,
      reason: "Email is not configured.",
    };
  }

  const resend = new Resend(apiKey);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const autopayUrl = `${siteUrl}/member/autopay`;
  const dashboardUrl = `${siteUrl}/member/dashboard`;

  const safeFirstName = escapeHtml(firstName);
  const safeFailureMessage = escapeHtml(
    failureMessage ||
      "The card issuer did not approve the transaction."
  );

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [recipient],
    replyTo:
      process.env.PAYMENT_ALERT_REPLY_TO || undefined,
    subject: "Automatic payment could not be processed",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">
          <div style="background:#1d2940;padding:28px;color:#ffffff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#d9bf7a;">
              KHAL BNEI ALIYA
            </div>

            <h1 style="margin:10px 0 0;font-size:27px;">
              Automatic payment unsuccessful
            </h1>
          </div>

          <div style="padding:28px;">
            <p>Dear ${safeFirstName},</p>

            <p>
              We were unable to process your automatic payment of
              <strong>${escapeHtml(formatMoney(amount))}</strong>.
            </p>

            <div style="background:#fff7ed;border-radius:14px;padding:18px;margin:22px 0;color:#9a3412;">
              <strong>Payment response:</strong><br />
              ${safeFailureMessage}
            </div>

            <p>
              Your balance remains unpaid. You can make a payment now or
              replace the card used for future automatic payments.
            </p>

            <p style="margin-top:24px;">
              <a
                href="${autopayUrl}"
                style="display:inline-block;background:#1d2940;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold;margin-right:8px;"
              >
                Manage Automatic Payments
              </a>

              <a
                href="${dashboardUrl}"
                style="display:inline-block;border:1px solid #cbbd9d;color:#172033;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:bold;"
              >
                View Balance
              </a>
            </p>

            <p style="margin-top:26px;">
              Khal Bnei Aliya
            </p>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    sent: true,
    reason: null,
  };
}