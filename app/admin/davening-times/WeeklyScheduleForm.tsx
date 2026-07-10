"use client";

import { useMemo, useState } from "react";
import { uploadWeeklySchedule } from "./actions";

type ScheduleEntry = {
  id: string;
  eventName: string;
  eventTime: string;
  note: string;
  isHighlighted: boolean;
};

type ScheduleDay = {
  id: string;
  dayTitle: string;
  dayDate: string;
  hebrewDayTitle: string;
  entries: ScheduleEntry[];
};

type AnnouncementType =
  | "kiddush"
  | "simcha"
  | "mazel_tov"
  | "ner_lamaor"
  | "shiur"
  | "sponsorship"
  | "general";

type Announcement = {
  id: string;
  announcementType: AnnouncementType;
  title: string;
  body: string;
  sponsorName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEntry(
  eventName = "",
  eventTime = ""
): ScheduleEntry {
  return {
    id: createId(),
    eventName,
    eventTime,
    note: "",
    isHighlighted: false,
  };
}

function createDay(
  dayTitle = "",
  entries: ScheduleEntry[] = [createEntry()]
): ScheduleDay {
  return {
    id: createId(),
    dayTitle,
    dayDate: "",
    hebrewDayTitle: "",
    entries,
  };
}

function createAnnouncement(): Announcement {
  return {
    id: createId(),
    announcementType: "general",
    title: "",
    body: "",
    sponsorName: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  };
}

const regularShabbosTemplate: ScheduleDay[] = [
  createDay("Friday", [
    createEntry("Mincha / Kabbalas Shabbos / Maariv"),
    createEntry("Plag Hamincha / Candle Lighting"),
    createEntry("Shkia"),
  ]),
  createDay("Shabbos", [
    createEntry("Shacharis"),
    createEntry("Sof Zman Krias Shema"),
    createEntry("Kiddush"),
    createEntry("Halacha Chabura"),
    createEntry("Mincha"),
    createEntry("Shkia"),
    createEntry("Shaar Habitachon"),
    createEntry("Maariv"),
  ]),
];

export default function WeeklyScheduleForm() {
  const [days, setDays] = useState<ScheduleDay[]>(
    regularShabbosTemplate
  );

  const [announcements, setAnnouncements] = useState<
    Announcement[]
  >([]);

  const scheduleDaysJson = useMemo(
    () =>
      JSON.stringify(
        days.map((day) => ({
          dayTitle: day.dayTitle,
          dayDate: day.dayDate,
          hebrewDayTitle: day.hebrewDayTitle,
          entries: day.entries.map((entry) => ({
            eventName: entry.eventName,
            eventTime: entry.eventTime,
            note: entry.note,
            isHighlighted: entry.isHighlighted,
          })),
        }))
      ),
    [days]
  );

  const announcementsJson = useMemo(
    () =>
      JSON.stringify(
        announcements.map((announcement) => ({
          announcementType: announcement.announcementType,
          title: announcement.title,
          body: announcement.body,
          sponsorName: announcement.sponsorName,
          contactName: announcement.contactName,
          contactPhone: announcement.contactPhone,
          contactEmail: announcement.contactEmail,
        }))
      ),
    [announcements]
  );

  function addDay() {
    setDays((current) => [...current, createDay()]);
  }

  function removeDay(dayId: string) {
    setDays((current) =>
      current.filter((day) => day.id !== dayId)
    );
  }

  function moveDay(dayIndex: number, direction: -1 | 1) {
    setDays((current) => {
      const nextIndex = dayIndex + direction;

      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const copy = [...current];
      const currentDay = copy[dayIndex];

      copy[dayIndex] = copy[nextIndex];
      copy[nextIndex] = currentDay;

      return copy;
    });
  }

  function updateDay(
    dayId: string,
    field: keyof Omit<ScheduleDay, "id" | "entries">,
    value: string
  ) {
    setDays((current) =>
      current.map((day) =>
        day.id === dayId ? { ...day, [field]: value } : day
      )
    );
  }

  function addEntry(dayId: string) {
    setDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              entries: [...day.entries, createEntry()],
            }
          : day
      )
    );
  }

  function removeEntry(dayId: string, entryId: string) {
    setDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              entries: day.entries.filter(
                (entry) => entry.id !== entryId
              ),
            }
          : day
      )
    );
  }

  function updateEntry(
    dayId: string,
    entryId: string,
    field: keyof Omit<ScheduleEntry, "id">,
    value: string | boolean
  ) {
    setDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              entries: day.entries.map((entry) =>
                entry.id === entryId
                  ? { ...entry, [field]: value }
                  : entry
              ),
            }
          : day
      )
    );
  }

  function addAnnouncement() {
    setAnnouncements((current) => [
      ...current,
      createAnnouncement(),
    ]);
  }

  function removeAnnouncement(announcementId: string) {
    setAnnouncements((current) =>
      current.filter(
        (announcement) => announcement.id !== announcementId
      )
    );
  }

  function updateAnnouncement(
    announcementId: string,
    field: keyof Omit<Announcement, "id">,
    value: string
  ) {
    setAnnouncements((current) =>
      current.map((announcement) =>
        announcement.id === announcementId
          ? {
              ...announcement,
              [field]: value,
            }
          : announcement
      )
    );
  }

  function loadYomTovTemplate() {
    setDays([
      createDay("Erev Yom Tov", [
        createEntry("Mincha"),
        createEntry("Candle Lighting"),
        createEntry("Maariv"),
      ]),
      createDay("First Day Yom Tov", [
        createEntry("Shacharis"),
        createEntry("Kiddush"),
        createEntry("Mincha"),
        createEntry("Maariv"),
        createEntry("Candle Lighting"),
      ]),
      createDay("Second Day Yom Tov", [
        createEntry("Shacharis"),
        createEntry("Kiddush"),
        createEntry("Mincha"),
        createEntry("Maariv"),
      ]),
    ]);
  }

  function loadShabbosTemplate() {
    setDays([
      createDay("Friday", [
        createEntry("Mincha / Kabbalas Shabbos / Maariv"),
        createEntry("Plag Hamincha / Candle Lighting"),
        createEntry("Shkia"),
      ]),
      createDay("Shabbos", [
        createEntry("Shacharis"),
        createEntry("Sof Zman Krias Shema"),
        createEntry("Kiddush"),
        createEntry("Halacha Chabura"),
        createEntry("Mincha"),
        createEntry("Shkia"),
        createEntry("Shaar Habitachon"),
        createEntry("Maariv"),
      ]),
    ]);
  }

  return (
    <form
      action={uploadWeeklySchedule}
      className="mt-8 space-y-7 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8"
    >
      <input
        type="hidden"
        name="schedule_days_json"
        value={scheduleDaysJson}
      />

      <input
        type="hidden"
        name="announcements_json"
        value={announcementsJson}
      />

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e]">
          Weekly Schedule
        </p>

        <h2 className="mt-2 text-2xl font-bold">
          Create Shabbos or Yom Tov Schedule
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Add as many days as needed. The schedule will first be saved as a
          draft so it can be reviewed before publishing.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="English Title"
          name="title"
          placeholder="Parshas Matos-Masei"
          required
        />

        <Field
          label="Hebrew Title"
          name="hebrew_title"
          placeholder="פרשת מטות-מסעי"
          dir="rtl"
        />

        <Field
          label="Hebrew Date"
          name="hebrew_date"
          placeholder='כ"ו תמוז'
          dir="rtl"
        />

        <label className="space-y-2">
          <span className="font-semibold">Schedule Type</span>

          <select
            name="schedule_type"
            defaultValue="shabbos"
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
          >
            <option value="shabbos">Regular Shabbos</option>
            <option value="yom_tov">Yom Tov</option>
            <option value="yom_tov_shabbos">
              Yom Tov and Shabbos
            </option>
            <option value="fast_day">Fast Day</option>
            <option value="special">Special Schedule</option>
          </select>
        </label>

        <Field
          label="Effective From"
          name="start_date"
          type="date"
          required
        />

        <Field
          label="Effective To"
          name="end_date"
          type="date"
          required
        />

        <Field
          label="Subtitle"
          name="subtitle"
          placeholder="This week at Khal Bnei Aliya"
        />

        <Field
          label="Weekly PDF"
          name="pdf_file"
          type="file"
          accept="application/pdf"
          required
        />
      </div>

      <label className="block space-y-2">
        <span className="font-semibold">General Schedule Note</span>

        <textarea
          name="general_note"
          className="min-h-24 w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          placeholder="Krias Shema should be repeated after 9:19 PM"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={loadShabbosTemplate}
          className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-sm font-bold"
        >
          Load Shabbos Template
        </button>

        <button
          type="button"
          onClick={loadYomTovTemplate}
          className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-sm font-bold"
        >
          Load Two-Day Yom Tov Template
        </button>
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Schedule Days</h3>

            <p className="mt-1 text-sm text-slate-500">
              Friday, Shabbos, Erev Yom Tov, first day, second day, or any
              other section.
            </p>
          </div>

          <button
            type="button"
            onClick={addDay}
            className="rounded-full bg-[#8b6b2e] px-5 py-2.5 text-sm font-bold text-white"
          >
            + Add Schedule Day
          </button>
        </div>

        {days.map((day, dayIndex) => (
          <div
            key={day.id}
            className="rounded-2xl border border-[#e3d9c7] bg-[#f8f4eb] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h4 className="text-lg font-bold">
                Day {dayIndex + 1}
              </h4>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => moveDay(dayIndex, -1)}
                  disabled={dayIndex === 0}
                  className="rounded-full border border-[#cbbd9d] bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                >
                  Move Up
                </button>

                <button
                  type="button"
                  onClick={() => moveDay(dayIndex, 1)}
                  disabled={dayIndex === days.length - 1}
                  className="rounded-full border border-[#cbbd9d] bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                >
                  Move Down
                </button>

                <button
                  type="button"
                  onClick={() => removeDay(day.id)}
                  className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700"
                >
                  Remove Day
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <TextInput
                label="Day Title"
                value={day.dayTitle}
                placeholder="Shabbos"
                onChange={(value) =>
                  updateDay(day.id, "dayTitle", value)
                }
              />

              <TextInput
                label="Date"
                value={day.dayDate}
                type="date"
                onChange={(value) =>
                  updateDay(day.id, "dayDate", value)
                }
              />

              <TextInput
                label="Hebrew Day Title"
                value={day.hebrewDayTitle}
                placeholder="שבת קודש"
                dir="rtl"
                onChange={(value) =>
                  updateDay(day.id, "hebrewDayTitle", value)
                }
              />
            </div>

            <div className="mt-5 space-y-3">
              {day.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[#e3d9c7] bg-white p-4"
                >
                  <div className="grid gap-3 md:grid-cols-[1.5fr_0.7fr_auto]">
                    <TextInput
                      label="Event"
                      value={entry.eventName}
                      placeholder="Shacharis"
                      onChange={(value) =>
                        updateEntry(
                          day.id,
                          entry.id,
                          "eventName",
                          value
                        )
                      }
                    />

                    <TextInput
                      label="Time"
                      value={entry.eventTime}
                      placeholder="8:50 AM"
                      onChange={(value) =>
                        updateEntry(
                          day.id,
                          entry.id,
                          "eventTime",
                          value
                        )
                      }
                    />

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() =>
                          removeEntry(day.id, entry.id)
                        }
                        className="min-h-12 rounded-full bg-red-50 px-4 text-sm font-bold text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                    <TextInput
                      label="Optional Note"
                      value={entry.note}
                      placeholder="Please join us for Kiddush after davening"
                      onChange={(value) =>
                        updateEntry(
                          day.id,
                          entry.id,
                          "note",
                          value
                        )
                      }
                    />

                    <label className="flex items-end gap-2 pb-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={entry.isHighlighted}
                        onChange={(event) =>
                          updateEntry(
                            day.id,
                            entry.id,
                            "isHighlighted",
                            event.target.checked
                          )
                        }
                      />
                      Highlight
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addEntry(day.id)}
              className="mt-4 rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-sm font-bold"
            >
              + Add Time
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-[#e3d9c7] pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">
              Announcements &amp; Sponsors
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Add Kiddush sponsors, Ner Lamaor, simchas, shiurim, and general
              announcements.
            </p>
          </div>

          <button
            type="button"
            onClick={addAnnouncement}
            className="rounded-full bg-[#8b6b2e] px-5 py-2.5 text-sm font-bold text-white"
          >
            + Add Announcement
          </button>
        </div>

        {announcements.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#d8cdb7] bg-[#fbf8f2] p-6 text-center text-sm text-slate-500">
            No announcements added yet.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="rounded-2xl border border-[#e3d9c7] bg-[#f8f4eb] p-5"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="font-semibold">Type</span>

                    <select
                      value={announcement.announcementType}
                      onChange={(event) =>
                        updateAnnouncement(
                          announcement.id,
                          "announcementType",
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                    >
                      <option value="kiddush">
                        Kiddush Sponsor
                      </option>
                      <option value="ner_lamaor">Ner Lamaor</option>
                      <option value="simcha">Simcha</option>
                      <option value="mazel_tov">Mazel Tov</option>
                      <option value="shiur">Shiur</option>
                      <option value="sponsorship">
                        Sponsorship Opportunity
                      </option>
                      <option value="general">General</option>
                    </select>
                  </label>

                  <TextInput
                    label="Heading"
                    value={announcement.title}
                    placeholder="Ner Lamaor"
                    onChange={(value) =>
                      updateAnnouncement(
                        announcement.id,
                        "title",
                        value
                      )
                    }
                  />

                  <div className="md:col-span-2">
                    <TextInput
                      label="Announcement"
                      value={announcement.body}
                      placeholder="Sponsored for the month of Tammuz by the Lehmann and Zarkhine families."
                      onChange={(value) =>
                        updateAnnouncement(
                          announcement.id,
                          "body",
                          value
                        )
                      }
                    />
                  </div>

                  <TextInput
                    label="Sponsor Name"
                    value={announcement.sponsorName}
                    placeholder="Lehmann & Zarkhine families"
                    onChange={(value) =>
                      updateAnnouncement(
                        announcement.id,
                        "sponsorName",
                        value
                      )
                    }
                  />

                  <TextInput
                    label="Contact Name"
                    value={announcement.contactName}
                    placeholder="Daniel Schaffel"
                    onChange={(value) =>
                      updateAnnouncement(
                        announcement.id,
                        "contactName",
                        value
                      )
                    }
                  />

                  <TextInput
                    label="Contact Phone"
                    value={announcement.contactPhone}
                    placeholder="773-387-5884"
                    onChange={(value) =>
                      updateAnnouncement(
                        announcement.id,
                        "contactPhone",
                        value
                      )
                    }
                  />

                  <TextInput
                    label="Contact Email"
                    value={announcement.contactEmail}
                    type="email"
                    onChange={(value) =>
                      updateAnnouncement(
                        announcement.id,
                        "contactEmail",
                        value
                      )
                    }
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    removeAnnouncement(announcement.id)
                  }
                  className="mt-4 rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-700"
                >
                  Remove Announcement
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="rounded-full bg-[#1d2940] px-7 py-3 font-bold text-white transition hover:bg-[#10192b]"
      >
        Upload PDF &amp; Save Draft
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
  dir,
  accept,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  dir?: "ltr" | "rtl";
  accept?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="font-semibold">{label}</span>

      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        dir={dir}
        accept={accept}
        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
      />
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">{label}</span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
      />
    </label>
  );
}