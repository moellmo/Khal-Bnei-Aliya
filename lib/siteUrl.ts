const DEFAULT_SITE_ORIGIN = "https://khalbneialiya.com";

function isLocalOrigin(value: string) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

export function getSiteOrigin(requestOrigin?: string | null) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  const origin = configuredOrigin || requestOrigin || DEFAULT_SITE_ORIGIN;

  if (isLocalOrigin(origin) && requestOrigin && !isLocalOrigin(requestOrigin)) {
    return requestOrigin.replace(/\/$/, "");
  }

  if (isLocalOrigin(origin)) {
    return DEFAULT_SITE_ORIGIN;
  }

  return origin.replace(/\/$/, "");
}
