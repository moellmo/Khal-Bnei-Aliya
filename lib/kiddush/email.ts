import { Resend } from "resend";

type KiddushReservationEmailOptions = {
  reservationId: string;
  shabbosDate: string;
  sponsorName: string;
  sponsorEmail: string;
  sponsorPhone?: string | null;
  sponsorshipText: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  specialRequests?: string | null;
  totalAmount: number;
  paymentStatus: string;
  paymentReference?: string | null;
  notifyEmail: string;
};

type HallRequestEmailOptions = {
  requestId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  datesNeeded: string;
  details?: string | null;
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

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getEmailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail:
      process.env.MEMBERSHIP_FROM_EMAIL ||
      process.env.PAYMENT_ALERT_FROM_EMAIL ||
      process.env.RECEIPT_FROM_EMAIL,
  };
}

function itemsHtml(items: KiddushReservationEmailOptions["items"]) {
  if (items.length === 0) {
    return "<p>No priced items selected.</p>";
  }

  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #e3d9c7;padding:8px;">Item</th>
          <th style="text-align:right;border-bottom:1px solid #e3d9c7;padding:8px;">Qty</th>
          <th style="text-align:right;border-bottom:1px solid #e3d9c7;padding:8px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #f1eadf;">
                  ${escapeHtml(item.name)}
                  <div style="color:#64748b;font-size:12px;">${escapeHtml(
                    formatMoney(item.unitPrice)
                  )} each</div>
                </td>
                <td style="padding:8px;border-bottom:1px solid #f1eadf;text-align:right;">${item.quantity}</td>
                <td style="padding:8px;border-bottom:1px solid #f1eadf;text-align:right;font-weight:700;">${escapeHtml(
                  formatMoney(item.lineTotal)
                )}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export async function sendKiddushReservationNotification(
  options: KiddushReservationEmailOptions
) {
  const { apiKey, fromEmail } = getEmailConfig();

  if (!apiKey || !fromEmail || !options.notifyEmail) {
    console.warn("KIDDUSH_NOTIFICATION_EMAIL_NOT_CONFIGURED", {
      reservationId: options.reservationId,
      hasApiKey: Boolean(apiKey),
      hasFromEmail: Boolean(fromEmail),
      notifyEmail: options.notifyEmail,
    });
    return;
  }

  const resend = new Resend(apiKey);
  const subject = `Kiddush reserved for ${formatDate(options.shabbosDate)}`;

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e3d9c7;border-radius:24px;overflow:hidden;">
        <div style="background:#1d2940;color:#ffffff;padding:28px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#d9bf7a;">KHAL BNEI ALIYA</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">Kiddush Reservation</h1>
        </div>
        <div style="padding:28px;line-height:1.6;">
          <p><strong>Shabbos:</strong> ${escapeHtml(formatDate(options.shabbosDate))}</p>
          <p><strong>Sponsor:</strong> ${escapeHtml(options.sponsorName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(options.sponsorEmail)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(options.sponsorPhone || "Not provided")}</p>
          <p><strong>Sponsorship text:</strong><br>${escapeHtml(options.sponsorshipText)}</p>
          ${itemsHtml(options.items)}
          ${
            options.specialRequests
              ? `<p><strong>Special requests:</strong><br>${escapeHtml(options.specialRequests)}</p>`
              : ""
          }
          <p style="font-size:18px;"><strong>Total:</strong> ${escapeHtml(formatMoney(options.totalAmount))}</p>
          <p><strong>Payment status:</strong> ${escapeHtml(options.paymentStatus)}</p>
          ${
            options.paymentReference
              ? `<p><strong>Reference:</strong> ${escapeHtml(options.paymentReference)}</p>`
              : ""
          }
          <p style="color:#64748b;font-size:12px;">Reservation ID: ${escapeHtml(options.reservationId)}</p>
        </div>
      </div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [options.notifyEmail],
    subject,
    html,
  });

  if (error) {
    console.error("KIDDUSH_NOTIFICATION_EMAIL_ERROR", {
      reservationId: options.reservationId,
      error: error.message,
    });
  }
}

export async function sendHallReservationRequestEmails({
  requestId,
  fullName,
  email,
  phone,
  datesNeeded,
  details,
}: HallRequestEmailOptions) {
  const { apiKey, fromEmail } = getEmailConfig();
  const hallRecipient =
    process.env.HALL_RESERVATION_EMAIL || "Yedidyadiena@gmail.com";

  if (!apiKey || !fromEmail) {
    console.warn("HALL_REQUEST_EMAIL_NOT_CONFIGURED", {
      requestId,
      hasApiKey: Boolean(apiKey),
      hasFromEmail: Boolean(fromEmail),
    });
    return;
  }

  const resend = new Resend(apiKey);
  const detailsHtml = details
    ? `<p><strong>Details:</strong><br>${escapeHtml(details)}</p>`
    : "";

  await resend.emails.send({
    from: fromEmail,
    to: [hallRecipient],
    subject: `Shul/hall request from ${fullName}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:28px;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e3d9c7;border-radius:20px;padding:26px;line-height:1.6;">
          <h1 style="margin-top:0;color:#1d2940;">Shul / Hall Request</h1>
          <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}</p>
          <p><strong>Date(s) needed:</strong><br>${escapeHtml(datesNeeded)}</p>
          ${detailsHtml}
          <p style="color:#64748b;font-size:12px;">Request ID: ${escapeHtml(requestId)}</p>
        </div>
      </div>
    `,
  });

  await resend.emails.send({
    from: fromEmail,
    to: [email],
    subject: "Your Khal Bnei Aliya request was received",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:28px;color:#0f172a;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e3d9c7;border-radius:20px;padding:26px;line-height:1.6;">
          <h1 style="margin-top:0;color:#1d2940;">Request Received</h1>
          <p>Hi ${escapeHtml(fullName)},</p>
          <p>We received your request to reserve the shul / hall. Someone will get back to you soon.</p>
          <p><strong>Date(s) requested:</strong><br>${escapeHtml(datesNeeded)}</p>
          <p style="color:#64748b;font-size:12px;">Khal Bnei Aliya</p>
        </div>
      </div>
    `,
  });
}
