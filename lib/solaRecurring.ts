const SOLA_RECURRING_API_URL =
  process.env.SOLA_RECURRING_API_URL ||
  "https://api.cardknox.com/v2";

const SOLA_RECURRING_API_VERSION =
  process.env.SOLA_RECURRING_API_VERSION || "2.1";

export type SolaRecurringResponse = {
  Result?: string;
  Error?: string;
  RefNum?: string;
  CustomerId?: string | number;
  PaymentMethodId?: string;
  ScheduleId?: string;
  [key: string]: unknown;
};

function parseNestedJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (
    !trimmed ||
    (!trimmed.startsWith("{") && !trimmed.startsWith("["))
  ) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeResponse(
  value: Record<string, unknown>
): SolaRecurringResponse {
  const normalized: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    const parsed = parseNestedJson(item);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      normalized[key] = normalizeResponse(
        parsed as Record<string, unknown>
      );
    } else if (Array.isArray(parsed)) {
      normalized[key] = parsed.map((entry) => {
        if (
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry)
        ) {
          return normalizeResponse(
            entry as Record<string, unknown>
          );
        }

        return parseNestedJson(entry);
      });
    } else {
      normalized[key] = parsed;
    }
  }

  return normalized as SolaRecurringResponse;
}

export async function callSolaRecurringApi(
  endpoint: string,
  body: Record<string, unknown>
): Promise<SolaRecurringResponse> {
  const apiKey = process.env.SOLA_API_KEY;

  if (!apiKey) {
    throw new Error("SOLA_API_KEY is missing.");
  }

  const response = await fetch(
    `${SOLA_RECURRING_API_URL}/${endpoint.replace(/^\/+/, "")}`,
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        "X-Recurring-Api-Version":
          SOLA_RECURRING_API_VERSION,
      },
      body: JSON.stringify({
        SoftwareName:
          process.env.SOLA_SOFTWARE_NAME ||
          "Khal Bnei Aliya Portal",
        SoftwareVersion:
          process.env.SOLA_SOFTWARE_VERSION || "1.0.0",
        ...body,
      }),
      cache: "no-store",
    }
  );

  const responseText = await response.text();

  let rawData: Record<string, unknown>;

  try {
    rawData = responseText
      ? (JSON.parse(responseText) as Record<string, unknown>)
      : {};
  } catch {
    throw new Error(
      `Sola returned an invalid response. HTTP ${response.status}.`
    );
  }

  const data = normalizeResponse(rawData);

  const result = String(data.Result || "").toUpperCase();

  if (!response.ok || result === "E") {
    const message =
      String(
        data.Error ||
          data.error ||
          data.Message ||
          data.message ||
          ""
      ) || `Sola request failed. HTTP ${response.status}.`;

    throw new Error(message);
  }

  return data;
}

export function requireSolaString(
  response: SolaRecurringResponse,
  key: string
) {
  const value = response[key];

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    throw new Error(
      `Sola did not return the required ${key}.`
    );
  }

  return String(value);
}