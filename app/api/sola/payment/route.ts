import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createAndSendReceipt } from "@/lib/payments/createReceipt";

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
  amount?: string | number;
  walletType?: string;
  payload?: unknown;
};

type GatewayResponse = Record<string, unknown>;

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

export async function POST(request: NextRequest) {
  try {
    /*
     * Verify the member's authenticated Supabase session.
     */
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "You must be signed in to make a payment.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * Load the member connected to the authenticated user.
     */
    const { data: member, error: memberError } = await supabaseAdmin
      .from("members")
      .select(
        "id, first_name, last_name, email, portal_status"
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!member) {
      return NextResponse.json(
        {
          error:
            "Your login is not connected to a member account.",
        },
        {
          status: 403,
        }
      );
    }

    if (member.portal_status === "disabled") {
      return NextResponse.json(
        {
          error: "Member portal access is disabled.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Confirm that Sola/Cardknox is configured.
     */
    const apiKey = process.env.SOLA_API_KEY;

    const softwareName =
      process.env.SOLA_SOFTWARE_NAME ||
      "Khal Bnei Aliya Portal";

    const softwareVersion =
      process.env.SOLA_SOFTWARE_VERSION || "1.0.0";

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Card payments are not configured.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Read and validate the submitted payment information.
     */
    const body = (await request.json()) as PaymentRequestBody;

    const chargeId = String(body.chargeId || "").trim();
    const normalizedWalletType =
      String(body.walletType || "").toLowerCase() === "googlepay"
        ? "GooglePay"
        : String(body.walletType || "").toLowerCase() === "applepay"
          ? "ApplePay"
          : null;
    const isWalletPayment = Boolean(normalizedWalletType);
    const walletPayload = body.payload;
    const cardToken = String(body.cardToken || "").trim();
    const cvvToken = String(body.cvvToken || "").trim();

    const expiration = String(body.expiration || "")
      .replace(/\D/g, "")
      .slice(0, 4);

    const cardholderName = String(
      body.cardholderName || ""
    ).trim();

    const billingZip = String(body.billingZip || "").trim();

    const receiptEmail = String(body.email || "")
      .trim()
      .toLowerCase();

    const requestedAmount = Number(body.amount || 0);

    if (!chargeId) {
      return NextResponse.json(
        {
          error: "Charge is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (isWalletPayment && !walletPayload) {
      return NextResponse.json(
        {
          error: "Wallet payment payload is missing.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isWalletPayment &&
      (!cardToken ||
        !cvvToken ||
        expiration.length !== 4 ||
        !cardholderName ||
        !billingZip)
    ) {
      return NextResponse.json(
        {
          error: "Complete all required card fields.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Critical ownership check:
     * the selected charge must belong to the signed-in member.
     */
    const { data: charge, error: chargeError } =
      await supabaseAdmin
        .from("member_charges")
        .select(
          `
            id,
            member_id,
            amount,
            status,
            charge_type,
            description
          `
        )
        .eq("id", chargeId)
        .eq("member_id", member.id)
        .maybeSingle();

    if (chargeError) {
      throw new Error(chargeError.message);
    }

    if (!charge) {
      return NextResponse.json(
        {
          error:
            "Charge not found or not available for this account.",
        },
        {
          status: 404,
        }
      );
    }

    if (charge.status === "paid") {
      return NextResponse.json(
        {
          error: "This charge has already been paid.",
        },
        {
          status: 409,
        }
      );
    }

    const storedAmount = Number(charge.amount || 0);
    const isOpenAmountCharge =
      storedAmount <= 0 ||
      String(charge.charge_type || "").toLowerCase() === "matana" ||
      String(charge.description || "")
        .toLowerCase()
        .includes("matana");

    const amount = isOpenAmountCharge ? requestedAmount : storedAmount;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error: isOpenAmountCharge
            ? "Enter a Matana amount greater than $0."
            : "This charge has an invalid amount.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Process the card payment through Sola/Cardknox.
     */
    const invoice = `KBA-${charge.id}`;
    const walletToken =
      isWalletPayment && normalizedWalletType
        ? getDigitalWalletToken(normalizedWalletType, walletPayload)
        : "";
    const billingContact =
      isWalletPayment && normalizedWalletType
        ? getBillingContact(normalizedWalletType, walletPayload)
        : {};
    const memberFullName = [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const paymentMethod =
      normalizedWalletType || "Card";
    const paymentDescription =
      normalizedWalletType
        ? `Member portal ${normalizedWalletType} payment`
        : "Member portal card payment";

    if (isWalletPayment && !walletToken) {
      return NextResponse.json(
        {
          error: "Wallet payment token is missing.",
        },
        {
          status: 400,
        }
      );
    }

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
          xCardNum: walletToken || cardToken,
          ...(isWalletPayment && normalizedWalletType
            ? {
                xDigitalWalletType: normalizedWalletType,
                xName: memberFullName,
                xBillFirstName: String(
                  billingContact.givenName || member.first_name || ""
                ),
                xBillLastName: String(
                  billingContact.familyName || member.last_name || ""
                ),
                xBillStreet: String(
                  billingContact.addressLines ||
                    billingContact.address1 ||
                    ""
                ),
                xBillCity: String(
                  billingContact.locality ||
                    billingContact.city ||
                    ""
                ),
                xBillState: String(
                  billingContact.administrativeArea ||
                    billingContact.state ||
                    ""
                ),
                xBillZip: String(
                  billingContact.postalCode ||
                    billingContact.postalCodePrefix ||
                    ""
                ),
              }
            : {
                xCVV: cvvToken,
                xExp: expiration,
                xName: cardholderName,
                xZip: billingZip,
              }),
          xInvoice: invoice,
          xEmail: receiptEmail || member.email || "",
          xCustReceipt:
            receiptEmail || member.email ? "True" : "False",
          xDescription:
            charge.description || charge.charge_type,
          xCustom01: member.id,
          xCustom02: charge.id,
          xCustom03: isWalletPayment
            ? `member-charge-${normalizedWalletType}`
            : "member-charge-card",
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
        {
          status: 502,
        }
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

    if (
      !gatewayResponse.ok ||
      !approved ||
      !reference
    ) {
      console.error(
        "MEMBER_SOLA_PAYMENT_DECLINED",
        sanitizeGatewayResponse(gatewayData)
      );

      return NextResponse.json(
        {
          error:
            gatewayErrorMessage ||
            "The card was not approved.",
        },
        {
          status: 402,
        }
      );
    }

    const paidAt = new Date().toISOString();

    const receiptNumber =
      `KBA-${paidAt
        .slice(0, 10)
        .replaceAll("-", "")}-${reference}`;

    /*
     * Prevent a duplicate payment row if the gateway response
     * is handled more than once.
     */
    const {
      data: existingPayment,
      error: existingPaymentError,
    } = await supabaseAdmin
      .from("payments")
      .select("id, receipt_pdf_url")
      .eq("external_payment_id", reference)
      .maybeSingle();

    if (existingPaymentError) {
      throw new Error(existingPaymentError.message);
    }

    let paymentId = existingPayment?.id || "";

    if (!existingPayment) {
      const {
        data: newPayment,
        error: paymentInsertError,
      } = await supabaseAdmin
        .from("payments")
        .insert({
          member_id: member.id,
          charge_id: charge.id,
          amount,
          payment_method: paymentMethod,
          payment_provider: "sola",
          external_payment_id: reference,
          payer_email:
            receiptEmail || member.email || null,
          status: "paid",
          note: paymentDescription,
          paid_at: paidAt,
          receipt_number: receiptNumber,
          raw_provider_response:
            sanitizeGatewayResponse(gatewayData),
        })
        .select("id")
        .single();

      if (paymentInsertError) {
        throw new Error(paymentInsertError.message);
      }

      paymentId = newPayment.id;
    }

    if (!paymentId) {
      throw new Error(
        "The payment was recorded without a payment ID."
      );
    }

    /*
     * Mark the corresponding member charge as paid.
     */
    const { error: chargeUpdateError } =
      await supabaseAdmin
        .from("member_charges")
        .update({
          status: "paid",
          paid_at: paidAt,
          payment_method: paymentMethod,
          payment_provider: "sola",
          amount,
          paid_amount: amount,
          external_payment_id: reference,
          payment_note: isOpenAmountCharge
            ? "Matana amount chosen at payment"
            : paymentDescription,
        })
        .eq("id", charge.id)
        .eq("member_id", member.id)
        .neq("status", "paid");

    if (chargeUpdateError) {
      throw new Error(chargeUpdateError.message);
    }

    /*
     * Generate, upload, and email the custom receipt.
     *
     * A receipt failure must not make an already-approved card
     * payment appear to have failed.
     */
    let receiptGenerated = Boolean(
      existingPayment?.receipt_pdf_url
    );

    let receiptError: string | null = null;

    if (!receiptGenerated) {
      try {
        await createAndSendReceipt({
          paymentId,
          emailOverride:
            receiptEmail || member.email || undefined,
        });

        receiptGenerated = true;
      } catch (error) {
        receiptError =
          error instanceof Error
            ? error.message
            : "Unable to generate the receipt.";

        console.error(
          "MEMBER_RECEIPT_GENERATION_ERROR",
          {
            paymentId,
            memberId: member.id,
            error: receiptError,
          }
        );
      }
    }

    /*
     * Record recent portal activity.
     */
    const { error: memberUpdateError } =
      await supabaseAdmin
        .from("members")
        .update({
          portal_last_login_at: paidAt,
          updated_at: paidAt,
        })
        .eq("id", member.id);

    if (memberUpdateError) {
      console.error(
        "MEMBER_ACTIVITY_UPDATE_ERROR",
        memberUpdateError.message
      );
    }

    return NextResponse.json({
      approved: true,
      reference,
      receiptNumber,
      paymentId,
      paymentMethod,
      receiptGenerated,
      receiptError,
    });
  } catch (error) {
    console.error("MEMBER_SOLA_PAYMENT_ERROR", error);

    return NextResponse.json(
      {
        error: "Unable to process the card payment.",
      },
      {
        status: 500,
      }
    );
  }
}
