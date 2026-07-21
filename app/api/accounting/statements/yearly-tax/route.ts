import { NextRequest, NextResponse } from "next/server";
import {
  buildYearlyTaxStatementPdf,
  normalizeStatementYear,
} from "@/lib/accounting/statements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export async function GET(request: NextRequest) {
  try {
    const year = normalizeStatementYear(
      request.nextUrl.searchParams.get("year")
    );
    const memberId = request.nextUrl.searchParams.get("memberId") || "all";
    const pdfBytes = await buildYearlyTaxStatementPdf({
      year,
      memberId,
    });
    const body = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;
    const filename = `kba-${year}-tax-statement-${safeFilePart(
      memberId
    )}.pdf`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("YEARLY_TAX_STATEMENT_ERROR", error);

    return NextResponse.json(
      { error: "Unable to generate the yearly tax statement." },
      { status: 500 }
    );
  }
}
