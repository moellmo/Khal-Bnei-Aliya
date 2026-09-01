import { Resend } from "resend";
import { getEmailSender } from "@/lib/emailSender";

type YamimNoraimReservationEmailOptions = {
  reservationId: string;
  year: number;
  fullName: string;
  email: string;
  pricingLabel: string;
  roshHashanaMenSeats: number;
  roshHashanaWomenSeats: number;
  yomKippurMenSeats: number;
  yomKippurWomenSeats: number;
  totalAmount: number;
  confirmationUrl: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] || character;
  });
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export async function sendYamimNoraimReservationConfirmation(
  options: YamimNoraimReservationEmailOptions
) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = getEmailSender(
    "MEMBERSHIP_FROM_EMAIL",
    "RECEIPT_FROM_EMAIL",
    "PAYMENT_ALERT_FROM_EMAIL"
  );

  if (!apiKey || !options.email) {
    console.warn("YAMIM_NORAIM_CONFIRMATION_EMAIL_NOT_CONFIGURED", {
      reservationId: options.reservationId,
      hasApiKey: Boolean(apiKey),
      hasRecipient: Boolean(options.email),
    });
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [options.email],
    subject: `Yamim Noraim reservation received · ${options.year}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e3d9c7;">
          <div style="background:#1d2940;padding:28px;color:#fff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#d9bf7a;">KHAL BNEI ALIYA · YAMIM NORAIM</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Reservation received</h1>
          </div>
          <div style="padding:28px;line-height:1.6;">
            <p>Hi ${escapeHtml(options.fullName)},</p>
            <p>We received your seat reservation. Your seats are being held, but payment has not been completed yet.</p>
            <p><strong>Reservation ID:</strong> ${escapeHtml(options.reservationId)}<br />
              <strong>Seats:</strong> ${escapeHtml(options.pricingLabel)}<br />
              <strong>Total:</strong> ${escapeHtml(formatMoney(options.totalAmount))}</p>
            <p style="margin:28px 0;"><a href="${escapeHtml(options.confirmationUrl)}" style="background:#1d2940;color:#fff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;display:inline-block;">Continue to payment</a></p>
            <p>You may pay by card on the confirmation page, or send Zelle to <strong>khalbneialiyah@gmail.com</strong> and include your name and reservation ID in the memo.</p>
            <p style="color:#64748b;font-size:12px;">Rosh Hashana: ${options.roshHashanaMenSeats} men / ${options.roshHashanaWomenSeats} women · Yom Kippur: ${options.yomKippurMenSeats} men / ${options.yomKippurWomenSeats} women</p>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}
