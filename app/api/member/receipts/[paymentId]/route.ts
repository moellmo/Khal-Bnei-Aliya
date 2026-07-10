import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
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
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to view this receipt." },
        { status: 401 }
      );
    }

    const { data: member, error: memberError } =
      await supabaseAdmin
        .from("members")
        .select("id, portal_status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!member) {
      return NextResponse.json(
        { error: "Your login is not connected to a member account." },
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

    /*
     * The member_id condition ensures members cannot open
     * another member's receipt by changing the URL.
     */
    const { data: payment, error: paymentError } =
      await supabaseAdmin
        .from("payments")
        .select(
          "id, member_id, receipt_pdf_url, receipt_number"
        )
        .eq("id", paymentId)
        .eq("member_id", member.id)
        .maybeSingle();

    if (paymentError) {
      throw new Error(paymentError.message);
    }

    if (!payment) {
      return NextResponse.json(
        {
          error:
            "Receipt not found or not available for this account.",
        },
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
        signedUrlError?.message ||
          "Unable to create the receipt link."
      );
    }

    return NextResponse.redirect(signedUrlData.signedUrl);
  } catch (error) {
    console.error("MEMBER_RECEIPT_DOWNLOAD_ERROR", error);

    return NextResponse.json(
      { error: "Unable to open the receipt." },
      { status: 500 }
    );
  }
}