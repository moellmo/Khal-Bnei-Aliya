import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookPayload = Record<string, unknown>;

const SENSITIVE_KEYS = [
  "xkey",
  "xtoken",
  "xcardnum",
  "xcardnumber",
  "xaccount",
  "xrouting",
  "xcvv",
  "xcvv2",
  "xexp",
  "password",
  "authorization",
];

function isSensitiveKey(key: string) {
  const normalizedKey = key.toLowerCase();

  return SENSITIVE_KEYS.some((sensitiveKey) =>
    normalizedKey.includes(sensitiveKey)
  );
}

function sanitizePayload(payload: WebhookPayload): WebhookPayload {
  const sanitized: WebhookPayload = {};

  for (const [key, value] of Object.entries(payload)) {
    sanitized[key] = isSensitiveKey(key) ? "[REDACTED]" : value;
  }

  return sanitized;
}

function formDataToObject(formData: FormData): WebhookPayload {
  const result: WebhookPayload = {};

  for (const [key, value] of formData.entries()) {
    result[key] = typeof value === "string" ? value : value.name;
  }

  return result;
}

async function readPayload(request: NextRequest): Promise<WebhookPayload> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();

    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as WebhookPayload;
    }

    return { body };
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return formDataToObject(formData);
  }

  const rawBody = await request.text();

  if (!rawBody) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawBody);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as WebhookPayload;
    }

    return { body: parsed };
  } catch {
    const params = new URLSearchParams(rawBody);
    const result: WebhookPayload = {};

    for (const [key, value] of params.entries()) {
      result[key] = value;
    }

    return Object.keys(result).length > 0
      ? result
      : { rawBody: "[UNRECOGNIZED BODY FORMAT]" };
  }
}

/**
 * A browser visit can confirm that the webhook route is deployed.
 * Sola itself will use POST.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Sola webhook endpoint is online.",
  });
}

/**
 * Initial webhook receiver.
 *
 * This version safely receives and logs Sola's payload so we can confirm
 * the exact fields Sola sends for one-time and recurring transactions.
 *
 * It deliberately does NOT mark charges as paid yet.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await readPayload(request);
    const sanitizedPayload = sanitizePayload(payload);

    const signature =
      request.headers.get("ck-signature") ||
      request.headers.get("x-cardknox-signature") ||
      request.headers.get("x-sola-signature");

    console.log("SOLA_WEBHOOK_RECEIVED", {
      receivedAt: new Date().toISOString(),
      signaturePresent: Boolean(signature),
      contentType: request.headers.get("content-type"),
      payload: sanitizedPayload,
    });

    return NextResponse.json(
      {
        received: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("SOLA_WEBHOOK_ERROR", error);

    return NextResponse.json(
      {
        received: false,
        error: "Unable to process webhook.",
      },
      { status: 400 }
    );
  }
}