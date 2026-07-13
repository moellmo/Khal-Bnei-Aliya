const SOLA_REPORTING_API_URL =
  process.env.SOLA_REPORTING_API_URL ||
  "https://x1.cardknox.com/reportjson";

const SOLA_REPORTING_VERSION =
  process.env.SOLA_REPORTING_VERSION || "5.0.0";

export type SolaReportRow = Record<string, unknown>;

type SolaReportingResponse = {
  Result?: string;
  xResult?: string;
  result?: string;
  Error?: string;
  xError?: string;
  error?: string;
  xReportData?: unknown;
  XReportData?: unknown;
  ReportData?: unknown;
  reportData?: unknown;
  [key: string]: unknown;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current);
  return values;
}

function parseDelimitedRows(value: string): SolaReportRow[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (row): row is SolaReportRow =>
          Boolean(row) && typeof row === "object" && !Array.isArray(row)
      );
    }
  } catch {
    // Fall through to CSV parsing.
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] || ""])
    );
  });
}

export function parseSolaReportRows(value: unknown): SolaReportRow[] {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is SolaReportRow =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row)
    );
  }

  if (typeof value === "string") {
    return parseDelimitedRows(value);
  }

  return [];
}

export async function callSolaReportingApi(
  body: Record<string, unknown>
): Promise<SolaReportingResponse> {
  const key =
    process.env.SOLA_REPORTING_API_KEY || process.env.SOLA_API_KEY;

  if (!key) {
    throw new Error("SOLA_REPORTING_API_KEY or SOLA_API_KEY is missing.");
  }

  const response = await fetch(SOLA_REPORTING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      xKey: key,
      xVersion: SOLA_REPORTING_VERSION,
      xSoftwareName:
        process.env.SOLA_SOFTWARE_NAME || "Khal Bnei Aliya Portal",
      xSoftwareVersion:
        process.env.SOLA_SOFTWARE_VERSION || "1.0.0",
      ...body,
    }),
    cache: "no-store",
  });

  const text = await response.text();
  let data: SolaReportingResponse;

  try {
    data = text ? (JSON.parse(text) as SolaReportingResponse) : {};
  } catch {
    throw new Error(
      `Sola reporting returned an invalid response. HTTP ${response.status}.`
    );
  }

  const result = String(
    data.Result || data.xResult || data.result || ""
  ).toUpperCase();

  if (!response.ok || result === "E") {
    throw new Error(
      String(data.Error || data.xError || data.error || "") ||
        `Sola reporting failed. HTTP ${response.status}.`
    );
  }

  return data;
}
