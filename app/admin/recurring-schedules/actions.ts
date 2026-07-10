"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { callSolaRecurringApi } from "@/lib/solaRecurring";
import { createAndSendReceipt } from "@/lib/payments/createReceipt";

type SolaTransaction = {
  TransactionId?: string;
  ScheduleId?: string;
  CustomerId?: string;
  PaymentMethodId?: string;
  TransactionDate?: string;
  GatewayRefNum?: string;
  GatewayRefnum?: string;
  GatewayStatus?: string;
  GatewayError?: string;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getBoolean(formData: FormData, key: string) {
  const value = getString(formData, key).toLowerCase();

  return (
    value === "true" ||
    value === "1" ||
    value === "yes" ||
    value === "active"
  );
}

function parseObjectArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item)
    );
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) &&
            typeof item === "object" &&
            !Array.isArray(item)
        );
      }
    } catch {
      return [];
    }
  }

  return [];
}

function parseSolaDate(value: string | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T");

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function getBillingPeriod(value: string) {
  const date = new Date(value);

  return {
    billingMonth: date.getUTCMonth() + 1,
    billingYear: date.getUTCFullYear(),
  };
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: member, error: memberError } =
    await supabaseAdmin
      .from("members")
      .select("id, portal_role, portal_status")
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (
    !member ||
    member.portal_role !== "admin" ||
    member.portal_status === "disabled"
  ) {
    redirect("/member/dashboard");
  }

  return member;
}

function refreshPages(memberId?: string) {
  revalidatePath("/admin/recurring-schedules");
  revalidatePath("/admin/members");
  revalidatePath("/admin/accounting");

  if (memberId) {
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath(`/admin/members/${memberId}/payments`);
  }

  revalidatePath("/member/dashboard");
}

export async function linkRecurringSchedule(formData: FormData) {
  await requireAdmin();

  const memberId = getString(formData, "member_id");
  const scheduleId = getString(formData, "schedule_id");
  const customerId = getString(formData, "customer_id");
  const paymentMethodId = getString(
    formData,
    "payment_method_id"
  );

  const amount = getNumber(formData, "amount");
  const nextBillingDate =
    getString(formData, "next_billing_date") || null;

  const isActive = getBoolean(formData, "is_active");
  const status = getString(formData, "schedule_status");

  if (!memberId || !scheduleId) {
    redirect(
      `/admin/recurring-schedules?error=${encodeURIComponent(
        "Choose a member and a valid Sola schedule."
      )}`
    );
  }

  const { data: member, error: memberError } =
    await supabaseAdmin
      .from("members")
      .select("id")
      .eq("id", memberId)
      .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error("Member not found.");
  }

  /*
   * Prevent one Sola schedule from being connected
   * to multiple member records.
   */
  const { data: existingLink, error: linkLookupError } =
    await supabaseAdmin
      .from("members")
      .select("id, first_name, last_name")
      .eq("sola_recurring_id", scheduleId)
      .neq("id", memberId)
      .maybeSingle();

  if (linkLookupError) {
    throw new Error(linkLookupError.message);
  }

  if (existingLink) {
    redirect(
      `/admin/recurring-schedules?error=${encodeURIComponent(
        `This schedule is already linked to ${existingLink.first_name} ${existingLink.last_name}.`
      )}`
    );
  }

  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("members")
    .update({
      sola_customer_id: customerId || null,
      sola_payment_method_id: paymentMethodId || null,
      sola_recurring_id: scheduleId,

      autopay_active: isActive,
      recurring_amount: amount > 0 ? amount : 0,
      recurring_status:
        status ||
        (isActive ? "active" : "inactive"),

      next_billing_date: nextBillingDate,
      autopay_enrolled_at: isActive ? now : null,

      updated_at: now,
    })
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  refreshPages(memberId);

  redirect(
    `/admin/recurring-schedules?linked=1&memberId=${encodeURIComponent(
      memberId
    )}`
  );
}

export async function unlinkRecurringSchedule(formData: FormData) {
  await requireAdmin();

  const memberId = getString(formData, "member_id");

  if (!memberId) {
    throw new Error("Member ID is required.");
  }

  const { error } = await supabaseAdmin
    .from("members")
    .update({
      sola_customer_id: null,
      sola_payment_method_id: null,
      sola_recurring_id: null,

      autopay_active: false,
      recurring_status: "unlinked",
      next_billing_date: null,

      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }

  refreshPages(memberId);

  redirect("/admin/recurring-schedules?unlinked=1");
}

export async function syncRecurringPayments(formData: FormData) {
  await requireAdmin();

  const memberId = getString(formData, "member_id");
  const scheduleId = getString(formData, "schedule_id");
  const customerId = getString(formData, "customer_id");
  const amount = getNumber(formData, "amount");

  if (!memberId || !scheduleId) {
    redirect(
      `/admin/recurring-schedules?error=${encodeURIComponent(
        "Link this schedule to a member before syncing payments."
      )}`
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(
      `/admin/recurring-schedules?error=${encodeURIComponent(
        "The schedule amount is invalid."
      )}`
    );
  }

  const { data: member, error: memberError } =
    await supabaseAdmin
      .from("members")
      .select("id, first_name, last_name, email")
      .eq("id", memberId)
      .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    throw new Error("Member not found.");
  }

  const transactionResponse =
    await callSolaRecurringApi("ListTransactions", {
      PageSize: 500,
      SortOrder: "Ascending",
      Filters: {
        ScheduleId: scheduleId,
        IsApproved: true,
      },
    });

  const transactions = parseObjectArray(
    transactionResponse.Transactions
  ) as SolaTransaction[];

  let importedCount = 0;
  let skippedCount = 0;
  let receiptErrorCount = 0;

  for (const transaction of transactions) {
    const transactionId = String(
      transaction.TransactionId || ""
    ).trim();

    const gatewayReference = String(
      transaction.GatewayRefNum ||
        transaction.GatewayRefnum ||
        ""
    ).trim();

    const gatewayStatus = String(
      transaction.GatewayStatus || ""
    ).trim();

    if (
      !transactionId ||
      !gatewayReference ||
      gatewayStatus.toLowerCase() !== "approved"
    ) {
      skippedCount += 1;
      continue;
    }

    const { data: existingPayment, error: existingError } =
      await supabaseAdmin
        .from("payments")
        .select("id")
        .or(
          `sola_transaction_id.eq.${transactionId},external_payment_id.eq.${gatewayReference}`
        )
        .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingPayment) {
      skippedCount += 1;
      continue;
    }

    const paidAt = parseSolaDate(
      transaction.TransactionDate
    );

    const { billingMonth, billingYear } =
      getBillingPeriod(paidAt);

    /*
     * First try to attach this recurring payment to an
     * existing unpaid monthly membership-dues charge.
     */
    const { data: openCharges, error: chargeLookupError } =
      await supabaseAdmin
        .from("member_charges")
        .select("id, amount")
        .eq("member_id", memberId)
        .eq("charge_type", "Membership Dues")
        .neq("status", "paid")
        .order("due_date", {
          ascending: true,
          nullsFirst: false,
        })
        .limit(20);

    if (chargeLookupError) {
      throw new Error(chargeLookupError.message);
    }

    const matchingCharge =
      (openCharges || []).find(
        (charge) =>
          Math.abs(Number(charge.amount || 0) - amount) <
          0.01
      ) || openCharges?.[0];

    let chargeId = matchingCharge?.id || "";

    /*
     * Historical Sola transactions may predate the charges
     * stored in this app. Create a paid charge so the payment
     * and receipt still have a proper description.
     */
    if (!chargeId) {
      const paidDate = new Date(paidAt);

      const monthName = new Intl.DateTimeFormat(
        "en-US",
        {
          month: "long",
          timeZone: "UTC",
        }
      ).format(paidDate);

      const { data: createdCharge, error: createChargeError } =
        await supabaseAdmin
          .from("member_charges")
          .insert({
            member_id: memberId,
            charge_type: "Membership Dues",
            description: `${monthName} ${billingYear} recurring membership payment`,
            amount,
            status: "paid",
            due_date: paidAt.slice(0, 10),
            paid_at: paidAt,
            payment_method: "Card",
            payment_provider: "sola",
            paid_amount: amount,
            external_payment_id: gatewayReference,
            payment_note:
              "Imported from existing Sola recurring schedule",
            billing_month: billingMonth,
            billing_year: billingYear,
          })
          .select("id")
          .single();

      if (createChargeError || !createdCharge) {
        throw new Error(
          createChargeError?.message ||
            "Unable to create the recurring charge."
        );
      }

      chargeId = createdCharge.id;
    }

    const receiptNumber =
      `KBA-${paidAt
        .slice(0, 10)
        .replaceAll("-", "")}-${gatewayReference}`;

    const { data: payment, error: paymentError } =
      await supabaseAdmin
        .from("payments")
        .insert({
          member_id: memberId,
          charge_id: chargeId,
          amount,

          payment_method: "Card",
          payment_provider: "sola",
          external_payment_id: gatewayReference,

          payer_email: member.email || null,
          status: "paid",
          note: "Sola recurring automatic payment",
          paid_at: paidAt,

          receipt_number: receiptNumber,

          sola_recurring_id: scheduleId,
          sola_schedule_id: scheduleId,
          sola_customer_id:
            transaction.CustomerId || customerId || null,

          sola_transaction_id: transactionId,
          recurring_payment: true,

          raw_provider_response: transaction,
        })
        .select("id")
        .single();

    if (paymentError || !payment) {
      throw new Error(
        paymentError?.message ||
          "Unable to save the recurring payment."
      );
    }

    const { error: updateChargeError } =
      await supabaseAdmin
        .from("member_charges")
        .update({
          status: "paid",
          paid_at: paidAt,
          payment_method: "Card",
          payment_provider: "sola",
          paid_amount: amount,
          external_payment_id: gatewayReference,
          payment_note:
            "Paid by Sola recurring automatic payment",
        })
        .eq("id", chargeId);

    if (updateChargeError) {
      throw new Error(updateChargeError.message);
    }

    /*
     * Receipt failure must never erase the imported payment.
     */
    try {
      await createAndSendReceipt({
        paymentId: payment.id,
        emailOverride: member.email || undefined,
      });

      await supabaseAdmin
        .from("payments")
        .update({
          receipt_email_status: "sent",
        })
        .eq("id", payment.id);
    } catch (receiptError) {
      receiptErrorCount += 1;

      console.error(
        "RECURRING_PAYMENT_RECEIPT_ERROR",
        {
          paymentId: payment.id,
          memberId,
          scheduleId,
          error: receiptError,
        }
      );

      await supabaseAdmin
        .from("payments")
        .update({
          receipt_email_status: "failed",
        })
        .eq("id", payment.id);
    }

    importedCount += 1;
  }

  refreshPages(memberId);

  redirect(
    `/admin/recurring-schedules?synced=1&imported=${importedCount}&skipped=${skippedCount}&receiptErrors=${receiptErrorCount}`
  );
}