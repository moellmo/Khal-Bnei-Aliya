"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

type AnnouncementInput = {
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
  sponsorName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
};

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
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

async function uploadPdfToBucket(file: File, bucket: string) {
  if (!file || file.size === 0) {
    throw new Error("Please choose a PDF file.");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed.");
  }

  const safeName = sanitizeFileName(file.name);
  const filePath = `${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, file, {
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
      weekday_shacharis: weekdayShacharis,
      sunday_shacharis: sundayShacharis,
      mincha,
      maariv,
      notes,
      is_published: true,
      show_on_homepage: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/davening-times");
  revalidatePath("/admin/davening-times");

  redirect("/admin/davening-times?saved=1");
}

export async function uploadWeeklySchedule(formData: FormData) {
  await requireAdmin();

  const title =
    getString(formData, "title") || "Weekly Shul Schedule";

  const hebrewTitle = getString(formData, "hebrew_title");
  const hebrewDate = getString(formData, "hebrew_date");

  const scheduleType =
    getString(formData, "schedule_type") || "shabbos";

  const startDate = getString(formData, "start_date");
  const endDate = getString(formData, "end_date");

  const subtitle = getString(formData, "subtitle");
  const generalNote = getString(formData, "general_note");

  const scheduleDays = parseJsonArray<ScheduleDayInput>(
    formData.get("schedule_days_json")
  );

  const announcements = parseJsonArray<AnnouncementInput>(
    formData.get("announcements_json")
  );

  const file = formData.get("pdf_file") as File | null;

  if (!startDate || !endDate) {
    throw new Error("Please enter the schedule start and end dates.");
  }

  if (scheduleDays.length === 0) {
    throw new Error("Please add at least one schedule day.");
  }

  const validScheduleTypes = [
    "shabbos",
    "yom_tov",
    "yom_tov_shabbos",
    "fast_day",
    "special",
  ];

  if (!validScheduleTypes.includes(scheduleType)) {
    throw new Error("Invalid schedule type.");
  }

  const uploadedPdf = await uploadPdfToBucket(
    file as File,
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
      })
      .select("id")
      .single();

  if (scheduleError || !schedule) {
    await supabaseAdmin.storage
      .from("weekly-schedule-pdfs")
      .remove([uploadedPdf.filePath]);

    throw new Error(
      scheduleError?.message || "Could not create the weekly schedule."
    );
  }

  try {
    for (
      let dayIndex = 0;
      dayIndex < scheduleDays.length;
      dayIndex += 1
    ) {
      const day = scheduleDays[dayIndex];

      if (!day.dayTitle?.trim()) {
        continue;
      }

      const { data: createdDay, error: dayError } =
        await supabaseAdmin
          .from("schedule_days")
          .insert({
            schedule_id: schedule.id,
            day_title: day.dayTitle.trim(),
            day_date: day.dayDate || null,
            hebrew_day_title:
              day.hebrewDayTitle?.trim() || null,
            display_order: dayIndex,
          })
          .select("id")
          .single();

      if (dayError || !createdDay) {
        throw new Error(
          dayError?.message || "Could not create a schedule day."
        );
      }

      const validEntries = (day.entries || []).filter(
        (entry) => entry.eventName?.trim()
      );

      if (validEntries.length > 0) {
        const entryRows = validEntries.map((entry, entryIndex) => ({
          schedule_day_id: createdDay.id,
          event_name: entry.eventName.trim(),
          event_time: entry.eventTime?.trim() || null,
          note: entry.note?.trim() || null,
          is_highlighted: Boolean(entry.isHighlighted),
          display_order: entryIndex,
        }));

        const { error: entriesError } = await supabaseAdmin
          .from("schedule_entries")
          .insert(entryRows);

        if (entriesError) {
          throw new Error(entriesError.message);
        }
      }
    }

    const validAnnouncements = announcements.filter(
      (announcement) =>
        announcement.title?.trim() &&
        announcement.body?.trim()
    );

    if (validAnnouncements.length > 0) {
      const announcementRows = validAnnouncements.map(
        (announcement, index) => ({
          schedule_id: schedule.id,
          announcement_type:
            announcement.announcementType || "general",
          title: announcement.title.trim(),
          body: announcement.body.trim(),
          sponsor_name:
            announcement.sponsorName?.trim() || null,
          contact_name:
            announcement.contactName?.trim() || null,
          contact_phone:
            announcement.contactPhone?.trim() || null,
          contact_email:
            announcement.contactEmail?.trim() || null,
          display_order: index,
          is_published: true,
        })
      );

      const { error: announcementsError } = await supabaseAdmin
        .from("weekly_announcements")
        .insert(announcementRows);

      if (announcementsError) {
        throw new Error(announcementsError.message);
      }
    }

    const { error: importError } = await supabaseAdmin
      .from("schedule_pdf_imports")
      .insert({
        file_name: uploadedPdf.originalName,
        file_url: uploadedPdf.publicUrl,
        import_type: "weekly",
        status: "ready_for_review",
        schedule_id: schedule.id,
        extracted_data: {
          scheduleDays,
          announcements,
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

  revalidatePath("/");
  revalidatePath("/davening-times");
  revalidatePath("/admin/davening-times");

  redirect(
    `/admin/davening-times?created=1&schedule=${schedule.id}`
  );
}

export async function publishWeeklySchedule(formData: FormData) {
  await requireAdmin();

  const scheduleId = getString(formData, "schedule_id");

  if (!scheduleId) {
    throw new Error("Schedule ID is missing.");
  }

  const { error: unpublishError } = await supabaseAdmin
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

  await supabaseAdmin
    .from("schedule_pdf_imports")
    .update({
      status: "published",
    })
    .eq("schedule_id", scheduleId);

  revalidatePath("/");
  revalidatePath("/davening-times");
  revalidatePath("/admin/davening-times");

  redirect("/admin/davening-times?published=1");
}

export async function unpublishWeeklySchedule(
  formData: FormData
) {
  await requireAdmin();

  const scheduleId = getString(formData, "schedule_id");

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

  revalidatePath("/");
  revalidatePath("/davening-times");
  revalidatePath("/admin/davening-times");

  redirect("/admin/davening-times?unpublished=1");
}

export async function uploadSeasonalSchedule(
  formData: FormData
) {
  await requireAdmin();

  const title = getString(formData, "seasonal_title");
  const scheduleType =
    getString(formData, "seasonal_type") || "seasonal";

  const description = getString(
    formData,
    "seasonal_description"
  );

  const startDate = getString(
    formData,
    "seasonal_start_date"
  );

  const endDate = getString(formData, "seasonal_end_date");

  const file = formData.get(
    "seasonal_pdf_file"
  ) as File | null;

  if (!title) {
    throw new Error("Please enter a seasonal schedule title.");
  }

  const validTypes = [
    "winter",
    "summer",
    "selichos",
    "yom_tov",
    "seasonal",
    "special",
  ];

  if (!validTypes.includes(scheduleType)) {
    throw new Error("Invalid seasonal schedule type.");
  }

  const uploadedPdf = await uploadPdfToBucket(
    file as File,
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
        effective_start_date: startDate || null,
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
      error?.message || "Could not save seasonal schedule."
    );
  }

  await supabaseAdmin
    .from("schedule_pdf_imports")
    .insert({
      file_name: uploadedPdf.originalName,
      file_url: uploadedPdf.publicUrl,
      import_type: "seasonal",
      status: "published",
      seasonal_schedule_id: seasonalSchedule.id,
      processed_at: new Date().toISOString(),
    });

  revalidatePath("/");
  revalidatePath("/davening-times");
  revalidatePath("/admin/davening-times");

  redirect("/admin/davening-times?seasonalUploaded=1");
}

export async function toggleSeasonalSchedule(
  formData: FormData
) {
  await requireAdmin();

  const scheduleId = getString(formData, "schedule_id");
  const publish = getString(formData, "publish") === "true";

  if (!scheduleId) {
    throw new Error("Seasonal schedule ID is missing.");
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

  revalidatePath("/");
  revalidatePath("/davening-times");
  revalidatePath("/admin/davening-times");

  redirect("/admin/davening-times?seasonalUpdated=1");
}