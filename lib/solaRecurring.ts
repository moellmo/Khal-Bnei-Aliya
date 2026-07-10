const SOLA_RECURRING_API_URL =
  process.env.SOLA_RECURRING_API_URL ||
  "https://api.cardknox.com/v2";

const SOLA_RECURRING_API_VERSION =
  process.env.SOLA_RECURRING_API_VERSION || "2.1";

type SolaRecurringResponse = {
  Result?: string;
  Error?: string;
  RefNum?: string;
  [key: string]: unknown;
};

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
        "X-Recurring-Api-Version": SOLA_RECURRING_API_VERSION,
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

  let data: SolaRecurringResponse;

  try {
    data = responseText
      ? (JSON.parse(responseText) as SolaRecurringResponse)
      : {};
  } catch {
    throw new Error(
      `Sola returned an invalid response. HTTP ${response.status}.`
    );
  }

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