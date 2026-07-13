import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPaymentRequestEmail } from "@/lib/payments/sendPaymentRequestEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DueCharge = {
  id: string;
  member_id: string;
  amount: number;
  description: string | null;
  due_date: string | null;
  members:
    | {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }
    | {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }[]
    | null;
};

function utcDateOnly(date: Date) {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

function daysBetween(from: Date, to: Date) {
  const day = 24 * 60 * 60 * 1000;
  return Math.round((utcDateOnly(to) - utcDateOnly(from)) / day);
}

function joinedMember(row: DueCharge) {
  return Array.isArray(row.members) ? row.members[0] : row.members;
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

    const today = new Date();
    const { data, error } = await supabaseAdmin
      .from("member_charges")
      .select(
        "id, member_id, amount, description, due_date, members(first_name, last_name, email)"
      )
      .eq("charge_type", "Membership Dues")
      .neq("status", "paid")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(500);

    if (error) {
      throw new Error(error.message);
    }

    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const charge of (data || []) as DueCharge[]) {
      const dueDate = charge.due_date
        ? new Date(`${charge.due_date}T00:00:00.000Z`)
        : null;

      if (!dueDate || Number.isNaN(dueDate.getTime())) {
        skippedCount += 1;
        continue;
      }

      const daysUntilDue = daysBetween(today, dueDate);
      const shouldSend =
        daysUntilDue === 3 || daysUntilDue === -7;

      if (!shouldSend) {
        skippedCount += 1;
        continue;
      }

      const member = joinedMember(charge);

      try {
        const result = await sendPaymentRequestEmail({
          recipient: member?.email || null,
          memberFirstName: member?.first_name || "Member",
          amount: Number(charge.amount || 0),
          chargeType:
            daysUntilDue === 3
              ? "Membership Dues Reminder"
              : "Overdue Membership Dues",
          description:
            charge.description ||
            (daysUntilDue === 3
              ? "Your monthly membership dues are coming due."
              : "Your monthly membership dues are overdue."),
          chargeId: charge.id,
          isOpenAmount: false,
        });

        if (result.sent) {
          sentCount += 1;
        } else {
          skippedCount += 1;
        }
      } catch (emailError) {
        errors.push(
          `${member?.first_name || ""} ${member?.last_name || ""}`.trim() ||
            charge.member_id
        );
        console.error("MONTHLY_DUES_REMINDER_EMAIL_ERROR", {
          chargeId: charge.id,
          error: emailError,
        });
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      skippedCount,
      errors,
    });
  } catch (error) {
    console.error("MONTHLY_DUES_REMINDER_CRON_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to send monthly dues reminders.",
      },
      { status: 500 }
    );
  }
}
