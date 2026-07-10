import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentRequestBody = {
  chargeId?: string;
  cardToken?: string;
  cvvToken?: string;
  expiration?: string;
  cardholderName?: string;
  billingZip?: string;
  email?: string;
};

function sanitizeGatewayResponse(response: Record<string, unknown>) {
  const blocked = ["token", "card", "cvv", "account", "routing", "key"];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(response)) {
    const lower = key.toLowerCase();
    sanitized[key] = blocked.some((term) => lower.includes(term))
      ? "[REDACTED]"
      : value;
  }

  return sanitized;
}

function getResponseValue(
  response: Record<string, unknown>,
  possibleKeys: string[]
) {
  for (const possibleKey of possibleKeys) {
    const match = Object.entries(response).find(
      ([key]) => key.toLowerCase() === possibleKey.toLowerCase()
    );

    if (match) return String(match[1] ?? "");
  }

  return "";
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SOLA_API_KEY;
    const softwareName =
      process.env.SOLA_SOFTWARE_NAME || "Khal Bnei Aliya Portal";
    const softwareVersion = process.env.SOLA_SOFTWARE_VERSION || "1.0.0";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Card payments are not configured." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as PaymentRequestBody;
    const chargeId = String(body.chargeId || "").trim();
    const cardToken = String(body.cardToken || "").trim();
    const cvvToken = String(body.cvvToken || "").trim();
    const expiration = String(body.expiration || "").replace(/\D/g, "");
    const cardholderName = String(body.cardholderName || "").trim();
    const billingZip = String(body.billingZip || "").trim();
    const receiptEmail = String(body.email || "").trim();

    if (
      !chargeId ||
      !cardToken ||
      !cvvToken ||
      expiration.length !== 4 ||
      !cardholderName ||
      !billingZip
    ) {
      return NextResponse.json(
        { error: "Complete all required card fields." },
        { status: 400 }
      );
    }

    const { data: charge, error: chargeError } = await supabaseAdmin
      .from("member_charges")
      .select("id, member_id, amount, status, charge_type, description")
      .eq("id", chargeId)
      .maybeSingle();

    if (chargeError) throw new Error(chargeError.message);

    if (!charge) {
      return NextResponse.json({ error: "Charge not found." }, { status: 404 });
    }

    if (charge.status === "paid") {
      return NextResponse.json(
        { error: "This charge has already been paid." },
        { status: 409 }
      );
    }

    const amount = Number(charge.amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "This charge has an invalid amount." },
        { status: 400 }
      );
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("members")
      .select("id, first_name, last_name, email")
      .eq("id", charge.member_id)
      .maybeSingle();

    if (memberError) throw new Error(memberError.message);

    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const invoice = `KBA-${charge.id}`;

    const gatewayResponse = await fetch("https://x1.cardknox.com/gatewayjson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        xKey: apiKey,
        xVersion: "5.0.0",
        xSoftwareName: softwareName,
        xSoftwareVersion: softwareVersion,
        xCommand: "cc:Sale",
        xAmount: amount.toFixed(2),
        xCardNum: cardToken,
        xCVV: cvvToken,
        xExp: expiration,
        xName: cardholderName,
        xZip: billingZip,
        xInvoice: invoice,
        xEmail: receiptEmail || member.email || "",
        xCustReceipt: Boolean(receiptEmail || member.email) ? "True" : "False",
        xDescription: charge.description || charge.charge_type,
        xCustom01: member.id,
        xCustom02: charge.id,
      }),
    });

    const gatewayData = (await gatewayResponse.json()) as Record<string, unknown>;
    const result = getResponseValue(gatewayData, ["xResult", "xResponseResult"]);
    const approved = result.toLowerCase() === "a" || result.toLowerCase() === "approved";
    const reference = getResponseValue(gatewayData, ["xRefNum", "xRefnum"]);
    const errorMessage = getResponseValue(gatewayData, [
      "xError",
      "xErrorMessage",
      "xStatus",
      "xMessage",
    ]);

    if (!gatewayResponse.ok || !approved || !reference) {
      console.error("SOLA_CARD_PAYMENT_DECLINED", sanitizeGatewayResponse(gatewayData));

      return NextResponse.json(
        { error: errorMessage || "The card was not approved." },
        { status: 402 }
      );
    }

    const paidAt = new Date().toISOString();
    const receiptNumber = `KBA-${paidAt.slice(0, 10).replaceAll("-", "")}-${reference}`;

    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("external_payment_id", reference)
      .maybeSingle();

    if (!existingPayment) {
      const { error: paymentError } = await supabaseAdmin.from("payments").insert({
        member_id: member.id,
        charge_id: charge.id,
        amount,
        payment_method: "Card",
        payment_provider: "sola",
        external_payment_id: reference,
        payer_email: receiptEmail || member.email || null,
        status: "paid",
        note: "Online card payment",
        paid_at: paidAt,
        receipt_number: receiptNumber,
        raw_provider_response: sanitizeGatewayResponse(gatewayData),
      });

      if (paymentError) throw new Error(paymentError.message);
    }

    const { error: updateError } = await supabaseAdmin
      .from("member_charges")
      .update({
        status: "paid",
        paid_at: paidAt,
        payment_method: "Card",
        payment_provider: "sola",
        paid_amount: amount,
        external_payment_id: reference,
        payment_note: "Paid online by card",
      })
      .eq("id", charge.id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      approved: true,
      reference,
      receiptNumber,
    });
  } catch (error) {
    console.error("SOLA_CARD_PAYMENT_ERROR", error);

    return NextResponse.json(
      { error: "Unable to process the card payment." },
      { status: 500 }
    );
  }
}
