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

function normalizeWhitespace(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[‐-‒–—]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForParsing(value: string) {
  return normalizeWhitespace(value)
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCapturedText(value: string | undefined) {
  return normalizeWhitespace(value || "")
    .replace(/^[|•➢>\-\s]+/, "")
    .replace(/[|•➢>\-\s]+$/, "")
    .trim();
}

function normalizeTime(value: string | undefined) {
  const time = cleanCapturedText(value);

  if (!time) {
    return "";
  }

  const match = time.match(
    /\b(\d{1,2}:\d{2}|\d{1,2})\s*(AM|PM)?\b/i
  );

  if (!match) {
    return "";
  }

  const numericTime = match[1];
  const meridiem = match[2]?.toUpperCase();

  return meridiem
    ? `${numericTime} ${meridiem}`
    : numericTime;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(
  text: string,
  startPattern: RegExp,
  endPatterns: RegExp[]
) {
  const startMatch = startPattern.exec(text);

  if (!startMatch || startMatch.index === undefined) {
    return "";
  }

  const startIndex =
    startMatch.index + startMatch[0].length;

  let endIndex = text.length;

  for (const endPattern of endPatterns) {
    const remainingText = text.slice(startIndex);
    const endMatch = endPattern.exec(remainingText);

    if (
      endMatch &&
      endMatch.index !== undefined &&
      startIndex + endMatch.index < endIndex
    ) {
      endIndex = startIndex + endMatch.index;
    }
  }

  return text.slice(startIndex, endIndex).trim();
}

function findEventTime(
  section: string,
  labelPatterns: RegExp[]
) {
  for (const labelPattern of labelPatterns) {
    const labelMatch = labelPattern.exec(section);

    if (
      !labelMatch ||
      labelMatch.index === undefined
    ) {
      continue;
    }

    const labelStart = labelMatch.index;
    const labelEnd =
      labelStart + labelMatch[0].length;

    const before = section.slice(
      Math.max(0, labelStart - 25),
      labelStart
    );

    const after = section.slice(
      labelEnd,
      Math.min(section.length, labelEnd + 25)
    );

    const beforeTimes = [
      ...before.matchAll(
        /(\d{1,2}:\d{2}|\d{1,2})\s*(AM|PM)?/gi
      ),
    ];

    if (beforeTimes.length > 0) {
      const closest =
        beforeTimes[beforeTimes.length - 1];

      return normalizeTime(
        `${closest[1]} ${closest[2] || ""}`
      );
    }

    const afterTime = after.match(
      /(\d{1,2}:\d{2}|\d{1,2})\s*(AM|PM)?/i
    );

    if (afterTime) {
      return normalizeTime(
        `${afterTime[1]} ${afterTime[2] || ""}`
      );
    }
  }

  return "";
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

function removeNullEntries(
  entries: Array<ParsedScheduleEntry | null>
) {
  return entries.filter(
    (
      entry
    ): entry is ParsedScheduleEntry =>
      entry !== null
  );
}

function detectHebrewTitle(text: string) {
  const match = text.match(
    /(פרשת\s+[\u0590-\u05FF״׳"'־\-\s]{2,40})/u
  );

  if (!match) {
    return "";
  }

  const title = cleanCapturedText(match[1]);

  return title.length <= 60 ? title : "";
}

function detectHebrewDate(text: string) {
  const hebrewMonths =
    "תשרי|חשון|מרחשון|כסלו|טבת|שבט|אדר|ניסן|אייר|סיון|תמוז|אב|אלול";

  const match = text.match(
    new RegExp(
      `([א-ת״׳"'\\s]{1,12}\\s+(?:${hebrewMonths}))`,
      "u"
    )
  );

  if (!match) {
    return "";
  }

  const date = cleanCapturedText(match[1]);

  return date.length <= 30 ? date : "";
}

function detectEnglishTitle(text: string) {
  const parshaMatch = text.match(
    /\b(?:Parshas?|Parashas?)\s+([A-Za-z' -]{2,40})/i
  );

  if (parshaMatch) {
    return cleanCapturedText(
      `Parshas ${parshaMatch[1]}`
    );
  }

  return "";
}

function detectScheduleType(
  text: string
): ParsedKbaSchedule["scheduleType"] {
  const normalized = text.toLowerCase();

  const hasYomTov =
    /\byom tov\b|\berev yom tov\b|\bfirst day\b|\bsecond day\b/.test(
      normalized
    );

  const hasShabbos =
    /\bshabbos\b|\bkabbalas shabbos\b/.test(
      normalized
    );

  if (hasYomTov && hasShabbos) {
    return "yom_tov_shabbos";
  }

  if (hasYomTov) {
    return "yom_tov";
  }

  if (
    /\bfast day\b|\btaanis\b|\btaanit\b|תענית/.test(
      normalized
    )
  ) {
    return "fast_day";
  }

  return "shabbos";
}

function parseFriday(
  text: string
): ParsedScheduleDay | null {
  const section = extractSection(
    text,
    /\bFRIDAY\b(?:\s*\([^)]+\))?/i,
    [
      /\bSHABBOS\b(?:\s*\([^)]+\))?/i,
      /\bANNOUNCEMENTS?\b/i,
    ]
  );

  if (!section) {
    return null;
  }

  const entries = removeNullEntries([
    createEntry(
      "Mincha / Kabbalas Shabbos / Maariv",
      findEventTime(section, [
        /MINCHA\s*\/\s*KABBALAS\s+SHABBOS\s*\/\s*MAARIV/i,
      ])
    ),

    createEntry(
      "Plag Hamincha / Candle Lighting",
      findEventTime(section, [
        /PLAG\s+HAMINCHA[^0-9]{0,40}CANDLE\s+LIGHTING/i,
        /PLAG[^0-9]{0,40}CANDLE\s+LIGHTING/i,
      ])
    ),

    createEntry(
      "Shkia",
      findEventTime(section, [/\bSHKIA\b/i])
    ),
  ]);

  if (entries.length === 0) {
    return null;
  }

  return {
    dayTitle: "Friday",
    dayDate: "",
    hebrewDayTitle: "",
    entries,
  };
}

function parseShabbos(
  text: string
): ParsedScheduleDay | null {
  const section = extractSection(
    text,
    /\bSHABBOS\b(?:\s*\([^)]+\))?/i,
    [/\bANNOUNCEMENTS?\b/i]
  );

  if (!section) {
    return null;
  }

  const shacharis = createEntry(
    "Shacharis",
    findEventTime(section, [
      /\bSHACHARIS\b/i,
    ])
  );

  const sofZmanShema = createEntry(
    "Sof Zman Krias Shema",
    findEventTime(section, [
      /SOF\s+ZMAN\s+KRIAS\s+SHEMA/i,
    ])
  );

  const kiddush = /please join us for kiddush after davening/i.test(
    section
  )
    ? createEntry(
        "Kiddush",
        "",
        "Please join us for Kiddush after davening.",
        true
      )
    : null;

  const halachaChabura = createEntry(
    "Halacha Chabura",
    findEventTime(section, [
      /HALACHA\s+CHABURA/i,
    ]),
    (() => {
      const match = section.match(
        /HALACHA\s+CHABURA\s*:?\s*([A-Za-z'’ -]{3,60}?)(?=\s+\d{1,2}:\d{2}\s+MINCHA|\s+MINCHA\b)/i
      );

      return cleanCapturedText(match?.[1]);
    })()
  );

  const mincha = createEntry(
    "Mincha",
    findEventTime(section, [
      /\bMINCHA\b/i,
    ])
  );

  const shkia = createEntry(
    "Shkia",
    findEventTime(section, [
      /\bSHKIA\b/i,
    ])
  );

  const shaarHabitachon = createEntry(
    "Shaar Habitachon",
    findEventTime(section, [
      /SHAAR\s+HABITACHON/i,
    ])
  );

  const maariv = createEntry(
    "Maariv",
    findEventTime(section, [
      /\bMAARIV\b/i,
    ])
  );

  const entries = removeNullEntries([
    shacharis,
    sofZmanShema,
    kiddush,
    halachaChabura,
    mincha,
    shkia,
    shaarHabitachon,
    maariv,
  ]);

  if (entries.length === 0) {
    return null;
  }

  return {
    dayTitle: "Shabbos",
    dayDate: "",
    hebrewDayTitle: "",
    entries,
  };
}

function parseGeneralNote(text: string) {
  const match = text.match(
    /(Krias Shema should be repeated after\s+\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i
  );

  return cleanCapturedText(match?.[1]);
}

function parseAnnouncements(
  text: string
): ParsedAnnouncement[] {
  const announcements: ParsedAnnouncement[] =
    [];

  const announcementSection =
    extractSection(
      text,
      /\bANNOUNCEMENTS?\b/i,
      [
        /\bHaRav\s+Avigdor\s+Gutnicki\b/i,
        /\bKhal\s+Bnei\s+Aliyah?\s+Inc\b/i,
      ]
    ) || "";

  if (!announcementSection) {
    return announcements;
  }

  const nerLamaorMatch =
    announcementSection.match(
      /Ner\s+Lamaor\s+for\s+the\s+month\s+of\s+([A-Za-z]+)\s+is\s+sponsored\s+by\s+the\s+(.+?)(?=\s+To\s+inquire|\s+Future\s+kiddush|$)/i
    );

  if (nerLamaorMatch) {
    const month = cleanCapturedText(
      nerLamaorMatch[1]
    );

    const sponsorName = cleanCapturedText(
      nerLamaorMatch[2]
    );

    if (sponsorName.length <= 150) {
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
  }

  const sponsorshipMatch =
    announcementSection.match(
      /To\s+inquire\s+about\s+future\s+kiddush\s+sponsorships.*?(?:reach\s+out\s+to|contact)\s+([A-Za-z' -]{2,60})\s+at\s+(\d{3}[-.\s]\d{3}[-.\s]\d{4})/i
    );

  if (sponsorshipMatch) {
    announcements.push({
      announcementType: "sponsorship",
      title: "Kiddush Sponsorships",
      body:
        "To inquire about future Kiddush sponsorships, please contact the person listed below.",
      sponsorName: "",
      contactName: cleanCapturedText(
        sponsorshipMatch[1]
      ),
      contactPhone: cleanCapturedText(
        sponsorshipMatch[2]
      ),
      contactEmail: "",
    });
  }

  return announcements;
}

function pageTextToString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : String(item || "")
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

  /*
   * Keep pages separate. Previously mergePages caused the
   * entire PDF to become one giant line.
   */
  const result = await extractText(pdf, {
    mergePages: false,
  });

  const rawPageText = Array.isArray(result.text)
    ? result.text
        .map(pageTextToString)
        .join("\n\n")
    : pageTextToString(result.text);

  const extractedText =
    normalizeWhitespace(rawPageText);

  const parsingText =
    normalizeForParsing(extractedText);

  if (!parsingText) {
    throw new Error(
      "No readable text was found in the PDF."
    );
  }

  const days: ParsedScheduleDay[] = [];

  const friday = parseFriday(parsingText);
  const shabbos = parseShabbos(parsingText);

  if (friday) {
    days.push(friday);
  }

  if (shabbos) {
    days.push(shabbos);
  }

  return {
    englishTitle:
      detectEnglishTitle(parsingText),
    hebrewTitle:
      detectHebrewTitle(parsingText),
    hebrewDate:
      detectHebrewDate(parsingText),
    scheduleType:
      detectScheduleType(parsingText),
    days,
    announcements:
      parseAnnouncements(parsingText),
    generalNote:
      parseGeneralNote(parsingText),
    extractedText,
  };
}