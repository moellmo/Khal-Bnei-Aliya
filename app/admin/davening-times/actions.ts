"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseKbaSchedulePdf } from "@/lib/schedules/parseKbaSchedulePdf";

type ScheduleEntryInput = {
  eventName: string;
  eventTime?: string;
  note?: string;
  isHighlighted?: boolean;
};

type ScheduleDayInput = {
  dayTitle: string;
  dayDate?: string;
  hebrewDayTitle?: string;
  entries: ScheduleEntryInput[];
};

type AnnouncementType =
  | "kiddush"
  | "simcha"
  | "mazel_tov"
  | "ner_lamaor"
  | "shiur"
  | "sponsorship"
  | "general";

type AnnouncementInput = {
  announcementType: AnnouncementType;
  title: string;
  body: string;
  sponsorName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
};

const VALID_WEEKLY_SCHEDULE_TYPES = [
  "shabbos",
  "yom_tov",
  "yom_tov_shabbos",
  "fast_day",
  "special",
] as const;

const VALID_SEASONAL_SCHEDULE_TYPES = [
  "winter",
  "summer",
  "selichos",
  "yom_tov",
  "seasonal",
  "special",
] as const;

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("portal_role, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !member ||
    member.portal_role !== "admin" ||
    member.portal_status !== "active"
  ) {
    redirect("/");
  }

  return user;
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function parseJsonArray<T>(value: FormDataEntryValue | null): T[] {
  if (!value || typeof value !== "string") {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

function isPdfFile(file: File | null): file is File {
  return Boolean(
    file &&
      file.size > 0 &&
      (file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf"))
  );
}

async function uploadPdfToBucket(file: File, bucket: string) {
  if (file.size === 0) {
    throw new Error("Please choose a PDF file.");
  }

  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Only PDF files are allowed.");
  }

  const safeName = sanitizeFileName(file.name);
  const filePath = `${Date.now()}-${safeName}`;

  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    filePath,
    publicUrl: data.publicUrl,
    originalName: file.name,
  };
}

function revalidateSchedulePages() {
  revalidatePath("/");
  revalidatePath("/davening-times");
  revalidatePath("/admin/davening-times");
}

/* =========================================================
   REGULAR WEEKDAY TIMES
   ========================================================= */

export async function saveDaveningTimes(formData: FormData) {
  await requireAdmin();

  const title =
    getString(formData, "title") || "Current Shul Times";

  const weekdayShacharis = getString(
    formData,
    "weekday_shacharis"
  );

  const sundayShacharis = getString(
    formData,
    "sunday_shacharis"
  );

  const mincha = getString(formData, "mincha");
  const maariv = getString(formData, "maariv");
  const notes = getString(formData, "notes");

  const { error: unpublishError } = await supabaseAdmin
    .from("davening_schedules")
    .update({
      is_published: false,
      show_on_homepage: false,
    })
    .eq("is_published", true);

  if (unpublishError) {
    throw new Error(unpublishError.message);
  }

  const { error } = await supabaseAdmin
    .from("davening_schedules")
    .insert({
      title,
      weekday_shacharis: weekdayShacharis || null,
      sunday_shacharis: sundayShacharis || null,
      mincha: mincha || null,
      maariv: maariv || null,
      notes: notes || null,
      is_published: true,
      show_on_homepage: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidateSchedulePages();

  redirect("/admin/davening-times?saved=1");
}

/* =========================================================
   WEEKLY SHABBOS / YOM TOV PDF
   ========================================================= */

export async function uploadWeeklySchedule(formData: FormData) {
  await requireAdmin();

  const submittedTitle = getString(formData, "title");
  const submittedHebrewTitle = getString(
    formData,
    "hebrew_title"
  );
  const submittedHebrewDate = getString(
    formData,
    "hebrew_date"
  );
  const submittedScheduleType = getString(
    formData,
    "schedule_type"
  );
  const submittedGeneralNote = getString(
    formData,
    "general_note"
  );

  const startDate = getString(formData, "start_date");
  const endDate = getString(formData, "end_date");
  const subtitle = getString(formData, "subtitle");

  const submittedScheduleDays =
    parseJsonArray<ScheduleDayInput>(
      formData.get("schedule_days_json")
    );

  const submittedAnnouncements =
    parseJsonArray<AnnouncementInput>(
      formData.get("announcements_json")
    );

  const fileEntry = formData.get("pdf_file");
  const file =
    fileEntry instanceof File ? fileEntry : null;

  if (!isPdfFile(file)) {
    throw new Error("Please choose a valid PDF file.");
  }

  if (!startDate || !endDate) {
    throw new Error(
      "Please enter the schedule start and end dates."
    );
  }

  if (endDate < startDate) {
    throw new Error(
      "The schedule end date cannot be before the start date."
    );
  }

  /*
   * Read the PDF before uploading it.
   * If automatic parsing fails, retain the manually entered
   * schedule instead of rejecting the entire upload.
   */
  let parsedPdf:
    | Awaited<ReturnType<typeof parseKbaSchedulePdf>>
    | null = null;

  try {
    parsedPdf = await parseKbaSchedulePdf(file);
  } catch (error) {
    console.error("SCHEDULE_PDF_PARSE_ERROR", error);
  }

  /*
   * Prefer automatic PDF extraction when it found schedule days.
   * Otherwise use the entries entered in the admin form.
   */
  const scheduleDays: ScheduleDayInput[] =
    parsedPdf && parsedPdf.days.length > 0
      ? parsedPdf.days
      : submittedScheduleDays;

  const announcements: AnnouncementInput[] =
    parsedPdf && parsedPdf.announcements.length > 0
      ? parsedPdf.announcements
      : submittedAnnouncements;

  if (scheduleDays.length === 0) {
    throw new Error(
      "No schedule times were found in the PDF. Please enter at least one schedule day manually."
    );
  }

  /*
   * Manually entered headings take priority.
   * Parsed PDF values fill fields that were left blank.
   */
  const title =
    submittedTitle ||
    parsedPdf?.englishTitle ||
    "Weekly Shul Schedule";

  const hebrewTitle =
    submittedHebrewTitle ||
    parsedPdf?.hebrewTitle ||
    "";

  const hebrewDate =
    submittedHebrewDate ||
    parsedPdf?.hebrewDate ||
    "";

  const scheduleType =
    submittedScheduleType ||
    parsedPdf?.scheduleType ||
    "shabbos";

  const generalNote =
    submittedGeneralNote ||
    parsedPdf?.generalNote ||
    "";

  if (
    !VALID_WEEKLY_SCHEDULE_TYPES.includes(
      scheduleType as (typeof VALID_WEEKLY_SCHEDULE_TYPES)[number]
    )
  ) {
    throw new Error("Invalid schedule type.");
  }

  const uploadedPdf = await uploadPdfToBucket(
    file,
    "weekly-schedule-pdfs"
  );

  const { data: schedule, error: scheduleError } =
    await supabaseAdmin
      .from("weekly_schedules")
      .insert({
        title,
        hebrew_title: hebrewTitle || null,
        hebrew_date: hebrewDate || null,
        schedule_type: scheduleType,
        start_date: startDate,
        end_date: endDate,
        subtitle: subtitle || null,
        general_note: generalNote || null,
        source_pdf_url: uploadedPdf.publicUrl,
        source_pdf_name: uploadedPdf.originalName,
        is_published: false,
        published_at: null,
      })
      .select("id")
      .single();

  if (scheduleError || !schedule) {
    await supabaseAdmin.storage
      .from("weekly-schedule-pdfs")
      .remove([uploadedPdf.filePath]);

    throw new Error(
      scheduleError?.message ||
        "Could not create the weekly schedule."
    );
  }

  try {
    let createdDayCount = 0;

    for (
      let dayIndex = 0;
      dayIndex < scheduleDays.length;
      dayIndex += 1
    ) {
      const day = scheduleDays[dayIndex];
      const dayTitle = day.dayTitle?.trim();

      if (!dayTitle) {
        continue;
      }

      const { data: createdDay, error: dayError } =
        await supabaseAdmin
          .from("schedule_days")
          .insert({
            schedule_id: schedule.id,
            day_title: dayTitle,
            day_date: day.dayDate || null,
            hebrew_day_title:
              day.hebrewDayTitle?.trim() || null,
            display_order: dayIndex,
          })
          .select("id")
          .single();

      if (dayError || !createdDay) {
        throw new Error(
          dayError?.message ||
            "Could not create a schedule day."
        );
      }

      createdDayCount += 1;

      const validEntries = (day.entries || []).filter(
        (entry) => entry.eventName?.trim()
      );

      if (validEntries.length === 0) {
        continue;
      }

      const entryRows = validEntries.map(
        (entry, entryIndex) => ({
          schedule_day_id: createdDay.id,
          event_name: entry.eventName.trim(),
          event_time: entry.eventTime?.trim() || null,
          note: entry.note?.trim() || null,
          is_highlighted: Boolean(
            entry.isHighlighted
          ),
          display_order: entryIndex,
        })
      );

      const { error: entriesError } =
        await supabaseAdmin
          .from("schedule_entries")
          .insert(entryRows);

      if (entriesError) {
        throw new Error(entriesError.message);
      }
    }

    if (createdDayCount === 0) {
      throw new Error(
        "No valid schedule days could be created."
      );
    }

    const validAnnouncements = announcements.filter(
      (announcement) =>
        announcement.title?.trim() &&
        announcement.body?.trim()
    );

    if (validAnnouncements.length > 0) {
      const announcementRows =
        validAnnouncements.map(
          (announcement, index) => ({
            schedule_id: schedule.id,
            announcement_type:
              announcement.announcementType ||
              "general",
            title: announcement.title.trim(),
            body: announcement.body.trim(),
            sponsor_name:
              announcement.sponsorName?.trim() ||
              null,
            contact_name:
              announcement.contactName?.trim() ||
              null,
            contact_phone:
              announcement.contactPhone?.trim() ||
              null,
            contact_email:
              announcement.contactEmail?.trim() ||
              null,
            display_order: index,
            is_published: true,
          })
        );

      const { error: announcementsError } =
        await supabaseAdmin
          .from("weekly_announcements")
          .insert(announcementRows);

      if (announcementsError) {
        throw new Error(
          announcementsError.message
        );
      }
    }

    const { error: importError } =
      await supabaseAdmin
        .from("schedule_pdf_imports")
        .insert({
          file_name: uploadedPdf.originalName,
          file_url: uploadedPdf.publicUrl,
          import_type: "weekly",
          status: "ready_for_review",
          schedule_id: schedule.id,
          extracted_text:
            parsedPdf?.extractedText || null,
          extracted_data: {
            parserSucceeded: Boolean(parsedPdf),
            usedAutomaticSchedule:
              Boolean(parsedPdf?.days.length),
            usedAutomaticAnnouncements:
              Boolean(
                parsedPdf?.announcements.length
              ),
            scheduleDays,
            announcements,
            title,
            hebrewTitle,
            hebrewDate,
            scheduleType,
            generalNote,
          },
          processed_at: new Date().toISOString(),
        });

    if (importError) {
      console.error(
        "Could not save schedule PDF import record:",
        importError.message
      );
    }
  } catch (error) {
    await supabaseAdmin
      .from("weekly_schedules")
      .delete()
      .eq("id", schedule.id);

    await supabaseAdmin.storage
      .from("weekly-schedule-pdfs")
      .remove([uploadedPdf.filePath]);

    throw error;
  }

  revalidateSchedulePages();

  redirect(
    `/admin/davening-times?created=1&schedule=${schedule.id}`
  );
}

/* =========================================================
   PUBLISH / UNPUBLISH WEEKLY SCHEDULE
   ========================================================= */

export async function publishWeeklySchedule(
  formData: FormData
) {
  await requireAdmin();

  const scheduleId = getString(
    formData,
    "schedule_id"
  );

  if (!scheduleId) {
    throw new Error("Schedule ID is missing.");
  }

  const { data: selectedSchedule, error: findError } =
    await supabaseAdmin
      .from("weekly_schedules")
      .select("id")
      .eq("id", scheduleId)
      .maybeSingle();

  if (findError || !selectedSchedule) {
    throw new Error(
      findError?.message || "Schedule not found."
    );
  }

  const { error: unpublishError } =
    await supabaseAdmin
      .from("weekly_schedules")
      .update({
        is_published: false,
        published_at: null,
      })
      .eq("is_published", true)
      .neq("id", scheduleId);

  if (unpublishError) {
    throw new Error(unpublishError.message);
  }

  const { error } = await supabaseAdmin
    .from("weekly_schedules")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  if (error) {
    throw new Error(error.message);
  }

  const { error: importUpdateError } =
    await supabaseAdmin
      .from("schedule_pdf_imports")
      .update({
        status: "published",
      })
      .eq("schedule_id", scheduleId);

  if (importUpdateError) {
    console.error(
      "Could not update PDF import status:",
      importUpdateError.message
    );
  }

  revalidateSchedulePages();

  redirect("/admin/davening-times?published=1");
}

export async function unpublishWeeklySchedule(
  formData: FormData
) {
  await requireAdmin();

  const scheduleId = getString(
    formData,
    "schedule_id"
  );

  if (!scheduleId) {
    throw new Error("Schedule ID is missing.");
  }

  const { error } = await supabaseAdmin
    .from("weekly_schedules")
    .update({
      is_published: false,
      published_at: null,
    })
    .eq("id", scheduleId);

  if (error) {
    throw new Error(error.message);
  }

  const { error: importUpdateError } =
    await supabaseAdmin
      .from("schedule_pdf_imports")
      .update({
        status: "ready_for_review",
      })
      .eq("schedule_id", scheduleId);

  if (importUpdateError) {
    console.error(
      "Could not update PDF import status:",
      importUpdateError.message
    );
  }

  revalidateSchedulePages();

  redirect("/admin/davening-times?unpublished=1");
}

/* =========================================================
   SEASONAL SCHEDULE PDF
   ========================================================= */

export async function uploadSeasonalSchedule(
  formData: FormData
) {
  await requireAdmin();

  const title = getString(
    formData,
    "seasonal_title"
  );

  const scheduleType =
    getString(formData, "seasonal_type") ||
    "seasonal";

  const description = getString(
    formData,
    "seasonal_description"
  );

  const startDate = getString(
    formData,
    "seasonal_start_date"
  );

  const endDate = getString(
    formData,
    "seasonal_end_date"
  );

  const fileEntry = formData.get(
    "seasonal_pdf_file"
  );

  const file =
    fileEntry instanceof File ? fileEntry : null;

  if (!title) {
    throw new Error(
      "Please enter a seasonal schedule title."
    );
  }

  if (!isPdfFile(file)) {
    throw new Error(
      "Please choose a valid seasonal PDF file."
    );
  }

  if (
    startDate &&
    endDate &&
    endDate < startDate
  ) {
    throw new Error(
      "The seasonal end date cannot be before the start date."
    );
  }

  if (
    !VALID_SEASONAL_SCHEDULE_TYPES.includes(
      scheduleType as (typeof VALID_SEASONAL_SCHEDULE_TYPES)[number]
    )
  ) {
    throw new Error(
      "Invalid seasonal schedule type."
    );
  }

  const uploadedPdf = await uploadPdfToBucket(
    file,
    "seasonal-schedule-pdfs"
  );

  const { data: seasonalSchedule, error } =
    await supabaseAdmin
      .from("seasonal_schedules")
      .insert({
        title,
        schedule_type: scheduleType,
        description: description || null,
        pdf_url: uploadedPdf.publicUrl,
        pdf_name: uploadedPdf.originalName,
        effective_start_date:
          startDate || null,
        effective_end_date: endDate || null,
        display_on_homepage: true,
        is_published: true,
      })
      .select("id")
      .single();

  if (error || !seasonalSchedule) {
    await supabaseAdmin.storage
      .from("seasonal-schedule-pdfs")
      .remove([uploadedPdf.filePath]);

    throw new Error(
      error?.message ||
        "Could not save seasonal schedule."
    );
  }

  const { error: importError } =
    await supabaseAdmin
      .from("schedule_pdf_imports")
      .insert({
        file_name: uploadedPdf.originalName,
        file_url: uploadedPdf.publicUrl,
        import_type: "seasonal",
        status: "published",
        seasonal_schedule_id:
          seasonalSchedule.id,
        processed_at: new Date().toISOString(),
      });

  if (importError) {
    console.error(
      "Could not save seasonal PDF import:",
      importError.message
    );
  }

  revalidateSchedulePages();

  redirect(
    "/admin/davening-times?seasonalUploaded=1"
  );
}

export async function toggleSeasonalSchedule(
  formData: FormData
) {
  await requireAdmin();

  const scheduleId = getString(
    formData,
    "schedule_id"
  );

  const publish =
    getString(formData, "publish") === "true";

  if (!scheduleId) {
    throw new Error(
      "Seasonal schedule ID is missing."
    );
  }

  const { error } = await supabaseAdmin
    .from("seasonal_schedules")
    .update({
      is_published: publish,
      display_on_homepage: publish,
    })
    .eq("id", scheduleId);

  if (error) {
    throw new Error(error.message);
  }

  const { error: importUpdateError } =
    await supabaseAdmin
      .from("schedule_pdf_imports")
      .update({
        status: publish
          ? "published"
          : "ready_for_review",
      })
      .eq(
        "seasonal_schedule_id",
        scheduleId
      );

  if (importUpdateError) {
    console.error(
      "Could not update seasonal PDF status:",
      importUpdateError.message
    );
  }

  revalidateSchedulePages();

  redirect(
    "/admin/davening-times?seasonalUpdated=1"
  );
}