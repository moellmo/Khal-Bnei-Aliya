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

function cleanText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

function normalizeTime(value: string) {
  const cleaned = value
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(
    /\b(\d{1,2}:\d{2}|\d{1,2})\s*(AM|PM)?\b/i
  );

  if (!match) return "";

  const rawTime = match[1];
  const meridiem = match[2]?.toUpperCase();

  return meridiem ? `${rawTime} ${meridiem}` : rawTime;
}

function findLine(
  lines: string[],
  matcher: RegExp,
  startIndex = 0,
  endIndex = lines.length
) {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (matcher.test(lines[index])) {
      return {
        index,
        line: lines[index],
      };
    }
  }

  return null;
}

function getSectionBounds(
  lines: string[],
  heading: RegExp,
  followingHeadings: RegExp[]
) {
  const start = findLine(lines, heading);

  if (!start) {
    return null;
  }

  let end = lines.length;

  for (const followingHeading of followingHeadings) {
    const found = findLine(
      lines,
      followingHeading,
      start.index + 1
    );

    if (found && found.index < end) {
      end = found.index;
    }
  }

  return {
    start: start.index + 1,
    end,
  };
}

function parseEntryFromSection(
  lines: string[],
  start: number,
  end: number,
  matcher: RegExp,
  label: string
): ParsedScheduleEntry | null {
  for (let index = start; index < end; index += 1) {
    const line = lines[index];

    if (!matcher.test(line)) {
      continue;
    }

    const time = normalizeTime(line);

    if (time) {
      return {
        eventName: label,
        eventTime: time,
        note: "",
        isHighlighted: false,
      };
    }

    for (
      let lookAhead = index + 1;
      lookAhead <= Math.min(index + 2, end - 1);
      lookAhead += 1
    ) {
      const nearbyTime = normalizeTime(lines[lookAhead]);

      if (nearbyTime) {
        return {
          eventName: label,
          eventTime: nearbyTime,
          note: "",
          isHighlighted: false,
        };
      }
    }
  }

  return null;
}

function parseSectionEntries(
  lines: string[],
  start: number,
  end: number,
  definitions: Array<{
    matcher: RegExp;
    label: string;
  }>
) {
  return definitions
    .map(({ matcher, label }) =>
      parseEntryFromSection(
        lines,
        start,
        end,
        matcher,
        label
      )
    )
    .filter(
      (entry): entry is ParsedScheduleEntry =>
        entry !== null
    );
}

function detectEnglishTitle(lines: string[]) {
  const ignored = [
    /^friday\b/i,
    /^shabbos\b/i,
    /^announcements?\b/i,
    /^weekday\b/i,
    /^please join\b/i,
    /^dues\b/i,
    /^khal bnei/i,
  ];

  for (const line of lines.slice(0, 12)) {
    if (
      line.length >= 3 &&
      line.length <= 80 &&
      !ignored.some((pattern) => pattern.test(line)) &&
      !/\d{1,2}:\d{2}/.test(line) &&
      !/^\d/.test(line)
    ) {
      return line;
    }
  }

  return "Weekly Shul Schedule";
}

function detectHebrewTitle(lines: string[]) {
  return (
    lines.find(
      (line) =>
        /[\u0590-\u05FF]/.test(line) &&
        /פרשת|יום טוב|ראש השנה|סוכות|פסח|שבועות/.test(
          line
        )
    ) || ""
  );
}

function detectHebrewDate(lines: string[]) {
  return (
    lines.find(
      (line) =>
        /[\u0590-\u05FF]/.test(line) &&
        /תשרי|חשון|כסלו|טבת|שבט|אדר|ניסן|אייר|סיון|תמוז|אב|אלול/.test(
          line
        )
    ) || ""
  );
}

function parseAnnouncements(
  lines: string[]
): ParsedAnnouncement[] {
  const heading = findLine(lines, /^announcements?$/i);

  if (!heading) {
    return [];
  }

  const announcementLines = lines
    .slice(heading.index + 1)
    .filter(Boolean);

  const combined = announcementLines.join(" ");

  const announcements: ParsedAnnouncement[] = [];

  const nerMatch = combined.match(
    /Ner Lamaor[\s\S]*?sponsored by the\s+(.+?)(?=To inquire|$)/i
  );

  if (nerMatch) {
    const sponsorName = cleanText(nerMatch[1]);

    announcements.push({
      announcementType: "ner_lamaor",
      title: "Ner Lamaor",
      body: `Sponsored by the ${sponsorName}.`,
      sponsorName,
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    });
  }

  const sponsorshipMatch = combined.match(
    /To inquire about future kiddush sponsorships.*?reach out to\s+(.+?)\s+at\s+([\d()-]{7,})/i
  );

  if (sponsorshipMatch) {
    announcements.push({
      announcementType: "sponsorship",
      title: "Kiddush Sponsorships",
      body:
        "To inquire about future Kiddush sponsorships, please contact the person listed below.",
      sponsorName: "",
      contactName: cleanText(sponsorshipMatch[1]),
      contactPhone: cleanText(sponsorshipMatch[2]),
      contactEmail: "",
    });
  }

  if (
    /please join us for kiddush after davening/i.test(
      combined
    )
  ) {
    announcements.push({
      announcementType: "kiddush",
      title: "Kiddush",
      body: "Please join us for Kiddush after davening.",
      sponsorName: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    });
  }

  return announcements;
}

function detectGeneralNote(lines: string[]) {
  return (
    lines.find((line) =>
      /Krias Shema should be repeated after/i.test(line)
    ) || ""
  );
}

function detectScheduleType(text: string) {
  const normalized = text.toLowerCase();

  const hasYomTov =
    /yom tov|first day|second day|erev yom tov/.test(
      normalized
    );

  const hasShabbos = /shabbos|kabbalas shabbos/.test(
    normalized
  );

  if (hasYomTov && hasShabbos) {
    return "yom_tov_shabbos" as const;
  }

  if (hasYomTov) {
    return "yom_tov" as const;
  }

  if (/fast day|taanis|תענית/.test(normalized)) {
    return "fast_day" as const;
  }

  return "shabbos" as const;
}

export async function parseKbaSchedulePdf(
  file: File
): Promise<ParsedKbaSchedule> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  const pdf = await getDocumentProxy(bytes);
  const result = await extractText(pdf, {
    mergePages: true,
  });

  const extractedText = cleanText(
    Array.isArray(result.text)
      ? result.text.join("\n")
      : result.text
  );

  const lines = extractedText
    .split("\n")
    .map(cleanText)
    .filter(Boolean);

  const fridayBounds = getSectionBounds(
    lines,
    /^friday\b/i,
    [/^shabbos\b/i, /^announcements?$/i]
  );

  const shabbosBounds = getSectionBounds(
    lines,
    /^shabbos\b/i,
    [/^announcements?$/i]
  );

  const days: ParsedScheduleDay[] = [];

  if (fridayBounds) {
    const entries = parseSectionEntries(
      lines,
      fridayBounds.start,
      fridayBounds.end,
      [
        {
          matcher:
            /mincha\s*\/\s*kabbalas shabbos\s*\/\s*maariv/i,
          label: "Mincha / Kabbalas Shabbos / Maariv",
        },
        {
          matcher:
            /plag hamincha.*candle lighting/i,
          label: "Plag Hamincha / Candle Lighting",
        },
        {
          matcher: /^.*shkia.*$/i,
          label: "Shkia",
        },
      ]
    );

    if (entries.length > 0) {
      days.push({
        dayTitle: "Friday",
        dayDate: "",
        hebrewDayTitle: "",
        entries,
      });
    }
  }

  if (shabbosBounds) {
    const entries = parseSectionEntries(
      lines,
      shabbosBounds.start,
      shabbosBounds.end,
      [
        {
          matcher: /shacharis/i,
          label: "Shacharis",
        },
        {
          matcher: /sof zman krias shema/i,
          label: "Sof Zman Krias Shema",
        },
        {
          matcher: /halacha chabura/i,
          label: "Halacha Chabura",
        },
        {
          matcher: /^.*mincha.*$/i,
          label: "Mincha",
        },
        {
          matcher: /^.*shkia.*$/i,
          label: "Shkia",
        },
        {
          matcher: /shaar habitachon/i,
          label: "Shaar Habitachon",
        },
        {
          matcher: /^.*maariv.*$/i,
          label: "Maariv",
        },
      ]
    );

    if (
      extractedText.match(
        /please join us for kiddush after davening/i
      )
    ) {
      const shacharisIndex = entries.findIndex(
        (entry) => entry.eventName === "Shacharis"
      );

      entries.splice(
        shacharisIndex >= 0 ? shacharisIndex + 1 : 1,
        0,
        {
          eventName: "Kiddush",
          eventTime: "",
          note:
            "Please join us for Kiddush after davening.",
          isHighlighted: true,
        }
      );
    }

    if (entries.length > 0) {
      days.push({
        dayTitle: "Shabbos",
        dayDate: "",
        hebrewDayTitle: "",
        entries,
      });
    }
  }

  return {
    englishTitle: detectEnglishTitle(lines),
    hebrewTitle: detectHebrewTitle(lines),
    hebrewDate: detectHebrewDate(lines),
    scheduleType: detectScheduleType(extractedText),
    days,
    announcements: parseAnnouncements(lines),
    generalNote: detectGeneralNote(lines),
    extractedText,
  };
}