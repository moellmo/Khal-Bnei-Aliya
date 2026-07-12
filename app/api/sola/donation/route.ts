import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createAndSendReceipt } from "@/lib/payments/createReceipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DonationRequestBody = {
  donorName?: string;
  email?: string;
  phone?: string;
  amount?: string | number;
  purpose?: string;
  note?: string;
  cardToken?: string;
  cvvToken?: string;
  expiration?: string;
  cardholderName?: string;
  billingZip?: string;
};

type GatewayResponse = Record<string, unknown>;

const allowedPurposes = new Set([
  "General Donation",
  "Ner Lamaor",
  "Mishaberach",
  "Matana",
  "Aliyah Pledge",
  "Yamim Noraim Seats",
  "Building Fund",
  "Other",
]);

function sanitizeGatewayResponse(response: GatewayResponse) {
  const blockedTerms = [
    "token",
    "card",
    "cvv",
    "account",
    "routing",
    "key",
  ];

  const sanitized: GatewayResponse = {};

  for (const [key, value] of Object.entries(response)) {
    const normalizedKey = key.toLowerCase();

    sanitized[key] = blockedTerms.some((term) =>
      normalizedKey.includes(term)
    )
      ? "[REDACTED]"
      : value;
  }

  return sanitized;
}

function reservationIdFromNote(note: string) {
  const match = note.match(
    /Reservation\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );

  return match?.[1] || null;
}

async function markReservationPaidFromDonation({
  purpose,
  note,
  reference,
}: {
  purpose: string;
  note: string;
  reference: string;
}) {
  if (purpose !== "Yamim Noraim Seats") return;

  const reservationId = reservationIdFromNote(note);
  if (!reservationId) return;

  const { error } = await supabaseAdmin
    .from("yamim_noraim_reservations")
    .update({
      payment_status: "paid",
      payment_reference: reference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId);

  if (error) {
    console.error("YAMIM_NORAIM_PAYMENT_LINK_ERROR", {
      reservationId,
      error: error.message,
    });
  }
}

function getResponseValue(
  response: GatewayResponse,
  possibleKeys: string[]
) {
  for (const possibleKey of possibleKeys) {
    const matchingEntry = Object.entries(response).find(
      ([key]) => key.toLowerCase() === possibleKey.toLowerCase()
    );

    if (matchingEntry) {
      return String(matchingEntry[1] ?? "");
    }
  }

  return "";
}

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      firstName: parts[0] || "Guest",
      lastName: "Donor",
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) || "Donor",
  };
}

async function findOrCreateDonor({
  donorName,
  email,
  phone,
}: {
  donorName: string;
  email: string;
  phone: string;
}) {
  if (email) {
    const { data: existingByEmail, error: emailLookupError } =
      await supabaseAdmin
        .from("members")
        .select("id, first_name, last_name, email")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

    if (emailLookupError) {
      throw new Error(emailLookupError.message);
    }

    if (existingByEmail) {
      return existingByEmail;
    }
  }

  const { firstName, lastName } = splitName(donorName);
  const now = new Date().toISOString();

  const { data: donor, error: donorInsertError } =
    await supabaseAdmin
      .from("members")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        membership_type: "Donor",
        status: "donor",
        notes: "Created automatically from the public donation page.",
        updated_at: now,
      })
      .select("id, first_name, last_name, email")
      .single();

  if (donorInsertError || !donor) {
    throw new Error(
      donorInsertError?.message || "Unable to save donor information."
    );
  }

  return donor;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SOLA_API_KEY;
    const softwareName =
      process.env.SOLA_SOFTWARE_NAME || "Khal Bnei Aliya Portal";
    const softwareVersion =
      process.env.SOLA_SOFTWARE_VERSION || "1.0.0";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Card payments are not configured." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as DonationRequestBody;

    const donorName = String(body.donorName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const amount = Number(body.amount || 0);
    const submittedPurpose = String(body.purpose || "").trim();
    const purpose = allowedPurposes.has(submittedPurpose)
      ? submittedPurpose
      : "General Donation";
    const note = String(body.note || "").trim();
    const cardToken = String(body.cardToken || "").trim();
    const cvvToken = String(body.cvvToken || "").trim();
    const expiration = String(body.expiration || "")
      .replace(/\D/g, "")
      .slice(0, 4);
    const cardholderName = String(body.cardholderName || "").trim();
    const billingZip = String(body.billingZip || "").trim();

    if (!donorName || !email || !phone) {
      return NextResponse.json(
        { error: "Name, email, and phone are required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json(
        { error: "Enter a donation amount of at least $1." },
        { status: 400 }
      );
    }

    if (
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

    const donor = await findOrCreateDonor({
      donorName,
      email,
      phone,
    });

    const chargeDescription =
      note.length > 0 ? `${purpose}: ${note}` : purpose;

    const { data: charge, error: chargeInsertError } =
      await supabaseAdmin
        .from("member_charges")
        .insert({
          member_id: donor.id,
          charge_type: "Donation",
          description: chargeDescription,
          amount,
          status: "unpaid",
          due_date: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();

    if (chargeInsertError || !charge) {
      throw new Error(
        chargeInsertError?.message || "Unable to save the donation."
      );
    }

    const invoice = `KBA-DON-${charge.id}`;

    const gatewayResponse = await fetch(
      "https://x1.cardknox.com/gatewayjson",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
          xEmail: email,
          xCustReceipt: "True",
          xDescription: chargeDescription,
          xCustom01: donor.id,
          xCustom02: charge.id,
          xCustom03: "public-donation",
        }),
      }
    );

    let gatewayData: GatewayResponse;

    try {
      gatewayData =
        (await gatewayResponse.json()) as GatewayResponse;
    } catch {
      return NextResponse.json(
        {
          error:
            "The payment provider returned an invalid response.",
        },
        { status: 502 }
      );
    }

    const result = getResponseValue(gatewayData, [
      "xResult",
      "xResponseResult",
    ]);

    const approved =
      result.toLowerCase() === "a" ||
      result.toLowerCase() === "approved";

    const reference = getResponseValue(gatewayData, [
      "xRefNum",
      "xRefnum",
    ]);

    const gatewayErrorMessage = getResponseValue(gatewayData, [
      "xError",
      "xErrorMessage",
      "xStatus",
      "xMessage",
    ]);

    if (!gatewayResponse.ok || !approved || !reference) {
      console.error(
        "PUBLIC_DONATION_DECLINED",
        sanitizeGatewayResponse(gatewayData)
      );

      return NextResponse.json(
        {
          error:
            gatewayErrorMessage || "The card was not approved.",
        },
        { status: 402 }
      );
    }

    const paidAt = new Date().toISOString();
    const receiptNumber =
      `KBA-${paidAt
        .slice(0, 10)
        .replaceAll("-", "")}-${reference}`;

    const { data: payment, error: paymentInsertError } =
      await supabaseAdmin
        .from("payments")
        .insert({
          member_id: donor.id,
          charge_id: charge.id,
          amount,
          payment_method: "Card",
          payment_provider: "sola",
          external_payment_id: reference,
          payer_email: email,
          status: "paid",
          note: `Public donation: ${chargeDescription}`,
          paid_at: paidAt,
          receipt_number: receiptNumber,
          raw_provider_response:
            sanitizeGatewayResponse(gatewayData),
        })
        .select("id")
        .single();

    if (paymentInsertError || !payment) {
      throw new Error(
        paymentInsertError?.message ||
          "The card was charged, but the payment could not be saved."
      );
    }

    const { error: chargeUpdateError } = await supabaseAdmin
      .from("member_charges")
      .update({
        status: "paid",
        paid_at: paidAt,
        payment_method: "Card",
        payment_provider: "sola",
        paid_amount: amount,
        external_payment_id: reference,
        payment_note: "Paid through public donation page",
      })
      .eq("id", charge.id)
      .eq("member_id", donor.id);

    if (chargeUpdateError) {
      throw new Error(chargeUpdateError.message);
    }

    await markReservationPaidFromDonation({
      purpose,
      note,
      reference,
    });

    let receiptGenerated = false;
    let receiptError: string | null = null;

    try {
      await createAndSendReceipt({
        paymentId: payment.id,
        emailOverride: email,
      });

      receiptGenerated = true;
    } catch (error) {
      receiptError =
        error instanceof Error
          ? error.message
          : "Unable to generate the receipt.";

      console.error("PUBLIC_DONATION_RECEIPT_ERROR", {
        paymentId: payment.id,
        donorId: donor.id,
        error: receiptError,
      });
    }

    return NextResponse.json({
      approved: true,
      reference,
      paymentId: payment.id,
      receiptNumber,
      receiptGenerated,
      receiptError,
    });
  } catch (error) {
    console.error("PUBLIC_DONATION_ERROR", error);

    return NextResponse.json(
      { error: "Unable to process the donation." },
      { status: 500 }
    );
  }
}
