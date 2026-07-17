import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createAndSendReceipt } from "@/lib/payments/createReceipt";
import { markKiddushReservationPaidAndNotify } from "@/lib/kiddush/reservations";
import { sendPaymentFailureEmail } from "@/lib/payments/sendPaymentFailureEmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookPayload = Record<string, string>;

type MemberRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  sola_customer_id: string | null;
  sola_recurring_id: string | null;
};

type ChargeRecord = {
  id: string;
  member_id: string;
  amount: number;
  status: string | null;
  charge_type: string;
  description: string | null;
  due_date: string | null;
};

function formDataToObject(formData: FormData): WebhookPayload {
  const result: WebhookPayload = {};

  for (const [key, value] of formData.entries()) {
    result[key] = String(value);
  }

  return result;
}

function getField(
  payload: WebhookPayload,
  possibleNames: string[]
) {
  const entries = Object.entries(payload);

  for (const possibleName of possibleNames) {
    const match = entries.find(
      ([key]) =>
        key.toLowerCase() === possibleName.toLowerCase()
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
    normalizedEntries
      .map((entry) => entry.value)
      .join("") + pin;

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

function parsePaidAt(payload: WebhookPayload) {
  const rawDate = getField(payload, [
    "xDate",
    "xTransactionDate",
    "xDateTime",
    "xTimestamp",
  ]);

  if (!rawDate) {
    return new Date().toISOString();
  }

  const normalized = rawDate.includes("T")
    ? rawDate
    : rawDate.replace(" ", "T");

  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function extractChargeId(invoice: string) {
  if (!invoice.startsWith("KBA-")) {
    return null;
  }

  const possibleId = invoice.slice(4).trim();

  if (
    possibleId.startsWith("AUTOPAY-") ||
    !possibleId.includes("-")
  ) {
    return null;
  }

  return possibleId || null;
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

    sanitized[key] = isSensitive
      ? "[REDACTED]"
      : value;
  }

  return sanitized;
}

function getBillingPeriod(paidAt: string) {
  const date = new Date(paidAt);

  return {
    billingMonth: date.getUTCMonth() + 1,
    billingYear: date.getUTCFullYear(),
  };
}

function getMonthName(paidAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(paidAt));
}

async function findChargeByInvoice(
  invoice: string
): Promise<ChargeRecord | null> {
  const chargeId = extractChargeId(invoice);

  if (!chargeId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select(
      `
        id,
        member_id,
        amount,
        status,
        charge_type,
        description,
        due_date
      `
    )
    .eq("id", chargeId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find charge: ${error.message}`
    );
  }

  return (data || null) as ChargeRecord | null;
}

async function findMemberById(
  memberId: string
): Promise<MemberRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      `
        id,
        first_name,
        last_name,
        email,
        sola_customer_id,
        sola_recurring_id
      `
    )
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find member: ${error.message}`
    );
  }

  return (data || null) as MemberRecord | null;
}

async function findMemberByRecurringId(
  recurringId: string
): Promise<MemberRecord | null> {
  if (!recurringId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      `
        id,
        first_name,
        last_name,
        email,
        sola_customer_id,
        sola_recurring_id
      `
    )
    .eq("sola_recurring_id", recurringId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find recurring member: ${error.message}`
    );
  }

  return (data || null) as MemberRecord | null;
}

async function findMemberByCustomerId(
  customerId: string
): Promise<MemberRecord | null> {
  if (!customerId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      `
        id,
        first_name,
        last_name,
        email,
        sola_customer_id,
        sola_recurring_id
      `
    )
    .eq("sola_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find Sola customer: ${error.message}`
    );
  }

  return (data || null) as MemberRecord | null;
}

async function findMatchingUnpaidCharge({
  memberId,
  amount,
}: {
  memberId: string;
  amount: number;
}): Promise<ChargeRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select(
      `
        id,
        member_id,
        amount,
        status,
        charge_type,
        description,
        due_date
      `
    )
    .eq("member_id", memberId)
    .neq("status", "paid")
    .eq("charge_type", "Membership Dues")
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
    })
    .limit(20);

  if (error) {
    throw new Error(
      `Unable to find unpaid dues: ${error.message}`
    );
  }

  const charges = (data || []) as ChargeRecord[];

  return (
  charges.find(
    (charge) =>
      Math.abs(
        Number(charge.amount || 0) - amount
      ) < 0.01
  ) || null
);
}

async function createHistoricalPaidCharge({
  memberId,
  amount,
  paidAt,
  refNum,
}: {
  memberId: string;
  amount: number;
  paidAt: string;
  refNum: string;
}) {
  const { billingMonth, billingYear } =
    getBillingPeriod(paidAt);

  const monthName = getMonthName(paidAt);

  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .insert({
      member_id: memberId,
      charge_type: "Membership Dues",
      description:
        `${monthName} ${billingYear} recurring membership payment`,
      amount,
      status: "paid",
      due_date: paidAt.slice(0, 10),
      paid_at: paidAt,
      payment_method: "Card",
      payment_provider: "sola",
      paid_amount: amount,
      external_payment_id: refNum,
      payment_note:
        "Paid by Sola recurring automatic payment",
      billing_month: billingMonth,
      billing_year: billingYear,
    })
    .select(
      `
        id,
        member_id,
        amount,
        status,
        charge_type,
        description,
        due_date
      `
    )
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Unable to create recurring charge."
    );
  }

  return data as ChargeRecord;
}

async function writeSyncLog({
  memberId,
  scheduleId,
  customerId,
  externalPaymentId,
  eventType,
  status,
  message,
  payload,
}: {
  memberId?: string | null;
  scheduleId?: string | null;
  customerId?: string | null;
  externalPaymentId?: string | null;
  eventType: string;
  status: string;
  message?: string | null;
  payload: Record<string, string>;
}) {
  const { error } = await supabaseAdmin
    .from("sola_recurring_sync_log")
    .insert({
      member_id: memberId || null,
      sola_schedule_id: scheduleId || null,
      sola_customer_id: customerId || null,
      external_payment_id:
        externalPaymentId || null,
      event_type: eventType,
      status,
      message: message || null,
      raw_payload: payload,
    });

  if (error) {
    console.error(
      "SOLA_SYNC_LOG_ERROR",
      error.message
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Sola webhook endpoint is online.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const webhookPin =
      process.env.SOLA_WEBHOOK_PIN;

    if (!webhookPin) {
      console.error(
        "SOLA_WEBHOOK_PIN is missing."
      );

      return NextResponse.json(
        {
          received: false,
          error:
            "Webhook configuration is missing.",
        },
        { status: 500 }
      );
    }

    const signature =
      request.headers.get("ck-signature") || "";

    if (!signature) {
      console.warn(
        "Sola webhook rejected: missing ck-signature."
      );

      return NextResponse.json(
        {
          received: false,
          error: "Missing signature.",
        },
        { status: 401 }
      );
    }

    const contentType =
      request.headers.get("content-type") || "";

    if (
      !contentType.includes(
        "application/x-www-form-urlencoded"
      ) &&
      !contentType.includes(
        "multipart/form-data"
      )
    ) {
      return NextResponse.json(
        {
          received: false,
          error:
            "Unsupported webhook content type.",
        },
        { status: 415 }
      );
    }

    const formData = await request.formData();
    const payload = formDataToObject(formData);
    const sanitizedPayload =
      sanitizePayload(payload);

    const signatureValid =
      verifyWebhookSignature({
        payload,
        signature,
        pin: webhookPin,
      });

    if (!signatureValid) {
      console.warn(
        "Sola webhook rejected: invalid signature."
      );

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
          error:
            "Missing transaction reference.",
        },
        { status: 400 }
      );
    }

    const scheduleId = getField(payload, [
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

    const recurringTransactionId =
      getField(payload, [
        "xRecurringTransactionId",
        "xRecurringTransactionID",
        "xScheduleTransactionId",
        "xScheduleTransactionID",
      ]);

    const isRecurring = Boolean(
      scheduleId || recurringTransactionId
    );

    /*
     * Check whether this approved transaction was
     * already saved.
     */
    const {
      data: existingPayment,
      error: duplicateCheckError,
    } = await supabaseAdmin
      .from("payments")
      .select("id")
      .or(
        recurringTransactionId
          ? `external_payment_id.eq.${refNum},sola_transaction_id.eq.${recurringTransactionId}`
          : `external_payment_id.eq.${refNum}`
      )
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

    /*
     * Handle declined or otherwise unsuccessful
     * payment attempts.
     */
    if (!isApprovedPayment(payload)) {
      const amount = parseAmount(payload);

      const failureCode = getField(payload, [
        "xErrorCode",
        "xResponseCode",
        "xResultCode",
        "xDeclineCode",
      ]);

      const failureMessage =
        getField(payload, [
          "xError",
          "xErrorMessage",
          "xMessage",
          "xResponseMessage",
          "xStatus",
        ]) ||
        "The payment was not approved.";

      let failedMember: MemberRecord | null =
        null;

      if (scheduleId) {
        failedMember =
          await findMemberByRecurringId(
            scheduleId
          );
      }

      if (!failedMember && customerId) {
        failedMember =
          await findMemberByCustomerId(
            customerId
          );
      }

      let failedCharge: ChargeRecord | null =
        null;

      if (failedMember && amount > 0) {
        failedCharge =
          await findMatchingUnpaidCharge({
            memberId: failedMember.id,
            amount,
          });
      }

      const attemptedAt =
        parsePaidAt(payload);

      const {
        data: existingAttempt,
        error: attemptLookupError,
      } = await supabaseAdmin
        .from("payment_attempts")
        .select("id, member_notified_at")
        .eq("external_payment_id", refNum)
        .maybeSingle();

      if (attemptLookupError) {
        throw new Error(
          `Unable to check failed payment attempt: ${attemptLookupError.message}`
        );
      }

      let attemptId: string | null =
        existingAttempt?.id || null;

      let memberNotifiedAt: string | null =
        existingAttempt?.member_notified_at ||
        null;

      if (!existingAttempt) {
        const {
          data: savedAttempt,
          error: attemptInsertError,
        } = await supabaseAdmin
          .from("payment_attempts")
          .insert({
            member_id:
              failedMember?.id || null,

            charge_id:
              failedCharge?.id || null,

            sola_schedule_id:
              scheduleId || null,

            sola_customer_id:
              customerId ||
              failedMember?.sola_customer_id ||
              null,

            external_payment_id: refNum,

            amount:
              amount > 0 ? amount : 0,

            status: "failed",

            failure_code:
              failureCode || null,

            failure_message:
              failureMessage,

            attempted_at: attemptedAt,

            raw_provider_response:
              sanitizedPayload,
          })
          .select("id")
          .single();

        if (
          attemptInsertError ||
          !savedAttempt
        ) {
          throw new Error(
            attemptInsertError?.message ||
              "Unable to save the failed payment attempt."
          );
        }

        attemptId = savedAttempt.id;
      }

      const failedMemberId =
        failedMember?.id || null;

      const failedMemberEmail =
        failedMember?.email || null;

      const failedMemberFirstName =
        failedMember?.first_name || "";

      if (
        !existingAttempt &&
        attemptId &&
        failedMemberId &&
        failedMemberEmail &&
        amount > 0
      ) {
        try {
          const emailResult =
            await sendPaymentFailureEmail({
              recipient:
                failedMemberEmail,

              firstName:
                failedMemberFirstName,

              amount,
              failureMessage,
            });

          if (emailResult.sent) {
            memberNotifiedAt =
              new Date().toISOString();

            const {
              error:
                notificationUpdateError,
            } = await supabaseAdmin
              .from("payment_attempts")
              .update({
                member_notified_at:
                  memberNotifiedAt,
              })
              .eq("id", attemptId);

            if (
              notificationUpdateError
            ) {
              console.error(
                "PAYMENT_ATTEMPT_NOTIFICATION_UPDATE_ERROR",
                notificationUpdateError.message
              );
            }
          }
        } catch (emailError) {
          console.error(
            "PAYMENT_FAILURE_EMAIL_ERROR",
            {
              attemptId,
              memberId:
                failedMemberId,
              refNum,
              error:
                emailError instanceof Error
                  ? emailError.message
                  : String(emailError),
            }
          );
        }
      }

      await writeSyncLog({
        memberId: failedMemberId,
        scheduleId,
        customerId:
          customerId ||
          failedMember?.sola_customer_id ||
          null,

        externalPaymentId: refNum,

        eventType: isRecurring
          ? "recurring_payment"
          : "payment",

        status: failedMember
          ? "failed"
          : "failed_unmatched",

        message: failureMessage,
        payload: sanitizedPayload,
      });

      console.log(
        "SOLA_WEBHOOK_PAYMENT_FAILED",
        {
          refNum,
          amount,
          scheduleId:
            scheduleId || null,
          customerId:
            customerId || null,
          memberId:
            failedMemberId,
          chargeId:
            failedCharge?.id || null,
          failureCode:
            failureCode || null,
          failureMessage,
          memberNotified:
            Boolean(memberNotifiedAt),
        }
      );

      /*
       * Return 200 so Sola knows the event
       * was successfully received.
       */
      return NextResponse.json({
        received: true,
        approved: false,
        matched:
          Boolean(failedMemberId),
        attemptRecorded:
          Boolean(attemptId),
        memberNotified:
          Boolean(memberNotifiedAt),
      });
    }

    /*
     * From here onward, process an approved
     * payment.
     */
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

    const invoice = getField(payload, [
      "xInvoice",
    ]);
    const providerDescription = getField(payload, [
      "xDescription",
      "xMemo",
      "xNote",
      "xComments",
    ]);

    const paymentEmail = getField(payload, [
      "xEmail",
      "xBillEmail",
      "xCustomerEmail",
    ]);

    const cardType = getField(payload, [
      "xCardType",
      "xPaymentMethod",
    ]);

    let charge =
      await findChargeByInvoice(invoice);

    let member: MemberRecord | null = null;

    if (charge) {
      member = await findMemberById(
        charge.member_id
      );
    }

    if (!member && scheduleId) {
      member =
        await findMemberByRecurringId(
          scheduleId
        );
    }

    if (!member && customerId) {
      member =
        await findMemberByCustomerId(
          customerId
        );
    }

    if (!member) {
      await writeSyncLog({
        scheduleId,
        customerId,
        externalPaymentId: refNum,

        eventType: isRecurring
          ? "recurring_payment"
          : "payment",

        status: "unmatched",

        message:
          "Unable to match payment to a member.",

        payload: sanitizedPayload,
      });

      console.error(
        "SOLA_WEBHOOK_UNMATCHED_PAYMENT",
        {
          refNum,
          amount,
          invoice,
          scheduleId,
          customerId,
          payload: sanitizedPayload,
        }
      );

      return NextResponse.json({
        received: true,
        approved: true,
        matched: false,
      });
    }

    if (!charge && isRecurring) {
      charge =
        await findMatchingUnpaidCharge({
          memberId: member.id,
          amount,
        });
    }

    const paidAt = parsePaidAt(payload);

    if (!charge && isRecurring) {
      charge =
        await createHistoricalPaidCharge({
          memberId: member.id,
          amount,
          paidAt,
          refNum,
        });
    }

    const receiptNumber =
      `KBA-${paidAt
        .slice(0, 10)
        .replaceAll("-", "")}-${refNum}`;

    const {
      data: payment,
      error: paymentInsertError,
    } = await supabaseAdmin
      .from("payments")
      .insert({
        member_id: member.id,
        charge_id: charge?.id || null,
        amount,

        payment_method: cardType
          ? `Sola ${cardType}`
          : "Card",

        payment_provider: "sola",
        external_payment_id: refNum,

        payer_email:
          paymentEmail ||
          member.email ||
          null,

        status: "paid",

        note: isRecurring
          ? `Sola recurring automatic payment${
              scheduleId
                ? ` ${scheduleId}`
                : ""
            }`
          : "Sola payment",

        paid_at: paidAt,
        receipt_number: receiptNumber,

        sola_recurring_id:
          scheduleId || null,

        sola_schedule_id:
          scheduleId || null,

        sola_customer_id:
          customerId ||
          member.sola_customer_id ||
          null,

        sola_transaction_id:
          recurringTransactionId || null,

        recurring_payment: isRecurring,

        webhook_received_at:
          new Date().toISOString(),

        receipt_email_status:
          "pending",

        raw_provider_response:
          sanitizedPayload,
      })
      .select("id")
      .single();

    if (paymentInsertError || !payment) {
      throw new Error(
        paymentInsertError?.message ||
          "Unable to save payment."
      );
    }

    if (charge) {
  const {
    error: chargeUpdateError,
  } = await supabaseAdmin
    .from("member_charges")
    .update({
      status: "paid",
      paid_at: paidAt,

      payment_method: cardType
        ? `Sola ${cardType}`
        : "Card",

      payment_provider: "sola",
      paid_amount: amount,

      external_payment_id:
        refNum,

      payment_note: isRecurring
        ? `Automatic Sola payment ${scheduleId}`
        : "Paid through Sola",
    })
    .eq("id", charge.id);

  if (chargeUpdateError) {
    throw new Error(
      `Payment saved but charge update failed: ${chargeUpdateError.message}`
    );
  }

  /*
   * Mark any earlier failed attempt for this charge as resolved
   * now that the charge has been paid successfully.
   */
  const { error: resolveAttemptError } =
    await supabaseAdmin
      .from("payment_attempts")
      .update({
        status: "resolved",
        resolved_at: paidAt,
      })
      .eq("member_id", member.id)
      .eq("charge_id", charge.id)
      .eq("status", "failed")
      .is("resolved_at", null);

  if (resolveAttemptError) {
    console.error(
      "PAYMENT_ATTEMPT_RESOLVE_ERROR",
      resolveAttemptError.message
    );
  }
}

    await markKiddushReservationPaidAndNotify({
      note: [providerDescription, invoice].filter(Boolean).join(" "),
      reference: refNum,
      chargeId: charge?.id || null,
    });

    let receiptGenerated = false;
let receiptErrorMessage: string | null = null;

try {
  await createAndSendReceipt({
    paymentId: payment.id,
    emailOverride:
      paymentEmail ||
      member.email ||
      undefined,
  });

  receiptGenerated = true;

  const { error: receiptStatusError } =
    await supabaseAdmin
      .from("payments")
      .update({
        receipt_email_status: "sent",
      })
      .eq("id", payment.id);

  if (receiptStatusError) {
    console.error(
      "RECEIPT_STATUS_UPDATE_ERROR",
      receiptStatusError.message
    );
  }
} catch (receiptError) {
  receiptErrorMessage =
    receiptError instanceof Error
      ? receiptError.message
      : "Unable to generate or email receipt.";

  console.error(
    "SOLA_WEBHOOK_RECEIPT_ERROR",
    {
      paymentId: payment.id,
      memberId: member.id,
      scheduleId,
      error: receiptErrorMessage,
    }
  );

  const { error: statusUpdateError } =
    await supabaseAdmin
      .from("payments")
      .update({
        receipt_email_status: "failed",
      })
      .eq("id", payment.id);

  if (statusUpdateError) {
    console.error(
      "RECEIPT_STATUS_UPDATE_ERROR",
      statusUpdateError.message
    );
  }
}

    await writeSyncLog({
      memberId: member.id,
      scheduleId,

      customerId:
        customerId ||
        member.sola_customer_id,

      externalPaymentId: refNum,

      eventType: isRecurring
        ? "recurring_payment"
        : "payment",

      status: "recorded",

      message: receiptGenerated
        ? "Payment and receipt recorded."
        : `Payment recorded; receipt issue: ${
            receiptErrorMessage ||
            "unknown"
          }`,

      payload: sanitizedPayload,
    });

    console.log(
      "SOLA_WEBHOOK_PAYMENT_RECORDED",
      {
        refNum,
        paymentId: payment.id,
        memberId: member.id,
        chargeId:
          charge?.id || null,
        amount,
        scheduleId:
          scheduleId || null,
        recurring: isRecurring,
        receiptGenerated,
      }
    );

    return NextResponse.json({
      received: true,
      approved: true,
      matched: true,
      recurring: isRecurring,
      paymentId: payment.id,
      receiptGenerated,
    });
  } catch (error) {
    console.error(
      "SOLA_WEBHOOK_ERROR",
      error
    );

    return NextResponse.json(
      {
        received: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process webhook.",
      },
      { status: 500 }
    );
  }
}
