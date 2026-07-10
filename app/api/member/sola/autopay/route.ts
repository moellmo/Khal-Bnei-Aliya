import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  callSolaRecurringApi,
  requireSolaString,
} from "@/lib/solaRecurring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutopayRequestBody = {
  cardToken?: string;
  expiration?: string;
  cardholderName?: string;
  billingZip?: string;
  amount?: number;
  billingDay?: number;
  consent?: boolean;
};

function getNextBillingDate(billingDay: number) {
  const now = new Date();

  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();

  const today = now.getUTCDate();

  /*
   * If this month's selected day has already passed,
   * begin next month.
   */
  if (today >= billingDay) {
    month += 1;
  }

  if (month > 11) {
    month = 0;
    year += 1;
  }

  return `${year}-${String(month + 1).padStart(2, "0")}-${String(
    billingDay
  ).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const { data: member, error: memberError } =
      await supabaseAdmin
        .from("members")
        .select(
          `
            id,
            first_name,
            last_name,
            email,
            phone,
            address,
            status,
            portal_status,
            sola_customer_id,
            sola_payment_method_id,
            sola_recurring_id,
            autopay_active
          `
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!member) {
      return NextResponse.json(
        { error: "Your login is not linked to a member account." },
        { status: 403 }
      );
    }

    if (
      member.portal_status === "disabled" ||
      member.status !== "active"
    ) {
      return NextResponse.json(
        { error: "This member account cannot enroll in autopay." },
        { status: 403 }
      );
    }

    if (member.autopay_active || member.sola_recurring_id) {
      return NextResponse.json(
        { error: "Automatic payments are already active." },
        { status: 409 }
      );
    }

    const body = (await request.json()) as AutopayRequestBody;

    const cardToken = String(body.cardToken || "").trim();

    const expiration = String(body.expiration || "")
      .replace(/\D/g, "")
      .slice(0, 4);

    const cardholderName = String(
      body.cardholderName || ""
    ).trim();

    const billingZip = String(body.billingZip || "").trim();
    const amount = Number(body.amount || 0);
    const billingDay = Number(body.billingDay || 0);
    const consent = body.consent === true;

    if (
      !cardToken ||
      expiration.length !== 4 ||
      !cardholderName ||
      !billingZip
    ) {
      return NextResponse.json(
        { error: "Complete all required card fields." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Enter a valid monthly payment amount." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(billingDay) ||
      billingDay < 1 ||
      billingDay > 28
    ) {
      return NextResponse.json(
        { error: "Choose a billing day between 1 and 28." },
        { status: 400 }
      );
    }

    if (!consent) {
      return NextResponse.json(
        {
          error:
            "You must authorize recurring automatic payments.",
        },
        { status: 400 }
      );
    }

    /*
     * Step 1: create or reuse the Sola customer.
     */
    let customerId = String(
      member.sola_customer_id || ""
    ).trim();

    if (!customerId) {
      const customerResponse = await callSolaRecurringApi(
        "CreateCustomer",
        {
          CustomerNumber: member.id,
          CustomerNotes: "Khal Bnei Aliya member portal",
          Email: member.email || "",
          BillFirstName: member.first_name,
          BillLastName: member.last_name,
          BillPhone: member.phone || "",
          BillStreet: member.address || "",
          CustomerCustom02: member.id,
        }
      );

      customerId = requireSolaString(
        customerResponse,
        "CustomerId"
      );

      const { error: customerSaveError } =
        await supabaseAdmin
          .from("members")
          .update({
            sola_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", member.id);

      if (customerSaveError) {
        throw new Error(customerSaveError.message);
      }
    }

    /*
     * Step 2: save the iFields token as a reusable
     * Sola payment method.
     */
    const paymentMethodResponse =
      await callSolaRecurringApi(
        "CreatePaymentMethod",
        {
          CustomerId: customerId,
          Token: cardToken,
          TokenType: "cc",
          TokenAlias: "Membership Autopay",
          Exp: expiration,
          Name: cardholderName,
          Zip: billingZip,
          SetAsDefault: true,
        }
      );

    const paymentMethodId = requireSolaString(
      paymentMethodResponse,
      "PaymentMethodId"
    );

    const nextBillingDate =
      getNextBillingDate(billingDay);

    /*
     * Step 3: create a monthly Sola schedule.
     *
     * Because StartDate is in the future, enrollment
     * does not charge the member immediately.
     */
    const scheduleResponse = await callSolaRecurringApi(
      "CreateSchedule",
      {
        CustomerId: customerId,
        PaymentMethodId: paymentMethodId,
        Amount: Number(amount.toFixed(2)),
        IntervalType: "month",
        IntervalCount: 1,
        StartDate: nextBillingDate,
        ScheduleName: `KBA Monthly Dues - ${member.first_name} ${member.last_name}`,
        Description: "Khal Bnei Aliya monthly membership dues",
        Invoice: `KBA-AUTOPAY-${member.id}`,
        FailedTransactionRetryTimes: 2,
        DaysBetweenRetries: 1,
        AfterMaxRetriesAction: "ContinueNextInterval",
        SkipSaturdayAndHolidays: true,
        CustReceipt: true,
        CalendarCulture: "Gregorian",
        UseDefaultPaymentMethodOnly: true,
        Custom02: member.id,
      }
    );

    const scheduleId = requireSolaString(
      scheduleResponse,
      "ScheduleId"
    );

    const headerStore = await headers();

    const forwardedFor =
      headerStore.get("x-forwarded-for") || "";

    const consentIp =
      forwardedFor.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      null;

    const now = new Date().toISOString();

    const { error: saveError } = await supabaseAdmin
      .from("members")
      .update({
        sola_customer_id: customerId,
        sola_payment_method_id: paymentMethodId,
        sola_recurring_id: scheduleId,

        autopay_active: true,
        recurring_amount: Number(amount.toFixed(2)),
        recurring_status: "active",
        next_billing_date: nextBillingDate,
        autopay_billing_day: billingDay,

        autopay_consent_at: now,
        autopay_consent_ip: consentIp,
        autopay_terms_version: "2026-07-10",
        autopay_enrolled_at: now,
        autopay_cancelled_at: null,

        updated_at: now,
      })
      .eq("id", member.id);

    if (saveError) {
      /*
       * The Sola schedule exists at this point.
       * Log enough information so it can be reconciled.
       */
      console.error("AUTOPAY_DATABASE_SAVE_ERROR", {
        memberId: member.id,
        customerId,
        paymentMethodId,
        scheduleId,
        error: saveError.message,
      });

      throw new Error(
        "The schedule was created, but the member record could not be updated. Contact the administrator."
      );
    }

    return NextResponse.json({
      success: true,
      customerId,
      paymentMethodId,
      scheduleId,
      nextBillingDate,
      amount: Number(amount.toFixed(2)),
    });
  } catch (error) {
    console.error("MEMBER_AUTOPAY_ENROLLMENT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to enroll in automatic payments.",
      },
      { status: 500 }
    );
  }
}