import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookPayload = Record<string, string>;

function formDataToObject(formData: FormData): WebhookPayload {
  const result: WebhookPayload = {};

  for (const [key, value] of formData.entries()) {
    result[key] = String(value);
  }

  return result;
}

function getField(payload: WebhookPayload, possibleNames: string[]) {
  const entries = Object.entries(payload);

  for (const possibleName of possibleNames) {
    const match = entries.find(
      ([key]) => key.toLowerCase() === possibleName.toLowerCase()
    );

    if (match) {
      return match[1];
    }
  }

  return "";
}

function verifyWebhookSignature({
  payload,
  signature,
  pin,
}: {
  payload: WebhookPayload;
  signature: string;
  pin: string;
}) {
  const normalizedEntries = Object.entries(payload)
    .map(([key, value]) => ({
      key: key.toLowerCase(),
      value: String(value),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const concatenatedValues =
    normalizedEntries.map((entry) => entry.value).join("") + pin;

  const calculatedHash = crypto
    .createHash("md5")
    .update(concatenatedValues, "utf8")
    .digest("hex");

  const receivedHash = signature.trim().toLowerCase();

  if (calculatedHash.length !== receivedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(calculatedHash),
    Buffer.from(receivedHash)
  );
}

function isApprovedPayment(payload: WebhookPayload) {
  const responseResult = getField(payload, [
    "xResponseResult",
    "xStatus",
    "xResult",
  ]).toLowerCase();

  return (
    responseResult === "approved" ||
    responseResult === "a" ||
    responseResult === "success"
  );
}

function parseAmount(payload: WebhookPayload) {
  const rawAmount = getField(payload, [
    "xAmount",
    "xAuthAmount",
    "xApprovedAmount",
  ]);

  const amount = Number(rawAmount);

  return Number.isFinite(amount) ? amount : 0;
}

function extractChargeId(invoice: string) {
  if (!invoice.startsWith("KBA-")) {
    return null;
  }

  const chargeId = invoice.slice(4).trim();

  return chargeId || null;
}

function sanitizePayload(payload: WebhookPayload) {
  const sensitiveTerms = [
    "token",
    "cardnum",
    "cardnumber",
    "cvv",
    "account",
    "routing",
    "exp",
    "key",
  ];

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();

    const isSensitive = sensitiveTerms.some((term) =>
      lowerKey.includes(term)
    );

    sanitized[key] = isSensitive ? "[REDACTED]" : value;
  }

  return sanitized;
}

async function findChargeByInvoice(invoice: string) {
  const chargeId = extractChargeId(invoice);

  if (!chargeId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, member_id, amount, status, charge_type, description, due_date"
    )
    .eq("id", chargeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to find charge: ${error.message}`);
  }

  return data;
}

async function findMemberByRecurringId(recurringId: string) {
  if (!recurringId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, email, sola_customer_id, sola_recurring_id"
    )
    .eq("sola_recurring_id", recurringId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to find recurring member: ${error.message}`);
  }

  return data;
}

async function findMemberByCustomerId(customerId: string) {
  if (!customerId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, email, sola_customer_id, sola_recurring_id"
    )
    .eq("sola_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to find Sola customer: ${error.message}`);
  }

  return data;
}

async function findMatchingUnpaidCharge({
  memberId,
  amount,
}: {
  memberId: string;
  amount: number;
}) {
  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, member_id, amount, status, charge_type, description, due_date"
    )
    .eq("member_id", memberId)
    .neq("status", "paid")
    .eq("charge_type", "Membership Dues")
    .eq("amount", amount)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to find unpaid dues: ${error.message}`);
  }

  return data;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Sola webhook endpoint is online.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const webhookPin = process.env.SOLA_WEBHOOK_PIN;

    if (!webhookPin) {
      console.error("SOLA_WEBHOOK_PIN is missing.");

      return NextResponse.json(
        {
          received: false,
          error: "Webhook configuration is missing.",
        },
        { status: 500 }
      );
    }

    const signature = request.headers.get("ck-signature") || "";

    if (!signature) {
      console.warn("Sola webhook rejected: missing ck-signature.");

      return NextResponse.json(
        {
          received: false,
          error: "Missing signature.",
        },
        { status: 401 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    if (
      !contentType.includes("application/x-www-form-urlencoded") &&
      !contentType.includes("multipart/form-data")
    ) {
      return NextResponse.json(
        {
          received: false,
          error: "Unsupported webhook content type.",
        },
        { status: 415 }
      );
    }

    const formData = await request.formData();
    const payload = formDataToObject(formData);

    const signatureValid = verifyWebhookSignature({
      payload,
      signature,
      pin: webhookPin,
    });

    if (!signatureValid) {
      console.warn("Sola webhook rejected: invalid signature.");

      return NextResponse.json(
        {
          received: false,
          error: "Invalid signature.",
        },
        { status: 401 }
      );
    }

    const refNum = getField(payload, [
      "xRefNum",
      "xTransactionId",
      "xTransactionID",
    ]);

    if (!refNum) {
      return NextResponse.json(
        {
          received: false,
          error: "Missing transaction reference.",
        },
        { status: 400 }
      );
    }

    const { data: existingPayment, error: duplicateCheckError } =
      await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("external_payment_id", refNum)
        .maybeSingle();

    if (duplicateCheckError) {
      throw new Error(
        `Unable to check duplicate payment: ${duplicateCheckError.message}`
      );
    }

    if (existingPayment) {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    if (!isApprovedPayment(payload)) {
      console.log("SOLA_WEBHOOK_NOT_APPROVED", {
        refNum,
        payload: sanitizePayload(payload),
      });

      return NextResponse.json({
        received: true,
        approved: false,
      });
    }

    const amount = parseAmount(payload);

    if (amount <= 0) {
      return NextResponse.json(
        {
          received: false,
          error: "Invalid payment amount.",
        },
        { status: 400 }
      );
    }

    const invoice = getField(payload, ["xInvoice"]);

    const recurringId = getField(payload, [
      "xRecurringId",
      "xRecurringID",
      "xScheduleId",
      "xScheduleID",
      "xRecurringScheduleId",
    ]);

    const customerId = getField(payload, [
      "xCustomerId",
      "xCustomerID",
      "xCustId",
      "xCustID",
    ]);

    const paymentEmail = getField(payload, [
      "xEmail",
      "xBillEmail",
      "xCustomerEmail",
    ]);

    const paymentMethod = getField(payload, [
      "xCardType",
      "xPaymentMethod",
    ]);

    let charge = await findChargeByInvoice(invoice);
    let memberId = charge?.member_id || null;

    if (!memberId && recurringId) {
      const recurringMember = await findMemberByRecurringId(recurringId);

      if (recurringMember) {
        memberId = recurringMember.id;

        charge = await findMatchingUnpaidCharge({
          memberId,
          amount,
        });
      }
    }

    if (!memberId && customerId) {
      const customerMember = await findMemberByCustomerId(customerId);

      if (customerMember) {
        memberId = customerMember.id;

        charge = await findMatchingUnpaidCharge({
          memberId,
          amount,
        });
      }
    }

    if (!memberId) {
      console.error("SOLA_WEBHOOK_UNMATCHED_PAYMENT", {
        refNum,
        amount,
        invoice,
        recurringId,
        customerId,
        payload: sanitizePayload(payload),
      });

      return NextResponse.json(
        {
          received: false,
          error: "Unable to match payment to a member.",
        },
        { status: 422 }
      );
    }

    const paidAt = new Date().toISOString();

    const receiptNumber = `KBA-${new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "")}-${refNum}`;

    const { error: paymentInsertError } = await supabaseAdmin
      .from("payments")
      .insert({
        member_id: memberId,
        charge_id: charge?.id || null,
        amount,
        payment_method: paymentMethod
          ? `Sola ${paymentMethod}`
          : "Sola",
        payment_provider: "sola",
        external_payment_id: refNum,
        payer_email: paymentEmail || null,
        status: "paid",
        note: recurringId
          ? `Sola recurring payment ${recurringId}`
          : "Sola payment",
        paid_at: paidAt,
        sola_recurring_id: recurringId || null,
        receipt_number: receiptNumber,
        raw_provider_response: sanitizePayload(payload),
      });

    if (paymentInsertError) {
      throw new Error(
        `Unable to save payment: ${paymentInsertError.message}`
      );
    }

    if (charge) {
      const { error: chargeUpdateError } = await supabaseAdmin
        .from("member_charges")
        .update({
          status: "paid",
          paid_at: paidAt,
          payment_method: paymentMethod
            ? `Sola ${paymentMethod}`
            : "Sola",
          payment_provider: "sola",
          paid_amount: amount,
          external_payment_id: refNum,
          payment_note: recurringId
            ? `Automatic Sola payment ${recurringId}`
            : "Paid through Sola",
        })
        .eq("id", charge.id);

      if (chargeUpdateError) {
        throw new Error(
          `Payment saved but charge update failed: ${chargeUpdateError.message}`
        );
      }
    }

    console.log("SOLA_WEBHOOK_PAYMENT_RECORDED", {
      refNum,
      memberId,
      chargeId: charge?.id || null,
      amount,
      recurringId: recurringId || null,
    });

    return NextResponse.json({
      received: true,
      approved: true,
      matched: true,
    });
  } catch (error) {
    console.error("SOLA_WEBHOOK_ERROR", error);

    return NextResponse.json(
      {
        received: false,
        error: "Unable to process webhook.",
      },
      { status: 500 }
    );
  }
}