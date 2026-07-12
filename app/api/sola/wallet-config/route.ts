import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEnvFlag(name: string, defaultValue: boolean) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return defaultValue;
  }

  return value === "true" || value === "1" || value === "yes";
}

export async function GET() {
  const applePayMerchantId = String(
    process.env.NEXT_PUBLIC_SOLA_APPLE_PAY_MERCHANT_ID ||
      process.env.SOLA_APPLE_PAY_MERCHANT_ID ||
      process.env.SOLA_APPLE_MERCHANT_ID ||
      process.env.APPLE_PAY_MERCHANT_ID ||
      "merchant.cardknox.com"
  ).trim();

  const applePayEnabled =
    getEnvFlag("NEXT_PUBLIC_SOLA_APPLE_PAY_ENABLED", true) &&
    getEnvFlag("SOLA_APPLE_PAY_ENABLED", true);

  const googlePayEnabled = false;

  return NextResponse.json({
    applePayEnabled,
    applePayMerchantId,
    applePayDebug: getEnvFlag(
      "NEXT_PUBLIC_SOLA_APPLE_PAY_DEBUG",
      false
    ),
    googlePayEnabled,
    googlePayMerchantName:
      process.env.NEXT_PUBLIC_SOLA_GOOGLE_PAY_MERCHANT_NAME ||
      process.env.SOLA_GOOGLE_PAY_MERCHANT_NAME ||
      "Khal Bnei Aliya",
    googlePayEnvironment:
      process.env.NEXT_PUBLIC_SOLA_GOOGLE_PAY_ENVIRONMENT ||
      process.env.SOLA_GOOGLE_PAY_ENVIRONMENT ||
      "PRODUCTION",
  });
}
