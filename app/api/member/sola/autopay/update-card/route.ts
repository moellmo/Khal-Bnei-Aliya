import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  callSolaRecurringApi,
  requireSolaString,
} from "@/lib/solaRecurring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateCardRequest = {
  cardToken?: string;
  expiration?: string;
  cardholderName?: string;
  billingZip?: string;
};

function getNumberValue(
  response: Record<string, unknown>,
  key: string
) {
  const value = Number(response[key]);

  if (!Number.isFinite(value)) {
    throw new Error(`Sola did not return a valid ${key}.`);
  }

  return value;
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
            status,
            portal_status,
            sola_customer_id,
            sola_payment_method_id,
            sola_recurring_id
          `
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!member) {
      return NextResponse.json(
        { error: "Member account not found." },
        { status: 404 }
      );
    }

    if (
      member.portal_status === "disabled" ||
      member.status !== "active"
    ) {
      return NextResponse.json(
        {
          error:
            "This account cannot update automatic payments.",
        },
        { status: 403 }
      );
    }

    if (!member.sola_customer_id) {
      return NextResponse.json(
        {
          error:
            "No Sola customer is linked to this member account.",
        },
        { status: 409 }
      );
    }

    if (!member.sola_recurring_id) {
      return NextResponse.json(
        {
          error:
            "No recurring schedule is linked to this member account.",
        },
        { status: 409 }
      );
    }

    const body = (await request.json()) as UpdateCardRequest;

    const cardToken = String(body.cardToken || "").trim();

    const expiration = String(body.expiration || "")
      .replace(/\D/g, "")
      .slice(0, 4);

    const cardholderName = String(
      body.cardholderName || ""
    ).trim();

    const billingZip = String(
      body.billingZip || ""
    ).trim();

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

    const paymentMethodResponse =
      await callSolaRecurringApi(
        "CreatePaymentMethod",
        {
          CustomerId: member.sola_customer_id,
          Token: cardToken,
          TokenType: "cc",
          TokenAlias: "Membership Autopay",
          Exp: expiration,
          Name: cardholderName,
          Zip: billingZip,
          SetAsDefault: true,
        }
      );

    const newPaymentMethodId = requireSolaString(
      paymentMethodResponse,
      "PaymentMethodId"
    );

    const scheduleResponse =
      await callSolaRecurringApi("GetSchedule", {
        ScheduleId: member.sola_recurring_id,
      });

    const scheduleId = requireSolaString(
      scheduleResponse,
      "ScheduleId"
    );

    const revision = getNumberValue(
      scheduleResponse,
      "Revision"
    );

    await callSolaRecurringApi("UpdateSchedule", {
      ScheduleId: scheduleId,
      Revision: revision,
      PaymentMethodId: newPaymentMethodId,
    });

    const { error: updateError } = await supabaseAdmin
      .from("members")
      .update({
        sola_payment_method_id: newPaymentMethodId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (updateError) {
      console.error("UPDATE_CARD_DATABASE_SAVE_ERROR", {
        memberId: member.id,
        scheduleId,
        newPaymentMethodId,
        error: updateError.message,
      });

      throw new Error(
        "The card was updated in Sola, but the member record could not be updated."
      );
    }

    return NextResponse.json({
      success: true,
      paymentMethodId: newPaymentMethodId,
    });
  } catch (error) {
    console.error(
      "MEMBER_AUTOPAY_UPDATE_CARD_ERROR",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to replace the saved card.",
      },
      { status: 500 }
    );
  }
}