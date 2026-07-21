import { NextRequest, NextResponse } from "next/server";
import {
  buildMemberAccountStatementPdf,
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
    const memberId = request.nextUrl.searchParams.get("memberId") || "";

    if (!memberId || memberId === "all") {
      return NextResponse.json(
        { error: "Choose a member for an account statement." },
        { status: 400 }
      );
    }

    const pdfBytes = await buildMemberAccountStatementPdf({
      year,
      memberId,
    });
    const body = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="kba-${year}-account-statement-${safeFilePart(
          memberId
        )}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("MEMBER_ACCOUNT_STATEMENT_ERROR", error);

    return NextResponse.json(
      { error: "Unable to generate the member account statement." },
      { status: 500 }
    );
  }
}
