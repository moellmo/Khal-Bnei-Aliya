import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  callSolaRecurringApi,
  requireSolaString,
} from "@/lib/solaRecurring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManageRequest = {
  action?: "pause" | "resume" | "update_amount" | "cancel";
  amount?: number;
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

async function getSignedInMember() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      ),
      member: null,
    };
  }

  const { data: member, error: memberError } =
    await supabaseAdmin
      .from("members")
      .select(
        `
          id,
          status,
          portal_status,
          sola_recurring_id,
          autopay_active,
          recurring_amount,
          recurring_status
        `
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!member) {
    return {
      error: NextResponse.json(
        { error: "Member account not found." },
        { status: 403 }
      ),
      member: null,
    };
  }

  if (
    member.portal_status === "disabled" ||
    member.status !== "active"
  ) {
    return {
      error: NextResponse.json(
        { error: "This member account cannot manage autopay." },
        { status: 403 }
      ),
      member: null,
    };
  }

  if (!member.sola_recurring_id) {
    return {
      error: NextResponse.json(
        { error: "No recurring schedule is linked to this account." },
        { status: 404 }
      ),
      member: null,
    };
  }

  return {
    error: null,
    member,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getSignedInMember();

    if (authResult.error || !authResult.member) {
      return authResult.error;
    }

    const member = authResult.member;
    const body = (await request.json()) as ManageRequest;
    const action = body.action;

    if (!action) {
      return NextResponse.json(
        { error: "An autopay action is required." },
        { status: 400 }
      );
    }

    const scheduleId = String(
      member.sola_recurring_id || ""
    ).trim();

    const now = new Date().toISOString();

    if (action === "pause") {
      await callSolaRecurringApi("DisableSchedule", {
        ScheduleId: scheduleId,
      });

      const { error } = await supabaseAdmin
        .from("members")
        .update({
          autopay_active: false,
          recurring_status: "paused",
          updated_at: now,
        })
        .eq("id", member.id);

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        success: true,
        status: "paused",
      });
    }

    if (action === "resume") {
      await callSolaRecurringApi("EnableSchedule", {
        ScheduleId: scheduleId,
      });

      const upcomingResponse =
        await callSolaRecurringApi(
          "GetUpcomingPaymentDates",
          {
            ScheduleId: scheduleId,
            NumberOfPayments: 1,
            CalendarCulture: "Gregorian",
          }
        );

      const upcomingDates = Array.isArray(
        upcomingResponse.UpcomingPaymentDates
      )
        ? upcomingResponse.UpcomingPaymentDates
        : [];

      const nextBillingDate = upcomingDates[0]
        ? String(upcomingDates[0])
        : null;

      const { error } = await supabaseAdmin
        .from("members")
        .update({
          autopay_active: true,
          recurring_status: "active",
          next_billing_date: nextBillingDate,
          autopay_cancelled_at: null,
          updated_at: now,
        })
        .eq("id", member.id);

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        success: true,
        status: "active",
        nextBillingDate,
      });
    }

    if (action === "update_amount") {
      const amount = Number(body.amount || 0);

      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Enter a valid monthly amount." },
          { status: 400 }
        );
      }

      /*
       * UpdateSchedule requires the latest revision number.
       */
      const schedule = await callSolaRecurringApi(
        "GetSchedule",
        {
          ScheduleId: scheduleId,
        }
      );

      const returnedScheduleId =
        requireSolaString(schedule, "ScheduleId");

      const revision = getNumberValue(
        schedule,
        "Revision"
      );

      await callSolaRecurringApi("UpdateSchedule", {
        ScheduleId: returnedScheduleId,
        Revision: revision,
        Amount: Number(amount.toFixed(2)),
      });

      const { error } = await supabaseAdmin
        .from("members")
        .update({
          recurring_amount: Number(amount.toFixed(2)),
          updated_at: now,
        })
        .eq("id", member.id);

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        success: true,
        amount: Number(amount.toFixed(2)),
      });
    }

    if (action === "cancel") {
      /*
       * Sola only permits deleting an inactive schedule.
       * First disable it, then delete it.
       */
      try {
        await callSolaRecurringApi("DisableSchedule", {
          ScheduleId: scheduleId,
        });
      } catch (error) {
        /*
         * It may already be inactive. Continue to DeleteSchedule.
         */
        console.warn(
          "AUTOPAY_DISABLE_BEFORE_CANCEL_WARNING",
          error
        );
      }

      await callSolaRecurringApi("DeleteSchedule", {
        ScheduleId: scheduleId,
      });

      const { error } = await supabaseAdmin
        .from("members")
        .update({
          autopay_active: false,
          recurring_status: "cancelled",
          sola_recurring_id: null,
          next_billing_date: null,
          autopay_cancelled_at: now,
          updated_at: now,
        })
        .eq("id", member.id);

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        success: true,
        status: "cancelled",
      });
    }

    return NextResponse.json(
      { error: "Unsupported autopay action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("MEMBER_AUTOPAY_MANAGEMENT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update automatic payments.",
      },
      { status: 500 }
    );
  }
}