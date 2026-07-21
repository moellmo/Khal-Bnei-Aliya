import { NextRequest, NextResponse } from "next/server";
import {
  depositBatchCsv,
  getDepositBatchRows,
} from "@/lib/accounting/statements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDateParam(value: string | null, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? String(value) : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-01`;
    const nextMonthStart =
      now.getMonth() === 11
        ? `${now.getFullYear() + 1}-01-01`
        : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(
            2,
            "0"
          )}-01`;
    const startDate = getDateParam(
      request.nextUrl.searchParams.get("start"),
      monthStart
    );
    const endDate = getDateParam(
      request.nextUrl.searchParams.get("end"),
      nextMonthStart
    );
    const rows = await getDepositBatchRows({ startDate, endDate });
    const csv = depositBatchCsv(rows);

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kba-deposit-batches-${startDate}-to-${endDate}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("DEPOSIT_BATCH_EXPORT_ERROR", error);

    return NextResponse.json(
      { error: "Unable to export deposit batches." },
      { status: 500 }
    );
  }
}
