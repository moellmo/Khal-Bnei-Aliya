import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateReceiptOptions = {
  paymentId: string;
  emailOverride?: string | null;
};

type Payment = {
  id: string;
  member_id: string;
  charge_id: string | null;
  amount: number;
  payment_method: string | null;
  payment_provider: string | null;
  external_payment_id: string | null;
  payer_email: string | null;
  paid_at: string | null;
  created_at: string | null;
  receipt_number: string | null;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

type Charge = {
  id: string;
  charge_type: string;
  description: string | null;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function formatDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-US");
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeReceiptNumber(payment: Payment) {
  if (payment.receipt_number) {
    return payment.receipt_number;
  }

  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const referencePart = (
    payment.external_payment_id ||
    payment.id.replaceAll("-", "").slice(0, 12)
  )
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 20);

  return `KBA-${datePart}-${referencePart}`;
}

async function loadPayment(paymentId: string) {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select(
      "id, member_id, charge_id, amount, payment_method, payment_provider, external_payment_id, payer_email, paid_at, created_at, receipt_number"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load payment: ${error.message}`);
  }

  if (!data) {
    throw new Error("Payment was not found.");
  }

  return data as Payment;
}

async function loadMember(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, first_name, last_name, email")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load member: ${error.message}`);
  }

  if (!data) {
    throw new Error("Member was not found.");
  }

  return data as Member;
}

async function loadCharge(chargeId: string | null) {
  if (!chargeId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select("id, charge_type, description")
    .eq("id", chargeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load charge: ${error.message}`);
  }

  return (data || null) as Charge | null;
}

async function buildReceiptPdf({
  payment,
  member,
  charge,
  receiptNumber,
}: {
  payment: Payment;
  member: Member;
  charge: Charge | null;
  receiptNumber: string;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);

  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.11, 0.16, 0.25);
  const gold = rgb(0.55, 0.42, 0.18);
  const gray = rgb(0.4, 0.44, 0.5);
  const lightGray = rgb(0.94, 0.93, 0.9);

  page.drawRectangle({
    x: 0,
    y: 702,
    width: 612,
    height: 90,
    color: navy,
  });

  page.drawText("KHAL BNEI ALIYA", {
    x: 48,
    y: 752,
    size: 20,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText("PAYMENT RECEIPT", {
    x: 48,
    y: 724,
    size: 11,
    font: boldFont,
    color: rgb(0.86, 0.75, 0.48),
  });

  page.drawText(`Receipt ${receiptNumber}`, {
    x: 382,
    y: 752,
    size: 10,
    font: regularFont,
    color: rgb(1, 1, 1),
  });

  page.drawText(formatDate(payment.paid_at || payment.created_at), {
    x: 382,
    y: 732,
    size: 10,
    font: regularFont,
    color: rgb(1, 1, 1),
  });

  page.drawText("Received From", {
    x: 48,
    y: 660,
    size: 10,
    font: boldFont,
    color: gold,
  });

  page.drawText(`${member.first_name} ${member.last_name}`, {
    x: 48,
    y: 634,
    size: 18,
    font: boldFont,
    color: navy,
  });

  if (member.email) {
    page.drawText(member.email, {
      x: 48,
      y: 614,
      size: 10,
      font: regularFont,
      color: gray,
    });
  }

  page.drawRectangle({
    x: 48,
    y: 490,
    width: 516,
    height: 92,
    color: lightGray,
  });

  page.drawText("Payment Details", {
    x: 66,
    y: 554,
    size: 11,
    font: boldFont,
    color: navy,
  });

  page.drawText("Description", {
    x: 66,
    y: 526,
    size: 9,
    font: boldFont,
    color: gray,
  });

  page.drawText(
    charge?.description ||
      charge?.charge_type ||
      "Payment to Khal Bnei Aliya",
    {
      x: 156,
      y: 526,
      size: 10,
      font: regularFont,
      color: navy,
      maxWidth: 250,
    }
  );

  page.drawText("Method", {
    x: 66,
    y: 505,
    size: 9,
    font: boldFont,
    color: gray,
  });

  page.drawText(payment.payment_method || payment.payment_provider || "Payment", {
    x: 156,
    y: 505,
    size: 10,
    font: regularFont,
    color: navy,
  });

  page.drawText("Amount Paid", {
    x: 410,
    y: 526,
    size: 9,
    font: boldFont,
    color: gray,
  });

  page.drawText(formatMoney(payment.amount), {
    x: 410,
    y: 500,
    size: 20,
    font: boldFont,
    color: navy,
  });

  if (payment.external_payment_id) {
    page.drawText("Transaction Reference", {
      x: 48,
      y: 440,
      size: 9,
      font: boldFont,
      color: gray,
    });

    page.drawText(payment.external_payment_id, {
      x: 48,
      y: 420,
      size: 10,
      font: regularFont,
      color: navy,
    });
  }

  page.drawLine({
    start: { x: 48, y: 370 },
    end: { x: 564, y: 370 },
    thickness: 1,
    color: lightGray,
  });

  page.drawText("Thank you for your payment and support of Khal Bnei Aliya.", {
    x: 48,
    y: 338,
    size: 12,
    font: boldFont,
    color: navy,
  });

  page.drawText(
    "This receipt confirms payment received. Tax-deductibility, if applicable, is determined separately.",
    {
      x: 48,
      y: 312,
      size: 9,
      font: regularFont,
      color: gray,
      maxWidth: 500,
    }
  );

  page.drawText("Khal Bnei Aliya", {
    x: 48,
    y: 70,
    size: 10,
    font: boldFont,
    color: navy,
  });

  page.drawText("Payment receipt generated by the Khal Bnei Aliya member portal.", {
    x: 48,
    y: 52,
    size: 8,
    font: regularFont,
    color: gray,
  });

  return pdf.save();
}

export async function createAndSendReceipt({
  paymentId,
  emailOverride,
}: CreateReceiptOptions) {
  const payment = await loadPayment(paymentId);
  const member = await loadMember(payment.member_id);
  const charge = await loadCharge(payment.charge_id);

  const receiptNumber = makeReceiptNumber(payment);

  const pdfBytes = await buildReceiptPdf({
    payment,
    member,
    charge,
    receiptNumber,
  });

  const storagePath = `${member.id}/${receiptNumber}.pdf`;

  /*
   * Step 1: create and upload the PDF.
   * This is the essential receipt operation.
   */
  const { error: uploadError } = await supabaseAdmin.storage
    .from("payment-receipts")
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Unable to upload receipt: ${uploadError.message}`
    );
  }

  /*
   * Step 2: save the receipt path immediately.
   *
   * This must happen before attempting email so that an email
   * configuration or delivery error does not remove the member's
   * ability to download the PDF.
   */
  const { error: receiptSaveError } = await supabaseAdmin
    .from("payments")
    .update({
      receipt_number: receiptNumber,
      receipt_pdf_url: storagePath,
      receipt_email_status: "pending",
    })
    .eq("id", payment.id);

  if (receiptSaveError) {
    throw new Error(
      `Unable to save receipt record: ${receiptSaveError.message}`
    );
  }

  const recipient =
    emailOverride?.trim() ||
    payment.payer_email?.trim() ||
    member.email?.trim() ||
    "";

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RECEIPT_FROM_EMAIL ||
    process.env.PAYMENT_ALERT_FROM_EMAIL ||
    process.env.MEMBERSHIP_FROM_EMAIL;

  let emailedAt: string | null = null;
  let emailStatus = "not_sent";
  let emailErrorMessage: string | null = null;

  /*
   * Step 3: email is optional and must never block the PDF.
   */
  if (!recipient) {
    emailStatus = "no_recipient";
  } else if (!resendApiKey || !fromEmail) {
    emailStatus = "not_configured";

    emailErrorMessage = !resendApiKey
      ? "RESEND_API_KEY is missing."
      : "No receipt sender email is configured.";

    console.warn("RECEIPT_EMAIL_NOT_CONFIGURED", {
      paymentId: payment.id,
      receiptNumber,
      error: emailErrorMessage,
    });
  } else {
    try {
      const resend = new Resend(resendApiKey);

      const description =
        charge?.description ||
        charge?.charge_type ||
        "Payment to Khal Bnei Aliya";

      const { error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: [recipient],
        subject: `Payment receipt ${receiptNumber}`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#f7f3ea;padding:32px;color:#0f172a;">
            <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">
              <div style="background:#1d2940;padding:28px;color:#ffffff;">
                <div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#d9bf7a;">
                  KHAL BNEI ALIYA
                </div>

                <h1 style="margin:10px 0 0;font-size:28px;">
                  Payment received
                </h1>
              </div>

              <div style="padding:28px;">
                <p>
                  Dear ${escapeHtml(member.first_name)},
                </p>

                <p>
                  Thank you. We received your payment.
                </p>

                <div style="background:#fbf8f2;border-radius:14px;padding:18px;margin:22px 0;">
                  <p style="margin:0 0 8px;">
                    <strong>Amount:</strong>
                    ${escapeHtml(formatMoney(payment.amount))}
                  </p>

                  <p style="margin:0 0 8px;">
                    <strong>Description:</strong>
                    ${escapeHtml(description)}
                  </p>

                  <p style="margin:0 0 8px;">
                    <strong>Date:</strong>
                    ${escapeHtml(
                      formatDate(
                        payment.paid_at || payment.created_at
                      )
                    )}
                  </p>

                  <p style="margin:0;">
                    <strong>Receipt:</strong>
                    ${escapeHtml(receiptNumber)}
                  </p>
                </div>

                <p>
                  Your PDF receipt is attached to this email.
                </p>

                <p style="margin-top:26px;">
                  Khal Bnei Aliya
                </p>
              </div>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `${receiptNumber}.pdf`,
            content: Buffer.from(pdfBytes).toString("base64"),
          },
        ],
      });

      if (emailError) {
        throw new Error(emailError.message);
      }

      emailedAt = new Date().toISOString();
      emailStatus = "sent";
    } catch (error) {
      emailStatus = "failed";

      emailErrorMessage =
        error instanceof Error
          ? error.message
          : "Unable to email receipt.";

      console.error("RECEIPT_EMAIL_ERROR", {
        paymentId: payment.id,
        receiptNumber,
        recipient,
        error: emailErrorMessage,
      });
    }
  }

  /*
   * Step 4: record the email result without touching the PDF path.
   */
  const { error: emailStatusUpdateError } = await supabaseAdmin
    .from("payments")
    .update({
      receipt_emailed_at: emailedAt,
      receipt_email_status: emailStatus,
    })
    .eq("id", payment.id);

  if (emailStatusUpdateError) {
    console.error("RECEIPT_EMAIL_STATUS_UPDATE_ERROR", {
      paymentId: payment.id,
      receiptNumber,
      error: emailStatusUpdateError.message,
    });
  }

  return {
    receiptNumber,
    storagePath,
    recipient: recipient || null,
    emailed: Boolean(emailedAt),
    emailStatus,
    emailError: emailErrorMessage,
  };
}
