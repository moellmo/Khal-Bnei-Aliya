"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { callSolaRecurringApi } from "@/lib/solaRecurring";
import {
  callSolaReportingApi,
  parseSolaReportRows,
  type SolaReportRow,
} from "@/lib/solaReporting";
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

type HistoricalImportMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  sola_customer_id: string | null;
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

  const directDate = new Date(value);

  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString();
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

function rowValue(row: SolaReportRow, ...keys: string[]) {
  const entries = Object.entries(row);

  for (const key of keys) {
    const match = entries.find(
      ([entryKey]) => entryKey.toLowerCase() === key.toLowerCase()
    );

    if (match) {
      return String(match[1] || "").trim();
    }
  }

  return "";
}

function normalizeLookup(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function memberName(member: HistoricalImportMember) {
  return [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
}

function matchHistoricalMember(
  row: SolaReportRow,
  members: HistoricalImportMember[]
) {
  const email = normalizeLookup(rowValue(row, "xEmail", "Email"));
  const customerId = rowValue(row, "xCustId", "xCustomerId", "CustomerId");
  const name = normalizeLookup(rowValue(row, "xName", "Name"));

  if (email) {
    const byEmail = members.find(
      (member) => normalizeLookup(member.email) === email
    );
    if (byEmail) return byEmail;
  }

  if (customerId) {
    const byCustomerId = members.find(
      (member) => String(member.sola_customer_id || "") === customerId
    );
    if (byCustomerId) return byCustomerId;
  }

  if (name) {
    return (
      members.find((member) =>
        normalizeLookup(memberName(member)).includes(name)
      ) ||
      members.find((member) =>
        name.includes(normalizeLookup(memberName(member)))
      ) ||
      null
    );
  }

  return null;
}

function isApprovedSale(row: SolaReportRow) {
  const command = rowValue(row, "xCommand", "Command").toLowerCase();
  const status = rowValue(row, "xStatus", "Status").toLowerCase();
  const result = rowValue(
    row,
    "xResponseResult",
    "xResult",
    "ResponseResult",
    "Result"
  ).toLowerCase();

  return (
    command.includes("sale") &&
    !command.includes("refund") &&
    !command.includes("void") &&
    (status === "approved" || result === "a" || result === "approved")
  );
}

function reportRowsFromResponse(response: Record<string, unknown>) {
  return parseSolaReportRows(
    response.xReportData ||
      response.XReportData ||
      response.ReportData ||
      response.reportData
  );
}

function parseDateInput(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function getSolaReportDateChunks(fromDate: string, toDate: string) {
  const startDate = parseDateInput(fromDate);
  const endDate = parseDateInput(toDate);

  if (!startDate || !endDate || startDate > endDate) {
    throw new Error("Choose a valid Sola import date range.");
  }

  const chunks: { fromDate: string; toDate: string }[] = [];
  let chunkStart = startDate;

  while (chunkStart <= endDate) {
    const maxChunkEnd = addUtcDays(chunkStart, 99);
    const chunkEnd = maxChunkEnd < endDate ? maxChunkEnd : endDate;

    chunks.push({
      fromDate: formatDateInput(chunkStart),
      toDate: formatDateInput(chunkEnd),
    });

    chunkStart = addUtcDays(chunkEnd, 1);
  }

  return chunks;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to import previous Sola payments.";
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

export async function syncHistoricalSolaPayments(formData: FormData) {
  await requireAdmin();

  const fromDate = getString(formData, "from_date");
  const toDate = getString(formData, "to_date");

  if (!fromDate || !toDate) {
    redirect(
      `/admin/recurring-schedules?error=${encodeURIComponent(
        "Choose a from date and to date for the Sola payment import."
      )}`
    );
  }

  let importedCount = 0;
  let skippedCount = 0;
  let unmatchedCount = 0;

  try {
    const { data: members, error: membersError } = await supabaseAdmin
      .from("members")
      .select("id, first_name, last_name, email, sola_customer_id")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (membersError) {
      throw new Error(membersError.message);
    }

    const memberRows = (members || []) as HistoricalImportMember[];
    const dateChunks = getSolaReportDateChunks(fromDate, toDate);
    const rows: SolaReportRow[] = [];

    for (const chunk of dateChunks) {
      const response = await callSolaReportingApi({
        xCommand: "report:approved",
        xGetNewest: "false",
        xgetnewest: "false",
        xMaxRecords: 1000,
        xmaxrecords: 1000,
        xBeginDate: chunk.fromDate,
        xEndDate: chunk.toDate,
        xFields:
          "xRefNum,xCommand,xName,xEmail,xAmount,xEnteredDate,xStatus,xResponseResult,xMaskedCardNumber,xCardType,xAuthCode,xInvoice,xDescription,xCustId,xCustID,xCustomerId",
      });

      rows.push(...reportRowsFromResponse(response));
    }

    for (const row of rows) {
      if (!isApprovedSale(row)) {
        skippedCount += 1;
        continue;
      }

      const reference = rowValue(row, "xRefNum", "RefNum");
      const amount = Number(rowValue(row, "xAmount", "Amount") || 0);

      if (!reference || !Number.isFinite(amount) || amount <= 0) {
        skippedCount += 1;
        continue;
      }

      const { data: existingPayments, error: existingError } =
        await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("external_payment_id", reference)
        .limit(1);

      if (existingError) {
        throw new Error(existingError.message);
      }

      if ((existingPayments || []).length > 0) {
        skippedCount += 1;
        continue;
      }

      const member = matchHistoricalMember(row, memberRows);

      if (!member) {
        unmatchedCount += 1;
        continue;
      }

      const paidAt = parseSolaDate(
        rowValue(row, "xEnteredDate", "EnteredDate", "TransactionDate")
      );
      const paidDate = paidAt.slice(0, 10);
      const description =
        rowValue(row, "xDescription", "Description", "xInvoice", "Invoice") ||
        "Historical Sola payment";
      const receiptNumber = `KBA-${paidDate.replaceAll("-", "")}-${reference}`;

      const { data: charge, error: chargeError } = await supabaseAdmin
        .from("member_charges")
        .insert({
          member_id: member.id,
          charge_type: "Sola Payment",
          description,
          amount,
          status: "paid",
          due_date: paidDate,
          paid_at: paidAt,
          payment_method: "Card",
          payment_provider: "sola",
          paid_amount: amount,
          external_payment_id: reference,
          payment_note: "Imported from Sola Reporting API",
        })
        .select("id")
        .single();

      if (chargeError || !charge) {
        throw new Error(
          chargeError?.message || "Unable to create imported Sola charge."
        );
      }

      const { error: paymentError } = await supabaseAdmin
        .from("payments")
        .insert({
          member_id: member.id,
          charge_id: charge.id,
          amount,
          payment_method: "Card",
          payment_provider: "sola",
          external_payment_id: reference,
          payer_email: rowValue(row, "xEmail", "Email") || member.email,
          status: "paid",
          note: "Imported historical Sola payment",
          paid_at: paidAt,
          receipt_number: receiptNumber,
          raw_provider_response: row,
        });

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      importedCount += 1;
    }
  } catch (error) {
    redirect(
      `/admin/recurring-schedules?error=${encodeURIComponent(
        errorMessage(error)
      )}`
    );
  }

  revalidatePath("/admin/recurring-schedules");
  revalidatePath("/admin/accounting");
  revalidatePath("/admin/members");

  redirect(
    `/admin/recurring-schedules?historicalSynced=1&historicalImported=${importedCount}&historicalSkipped=${skippedCount}&historicalUnmatched=${unmatchedCount}`
  );
}
