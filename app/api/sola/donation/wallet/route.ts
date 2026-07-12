import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createAndSendReceipt } from "@/lib/payments/createReceipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GatewayResponse = Record<string, unknown>;

type WalletDonationBody = {
  walletType?: string;
  payload?: unknown;
  donorName?: string;
  email?: string;
  phone?: string;
  amount?: string | number;
  purpose?: string;
  note?: string;
};

const allowedPurposes = new Set([
  "General Donation",
  "Ner Lamaor",
  "Mishaberach",
  "Matana",
  "Aliyah Pledge",
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nestedRecord(
  record: Record<string, unknown>,
  key: string
) {
  return asRecord(record[key]);
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

function getBillingContact(
  walletType: "ApplePay" | "GooglePay",
  payload: unknown
) {
  const root = asRecord(payload);

  if (walletType === "ApplePay") {
    const payment = nestedRecord(root, "payment");
    return nestedRecord(payment, "billingContact");
  }

  const paymentMethodData = nestedRecord(root, "paymentMethodData");
  const info = nestedRecord(paymentMethodData, "info");
  return nestedRecord(info, "billingAddress");
}

function getPayloadEmail(payload: unknown) {
  const root = asRecord(payload);
  const payment = nestedRecord(root, "payment");
  const billingContact = nestedRecord(payment, "billingContact");

  return String(
    root.email ||
      root.emailAddress ||
      billingContact.emailAddress ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getPayloadPhone(payload: unknown) {
  const root = asRecord(payload);
  const payment = nestedRecord(root, "payment");
  const billingContact = nestedRecord(payment, "billingContact");

  return String(
    root.phoneNumber ||
      root.phone ||
      billingContact.phoneNumber ||
      ""
  ).trim();
}

function getPayloadName(payload: unknown) {
  const root = asRecord(payload);
  const payment = nestedRecord(root, "payment");
  const billingContact = nestedRecord(payment, "billingContact");

  const fullName = String(root.name || "").trim();

  if (fullName) {
    return fullName;
  }

  return [
    billingContact.givenName,
    billingContact.familyName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getDigitalWalletToken(
  walletType: "ApplePay" | "GooglePay",
  payload: unknown
) {
  const root = asRecord(payload);

  if (walletType === "ApplePay") {
    const payment = nestedRecord(root, "payment");
    const token = nestedRecord(payment, "token");
    const paymentData =
      token.paymentData || root.paymentData || payload;

    return Buffer.from(
      typeof paymentData === "string"
        ? paymentData
        : JSON.stringify(paymentData)
    ).toString("base64");
  }

  const paymentMethodData = nestedRecord(root, "paymentMethodData");
  const tokenizationData = nestedRecord(
    paymentMethodData,
    "tokenizationData"
  );
  const token = tokenizationData.token || root.token || payload;

  return Buffer.from(
    typeof token === "string" ? token : JSON.stringify(token)
  ).toString("base64");
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
        notes: "Created automatically from the public wallet donation page.",
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

    const body = (await request.json()) as WalletDonationBody;
    const normalizedWalletType =
      String(body.walletType || "").toLowerCase() === "googlepay"
        ? "GooglePay"
        : "ApplePay";

    const amount = Number(body.amount || 0);
    const submittedPurpose = String(body.purpose || "").trim();
    const purpose = allowedPurposes.has(submittedPurpose)
      ? submittedPurpose
      : "General Donation";
    const note = String(body.note || "").trim();
    const payload = body.payload;
    const billingContact = getBillingContact(normalizedWalletType, payload);
    const donorName =
      String(body.donorName || "").trim() || getPayloadName(payload);
    const email =
      String(body.email || "").trim().toLowerCase() ||
      getPayloadEmail(payload);
    const phone =
      String(body.phone || "").trim() || getPayloadPhone(payload);
    const billingZip = String(
      billingContact.postalCode ||
        billingContact.postalCodePrefix ||
        ""
    ).trim();

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

    if (!payload) {
      return NextResponse.json(
        { error: "Wallet payment payload is missing." },
        { status: 400 }
      );
    }

    const walletToken = getDigitalWalletToken(
      normalizedWalletType,
      payload
    );

    if (!walletToken) {
      return NextResponse.json(
        { error: "Wallet payment token is missing." },
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
    const { firstName, lastName } = splitName(donorName);

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
          xCardNum: walletToken,
          xDigitalWalletType: normalizedWalletType,
          xName: donorName,
          xBillFirstName: firstName,
          xBillLastName: lastName,
          xBillStreet: String(
            billingContact.addressLines ||
              billingContact.address1 ||
              ""
          ),
          xBillCity: String(
            billingContact.locality || billingContact.city || ""
          ),
          xBillState: String(
            billingContact.administrativeArea ||
              billingContact.state ||
              ""
          ),
          xBillZip: billingZip,
          xInvoice: invoice,
          xEmail: email,
          xCustReceipt: "True",
          xDescription: chargeDescription,
          xCustom01: donor.id,
          xCustom02: charge.id,
          xCustom03: `public-donation-${normalizedWalletType}`,
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
        "PUBLIC_WALLET_DONATION_DECLINED",
        sanitizeGatewayResponse(gatewayData)
      );

      return NextResponse.json(
        {
          error:
            gatewayErrorMessage || "The wallet payment was not approved.",
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
          payment_method: normalizedWalletType,
          payment_provider: "sola",
          external_payment_id: reference,
          payer_email: email,
          status: "paid",
          note: `Public ${normalizedWalletType} donation: ${chargeDescription}`,
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
          "The wallet payment was charged, but the payment could not be saved."
      );
    }

    const { error: chargeUpdateError } = await supabaseAdmin
      .from("member_charges")
      .update({
        status: "paid",
        paid_at: paidAt,
        payment_method: normalizedWalletType,
        payment_provider: "sola",
        paid_amount: amount,
        external_payment_id: reference,
        payment_note: `Paid through public ${normalizedWalletType} donation page`,
      })
      .eq("id", charge.id)
      .eq("member_id", donor.id);

    if (chargeUpdateError) {
      throw new Error(chargeUpdateError.message);
    }

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

      console.error("PUBLIC_WALLET_DONATION_RECEIPT_ERROR", {
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
      xRefNum: reference,
    });
  } catch (error) {
    console.error("PUBLIC_WALLET_DONATION_ERROR", error);

    return NextResponse.json(
      { error: "Unable to process the wallet donation." },
      { status: 500 }
    );
  }
}
