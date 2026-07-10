import { extractText, getDocumentProxy } from "unpdf";

export type ParsedScheduleEntry = {
  eventName: string;
  eventTime: string;
  note: string;
  isHighlighted: boolean;
};

export type ParsedScheduleDay = {
  dayTitle: string;
  dayDate: string;
  hebrewDayTitle: string;
  entries: ParsedScheduleEntry[];
};

export type ParsedAnnouncement = {
  announcementType:
    | "kiddush"
    | "simcha"
    | "mazel_tov"
    | "ner_lamaor"
    | "shiur"
    | "sponsorship"
    | "general";
  title: string;
  body: string;
  sponsorName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

export type ParsedKbaSchedule = {
  englishTitle: string;
  hebrewTitle: string;
  hebrewDate: string;
  scheduleType:
    | "shabbos"
    | "yom_tov"
    | "yom_tov_shabbos"
    | "fast_day"
    | "special";
  days: ParsedScheduleDay[];
  announcements: ParsedAnnouncement[];
  generalNote: string;
  extractedText: string;
};

function clean(value: string | undefined | null) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[‐-‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTime(value: string | undefined) {
  const time = clean(value);

  if (!time) return "";

  if (/\b(?:AM|PM)\b/i.test(time)) {
    return time.toUpperCase();
  }

  return time;
}

function firstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1] ? formatTime(match[1]) : "";
}

function createEntry(
  eventName: string,
  eventTime: string,
  note = "",
  isHighlighted = false
): ParsedScheduleEntry | null {
  if (!eventTime && !note) {
    return null;
  }

  return {
    eventName,
    eventTime,
    note,
    isHighlighted,
  };
}

function removeEmptyEntries(
  entries: Array<ParsedScheduleEntry | null>
): ParsedScheduleEntry[] {
  return entries.filter(
    (entry): entry is ParsedScheduleEntry => Boolean(entry)
  );
}

function sectionBetween(
  text: string,
  start: RegExp,
  end: RegExp
) {
  const startMatch = start.exec(text);

  if (!startMatch || startMatch.index === undefined) {
    return "";
  }

  const sectionStart =
    startMatch.index + startMatch[0].length;

  const remaining = text.slice(sectionStart);
  const endMatch = end.exec(remaining);

  return endMatch?.index === undefined
    ? remaining
    : remaining.slice(0, endMatch.index);
}

function parseFriday(text: string): ParsedScheduleDay | null {
  const section = sectionBetween(
    text,
    /\bFRIDAY\s*\([^)]+\)/i,
    /\bSHABBOS\s*\([^)]+\)/i
  );

  if (!section) return null;

  const mincha = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+MINCHA\s*\/\s*KABBALAS\s+SHABBOS\s*\/\s*MAARIV/i
  );

  const candleLighting = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+PLAG\s+HAMINCHA[\s\S]{0,50}?CANDLE\s+LIGHTING/i
  );

  const shkia = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+SHKIA/i
  );

  const entries = removeEmptyEntries([
    createEntry(
      "Mincha / Kabbalas Shabbos / Maariv",
      mincha
    ),
    createEntry(
      "Plag Hamincha / Candle Lighting",
      candleLighting
    ),
    createEntry("Shkia", shkia),
  ]);

  if (!entries.length) return null;

  return {
    dayTitle: "Friday",
    dayDate: "",
    hebrewDayTitle: "",
    entries,
  };
}

function parseShabbos(text: string): ParsedScheduleDay | null {
  const section = sectionBetween(
    text,
    /\bSHABBOS\s*\([^)]+\)/i,
    /\bANNOUNCEMENTS?\b/i
  );

  if (!section) return null;

  const shacharis = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+SHACHARIS/i
  );

  const sofZman = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+SOF\s+ZMAN\s+KRIAS\s+SHEMA/i
  );

  const halachaChabura = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+HALACHA\s+CHABURA/i
  );

  const mincha = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+MINCHA\b/i
  );

  const shkia = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+SHKIA\b/i
  );

  const shaarHabitachon = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+SHAAR\s+HABITACHON/i
  );

  const maariv = firstMatch(
    section,
    /(\d{1,2}:\d{2})\s+MAARIV\b/i
  );

  const chaburaTopicMatch = section.match(
    /HALACHA\s+CHABURA\s*:\s*(.+?)(?=\s+\d{1,2}:\d{2}\s+MINCHA)/i
  );

  const chaburaTopic = clean(chaburaTopicMatch?.[1]);

  const hasKiddush =
    /Please join us for Kiddush after davening/i.test(
      section
    );

  const entries = removeEmptyEntries([
    createEntry("Shacharis", shacharis),

    createEntry(
      "Sof Zman Krias Shema",
      sofZman
    ),

    hasKiddush
      ? createEntry(
          "Kiddush",
          "",
          "Please join us for Kiddush after davening.",
          true
        )
      : null,

    createEntry(
      "Halacha Chabura",
      halachaChabura,
      chaburaTopic
    ),

    createEntry("Mincha", mincha),
    createEntry("Shkia", shkia),

    createEntry(
      "Shaar Habitachon",
      shaarHabitachon
    ),

    createEntry("Maariv", maariv),
  ]);

  if (!entries.length) return null;

  return {
    dayTitle: "Shabbos",
    dayDate: "",
    hebrewDayTitle: "",
    entries,
  };
}

function parseAnnouncements(
  text: string
): ParsedAnnouncement[] {
  const announcements: ParsedAnnouncement[] = [];

  const nerMatch = text.match(
    /Ner\s+Lamaor\s+for\s+the\s+month\s+of\s+([A-Za-z]+)\s+is\s+sponsored\s+by\s+the\s+(.+?)(?=\s+To\s+inquire)/i
  );

  if (nerMatch) {
    const month = clean(nerMatch[1]);
    const sponsorName = clean(nerMatch[2]);

    announcements.push({
      announcementType: "ner_lamaor",
      title: "Ner Lamaor",
      body: `Ner Lamaor for the month of ${month} is sponsored by the ${sponsorName}.`,
      sponsorName,
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    });
  }

  const sponsorshipMatch = text.match(
    /To\s+inquire\s+about\s+future\s+kiddush\s+sponsorships.*?reach\s+out\s+to\s+([A-Za-z' -]+?)\s+at\s+(\d{3}-\d{3}-\d{4})/i
  );

  if (sponsorshipMatch) {
    announcements.push({
      announcementType: "sponsorship",
      title: "Kiddush Sponsorships",
      body:
        "To inquire about future Kiddush sponsorships, please contact the person listed below.",
      sponsorName: "",
      contactName: clean(sponsorshipMatch[1]),
      contactPhone: clean(sponsorshipMatch[2]),
      contactEmail: "",
    });
  }

  return announcements;
}

function parseGeneralNote(text: string) {
  const match = text.match(
    /(Krias Shema should be repeated after\s+\d{1,2}:\d{2})/i
  );

  return clean(match?.[1]);
}

function parseHebrewTitle(text: string) {
  const match = text.match(
    /(פרשת\s+[\u0590-\u05FF״׳"'־ -]{2,35})/u
  );

  const value = clean(match?.[1]);

  return value.length <= 55 ? value : "";
}

function parseHebrewDate(text: string) {
  const match = text.match(
    /([א-ת״׳"']{1,8}\s+(?:תשרי|חשון|מרחשון|כסלו|טבת|שבט|אדר|ניסן|אייר|סיון|תמוז|אב|אלול))/u
  );

  const value = clean(match?.[1]);

  return value.length <= 30 ? value : "";
}

function detectScheduleType(
  text: string
): ParsedKbaSchedule["scheduleType"] {
  const normalized = text.toLowerCase();

  const yomTov =
    normalized.includes("yom tov") ||
    normalized.includes("erev yom tov") ||
    normalized.includes("first day yom tov") ||
    normalized.includes("second day yom tov");

  const shabbos =
    normalized.includes("shabbos") ||
    normalized.includes("kabbalas shabbos");

  if (yomTov && shabbos) {
    return "yom_tov_shabbos";
  }

  if (yomTov) {
    return "yom_tov";
  }

  return "shabbos";
}

function convertExtractedText(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((part) =>
        typeof part === "string"
          ? part
          : String(part || "")
      )
      .join("\n");
  }

  return String(value || "");
}

export async function parseKbaSchedulePdf(
  file: File
): Promise<ParsedKbaSchedule> {
  const bytes = new Uint8Array(
    await file.arrayBuffer()
  );

  const pdf = await getDocumentProxy(bytes);

  const result = await extractText(pdf, {
    mergePages: false,
  });

  const rawText = Array.isArray(result.text)
    ? result.text
        .map(convertExtractedText)
        .join("\n")
    : convertExtractedText(result.text);

  const extractedText = clean(rawText);

  if (!extractedText) {
    throw new Error(
      "No readable text was found in the PDF."
    );
  }

  const days = [
    parseFriday(extractedText),
    parseShabbos(extractedText),
  ].filter(
    (day): day is ParsedScheduleDay =>
      day !== null
  );

  return {
    englishTitle: "",
    hebrewTitle: parseHebrewTitle(extractedText),
    hebrewDate: parseHebrewDate(extractedText),
    scheduleType:
      detectScheduleType(extractedText),
    days,
    announcements:
      parseAnnouncements(extractedText),
    generalNote:
      parseGeneralNote(extractedText),
    extractedText,
  };
}