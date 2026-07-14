import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateAccountingRecurringExpenses } from "@/lib/accounting/recurringExpenses";
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

    let recurringExpensesResult = {
      createdCount: 0,
      skippedCount: 0,
    };
    let recurringExpensesError: string | null = null;

    try {
      recurringExpensesResult = await generateAccountingRecurringExpenses({
        month: billingMonth,
        year: billingYear,
      });
    } catch (error) {
      recurringExpensesError =
        error instanceof Error
          ? error.message
          : "Unable to generate recurring expenses.";
    }

    console.log("MONTHLY_DUES_CRON_COMPLETE", {
      billingMonth,
      billingYear,
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
      emailSentCount: result.emailSentCount,
      emailSkippedCount: result.emailSkippedCount,
      recurringExpensesCreatedCount:
        recurringExpensesResult.createdCount,
      recurringExpensesSkippedCount:
        recurringExpensesResult.skippedCount,
      recurringExpensesError,
      errorCount: result.errors.length,
      errors: result.errors,
    });

    return NextResponse.json({
      success: true,
      billingMonth,
      billingYear,
      dueDate,
      recurringExpenses: recurringExpensesResult,
      recurringExpensesError,
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
