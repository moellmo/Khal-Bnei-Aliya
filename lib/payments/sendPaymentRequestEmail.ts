import { Resend } from "resend";

type SendPaymentRequestEmailOptions = {
  recipient: string | null;
  memberFirstName: string;
  amount: number;
  chargeType: string;
  description: string | null;
  chargeId: string;
  isOpenAmount: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

export async function sendPaymentRequestEmail({
  recipient,
  memberFirstName,
  amount,
  chargeType,
  description,
  chargeId,
  isOpenAmount,
}: SendPaymentRequestEmailOptions) {
  const to = String(recipient || "").trim();
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.PAYMENT_REQUEST_FROM_EMAIL ||
    process.env.RECEIPT_FROM_EMAIL ||
    process.env.PAYMENT_ALERT_FROM_EMAIL ||
    process.env.MEMBERSHIP_FROM_EMAIL;

  if (!to || !resendApiKey || !fromEmail) {
    return {
      sent: false,
      reason: !to
        ? "no_recipient"
        : !resendApiKey
        ? "missing_resend_api_key"
        : "missing_sender",
    };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.khalbneialiya.com";
  const payUrl = `${siteUrl}/member/dashboard#charge-${chargeId}`;
  const subject = isOpenAmount
    ? `${chargeType} payment request`
    : `${formatMoney(amount)} payment request`;
  const safeDescription =
    description || chargeType || "Payment request";

  const resend = new Resend(resendApiKey);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">
          <div style="background:#1d2940;padding:28px;color:#ffffff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#d9bf7a;">
              KHAL BNEI ALIYA
            </div>
            <h1 style="margin:10px 0 0;font-size:28px;">
              Payment request
            </h1>
          </div>

          <div style="padding:28px;">
            <p>Dear ${escapeHtml(memberFirstName || "Member")},</p>

            <p>
              A payment request has been added to your Khal Bnei Aliya account.
            </p>

            <div style="background:#fbf8f2;border-radius:14px;padding:18px;margin:22px 0;">
              <p style="margin:0 0 8px;">
                <strong>Purpose:</strong>
                ${escapeHtml(safeDescription)}
              </p>
              <p style="margin:0;">
                <strong>Amount:</strong>
                ${
                  isOpenAmount
                    ? "Matana - choose any amount when paying"
                    : escapeHtml(formatMoney(amount))
                }
              </p>
            </div>

            <p>
              You can pay by card in the member portal, or send Zelle to
              <strong> khalbneialiyah@gmail.com</strong>.
            </p>

            <p style="margin:26px 0;">
              <a href="${escapeHtml(payUrl)}" style="display:inline-block;background:#8b6b2e;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700;">
                Open Payment Request
              </a>
            </p>

            <p>Khal Bnei Aliya</p>
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
    reason: "sent",
  };
}
