import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createAndSendReceipt } from "@/lib/payments/createReceipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{
    paymentId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  { params }: RouteProps
) {
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
        .select("id, email, portal_status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!member) {
      return NextResponse.json(
        { error: "Member account not found." },
        { status: 403 }
      );
    }

    if (member.portal_status === "disabled") {
      return NextResponse.json(
        { error: "Member portal access is disabled." },
        { status: 403 }
      );
    }

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
        .select(
          "id, member_id, payer_email, receipt_pdf_url"
        )
        .eq("id", paymentId)
        .eq("member_id", member.id)
        .maybeSingle();

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found for this member." },
        { status: 404 }
      );
    }

    if (payment.receipt_pdf_url) {
      return NextResponse.json({
        success: true,
        alreadyGenerated: true,
      });
    }

    await createAndSendReceipt({
      paymentId: payment.id,
      emailOverride:
        payment.payer_email || member.email || undefined,
    });

    const { data: updatedPayment, error: updatedPaymentError } =
      await supabaseAdmin
        .from("payments")
        .select("id, receipt_pdf_url")
        .eq("id", payment.id)
        .maybeSingle();

    if (updatedPaymentError) {
      throw new Error(updatedPaymentError.message);
    }

    if (!updatedPayment?.receipt_pdf_url) {
      throw new Error(
        "Receipt generation completed but no PDF path was saved."
      );
    }

    return NextResponse.json({
      success: true,
      receiptPdfUrl: updatedPayment.receipt_pdf_url,
    });
  } catch (error) {
    console.error("MEMBER_RECEIPT_REGENERATION_ERROR", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the receipt.",
      },
      { status: 500 }
    );
  }
}