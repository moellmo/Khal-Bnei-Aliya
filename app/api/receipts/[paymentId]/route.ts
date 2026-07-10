import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{
    paymentId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteProps
) {
  try {
    const { paymentId } = await params;

    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required." },
        { status: 400 }
      );
    }

    const { data: payment, error: paymentError } =
      await supabaseAdmin
        .from("payments")
        .select("id, receipt_pdf_url, receipt_number")
        .eq("id", paymentId)
        .maybeSingle();

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 }
      );
    }

    if (!payment.receipt_pdf_url) {
      return NextResponse.json(
        { error: "Receipt has not been generated yet." },
        { status: 404 }
      );
    }

    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin.storage
        .from("payment-receipts")
        .createSignedUrl(payment.receipt_pdf_url, 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(
        signedUrlError?.message || "Unable to create receipt link."
      );
    }

    return NextResponse.redirect(signedUrlData.signedUrl);
  } catch (error) {
    console.error("RECEIPT_DOWNLOAD_ERROR", error);

    return NextResponse.json(
      { error: "Unable to open the receipt." },
      { status: 500 }
    );
  }
}