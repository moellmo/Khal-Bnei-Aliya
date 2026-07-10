import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getCurrentBillingPeriod() {
  const now = new Date();

  return {
    billingMonth: now.getUTCMonth() + 1,
    billingYear: now.getUTCFullYear(),
  };
}

function getDueDate(billingYear: number, billingMonth: number) {
  return `${billingYear}-${String(billingMonth).padStart(2, "0")}-15`;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const defaultAmount = Number(
      process.env.MONTHLY_DUES_DEFAULT_AMOUNT || 0
    );

    if (!Number.isFinite(defaultAmount) || defaultAmount <= 0) {
      return NextResponse.json(
        { error: "MONTHLY_DUES_DEFAULT_AMOUNT is invalid." },
        { status: 500 }
      );
    }

    const { billingMonth, billingYear } =
      getCurrentBillingPeriod();

    const dueDate = getDueDate(billingYear, billingMonth);

    const { data: members, error: membersError } =
      await supabaseAdmin
        .from("members")
        .select(
          "id, first_name, last_name, recurring_amount, autopay_active"
        )
        .eq("status", "active");

    if (membersError) {
      throw new Error(membersError.message);
    }

    let createdCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const member of members || []) {
      try {
        const recurringAmount = Number(
          member.recurring_amount || 0
        );

        const amount =
          recurringAmount > 0
            ? recurringAmount
            : defaultAmount;

        const { data: existingCharge, error: existingError } =
          await supabaseAdmin
            .from("member_charges")
            .select("id")
            .eq("member_id", member.id)
            .eq("charge_type", "Membership Dues")
            .eq("billing_month", billingMonth)
            .eq("billing_year", billingYear)
            .maybeSingle();

        if (existingError) {
          throw new Error(existingError.message);
        }

        if (existingCharge) {
          skippedCount += 1;
          continue;
        }

        const monthName = new Intl.DateTimeFormat("en-US", {
          month: "long",
          timeZone: "UTC",
        }).format(
          new Date(
            Date.UTC(billingYear, billingMonth - 1, 1)
          )
        );

        const description = member.autopay_active
          ? `${monthName} ${billingYear} membership dues — awaiting automatic payment`
          : `${monthName} ${billingYear} membership dues`;

        const { error: insertError } =
          await supabaseAdmin
            .from("member_charges")
            .insert({
              member_id: member.id,
              charge_type: "Membership Dues",
              description,
              amount,
              status: "unpaid",
              due_date: dueDate,
              billing_month: billingMonth,
              billing_year: billingYear,
            });

        if (insertError) {
          throw new Error(insertError.message);
        }

        createdCount += 1;
      } catch (memberError) {
        const message =
          memberError instanceof Error
            ? memberError.message
            : "Unknown error";

        errors.push(
          `${member.first_name} ${member.last_name}: ${message}`
        );
      }
    }

    console.log("MONTHLY_DUES_CRON_COMPLETE", {
      billingMonth,
      billingYear,
      createdCount,
      skippedCount,
      errorCount: errors.length,
      errors,
    });

    return NextResponse.json({
      success: true,
      billingMonth,
      billingYear,
      dueDate,
      createdCount,
      skippedCount,
      errors,
    });
  } catch (error) {
    console.error("MONTHLY_DUES_CRON_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate monthly dues.",
      },
      { status: 500 }
    );
  }
}