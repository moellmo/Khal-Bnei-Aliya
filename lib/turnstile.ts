import { NextRequest } from "next/server";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    undefined
  );
}

export async function verifyTurnstile(
  request: NextRequest,
  token: unknown
) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();

  // Keep local development usable until production keys are configured.
  // Production should set TURNSTILE_SECRET_KEY and
  // NEXT_PUBLIC_TURNSTILE_SITE_KEY together.
  if (!secret) {
    return { enabled: false, success: true };
  }

  if (typeof token !== "string" || !token.trim()) {
    return { enabled: true, success: false };
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  const clientIp = getClientIp(request);
  if (clientIp) {
    formData.append("remoteip", clientIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
      "error-codes"?: string[];
    };

    if (!response.ok || !result.success) {
      console.warn("TURNSTILE_VALIDATION_FAILED", {
        errors: result["error-codes"] || [],
      });
    }

    return {
      enabled: true,
      success: response.ok && result.success === true,
    };
  } catch (error) {
    console.error("TURNSTILE_VALIDATION_ERROR", error);
    return { enabled: true, success: false };
  }
}
