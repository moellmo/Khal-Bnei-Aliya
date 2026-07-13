import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateMonthlyDuesCharges } from "@/lib/billing/monthlyDues";

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
      process.env.MONTHLY_DUES_DEFAULT_AMOUNT || 75
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

    const result = await generateMonthlyDuesCharges({
      billingMonth,
      billingYear,
      defaultAmount,
      dueDate,
      sendEmails: true,
    });

    console.log("MONTHLY_DUES_CRON_COMPLETE", {
      billingMonth,
      billingYear,
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
      emailSentCount: result.emailSentCount,
      emailSkippedCount: result.emailSkippedCount,
      errorCount: result.errors.length,
      errors: result.errors,
    });

    return NextResponse.json({
      success: true,
      billingMonth,
      billingYear,
      dueDate,
      ...result,
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
