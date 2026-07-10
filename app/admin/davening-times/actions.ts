"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function cleanFileName(fileName: string) {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeStorageName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

function getDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getStoragePathFromPublicUrl(
  publicUrl: string | null,
  bucket: string
) {
  if (!publicUrl) {
    return null;
  }

  const marker = `/${bucket}/`;
  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  return decodeURIComponent(
    publicUrl.slice(markerIndex + marker.length)
  );
}

function revalidateSchedulePages() {
  revalidatePath("/");
  revalidatePath("/davening-times");
  revalidatePath("/admin/davening-times");
}

async function uploadPdf(file: File, bucket: string) {
  if (!file || file.size === 0) {
    throw new Error("Please choose a PDF file.");
  }

  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Only PDF files are allowed.");
  }

  const safeName = safeStorageName(file.name);
  const filePath = `${Date.now()}-${safeName}`;
  const fileBytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, fileBytes, {
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

/* =========================================================
   WEEKLY PDF
   ========================================================= */

export async function uploadWeeklyPdf(formData: FormData) {
  await requireAdmin();

  const fileEntry = formData.get("weekly_pdf");
  const file =
    fileEntry instanceof File ? fileEntry : null;

  if (!file) {
    throw new Error("Please choose a weekly PDF.");
  }

  const uploadedPdf = await uploadPdf(
    file,
    "weekly-schedule-pdfs"
  );

  const today = new Date();
  const endDate = new Date(today);

  endDate.setDate(today.getDate() + 7);

  const title =
    cleanFileName(file.name) || "Weekly Schedule";

  const { error: unpublishError } = await supabaseAdmin
    .from("weekly_schedules")
    .update({
      is_published: false,
      published_at: null,
    })
    .eq("is_published", true);

  if (unpublishError) {
    await supabaseAdmin.storage
      .from("weekly-schedule-pdfs")
      .remove([uploadedPdf.filePath]);

    throw new Error(unpublishError.message);
  }

  const { error: insertError } = await supabaseAdmin
    .from("weekly_schedules")
    .insert({
      title,
      schedule_type: "shabbos",
      start_date: getDateOnly(today),
      end_date: getDateOnly(endDate),
      source_pdf_url: uploadedPdf.publicUrl,
      source_pdf_name: uploadedPdf.originalName,
      is_published: true,
      published_at: new Date().toISOString(),
    });

  if (insertError) {
    await supabaseAdmin.storage
      .from("weekly-schedule-pdfs")
      .remove([uploadedPdf.filePath]);

    throw new Error(insertError.message);
  }

  revalidateSchedulePages();

  redirect("/admin/davening-times?weeklyUploaded=1");
}

export async function publishWeeklyPdf(
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

  const { error: unpublishError } = await supabaseAdmin
    .from("weekly_schedules")
    .update({
      is_published: false,
      published_at: null,
    })
    .eq("is_published", true);

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

  revalidateSchedulePages();

  redirect("/admin/davening-times?weeklyPublished=1");
}

export async function deleteWeeklyPdf(
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

  const { data: schedule, error: findError } =
    await supabaseAdmin
      .from("weekly_schedules")
      .select("source_pdf_url")
      .eq("id", scheduleId)
      .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("weekly_schedules")
    .delete()
    .eq("id", scheduleId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const storagePath = getStoragePathFromPublicUrl(
    schedule?.source_pdf_url || null,
    "weekly-schedule-pdfs"
  );

  if (storagePath) {
    const { error: storageError } =
      await supabaseAdmin.storage
        .from("weekly-schedule-pdfs")
        .remove([storagePath]);

    if (storageError) {
      console.error(
        "Unable to delete weekly PDF from storage:",
        storageError.message
      );
    }
  }

  revalidateSchedulePages();

  redirect("/admin/davening-times?weeklyDeleted=1");
}

/* =========================================================
   SEASONAL PDF
   ========================================================= */

export async function uploadSeasonalPdf(
  formData: FormData
) {
  await requireAdmin();

  const fileEntry = formData.get("seasonal_pdf");
  const file =
    fileEntry instanceof File ? fileEntry : null;

  if (!file) {
    throw new Error("Please choose a seasonal PDF.");
  }

  const customTitle = getString(
    formData,
    "seasonal_title"
  );

  const scheduleType =
    getString(formData, "seasonal_type") ||
    "seasonal";

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

  const uploadedPdf = await uploadPdf(
    file,
    "seasonal-schedule-pdfs"
  );

  const title =
    customTitle ||
    cleanFileName(file.name) ||
    "Seasonal Schedule";

  const { error } = await supabaseAdmin
    .from("seasonal_schedules")
    .insert({
      title,
      schedule_type: scheduleType,
      pdf_url: uploadedPdf.publicUrl,
      pdf_name: uploadedPdf.originalName,
      display_on_homepage: true,
      is_published: true,
    });

  if (error) {
    await supabaseAdmin.storage
      .from("seasonal-schedule-pdfs")
      .remove([uploadedPdf.filePath]);

    throw new Error(error.message);
  }

  revalidateSchedulePages();

  redirect("/admin/davening-times?seasonalUploaded=1");
}

export async function toggleSeasonalPdf(
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
    throw new Error("Schedule ID is missing.");
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

  revalidateSchedulePages();

  redirect("/admin/davening-times?seasonalUpdated=1");
}

export async function deleteSeasonalPdf(
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

  const { data: schedule, error: findError } =
    await supabaseAdmin
      .from("seasonal_schedules")
      .select("pdf_url")
      .eq("id", scheduleId)
      .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("seasonal_schedules")
    .delete()
    .eq("id", scheduleId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const storagePath = getStoragePathFromPublicUrl(
    schedule?.pdf_url || null,
    "seasonal-schedule-pdfs"
  );

  if (storagePath) {
    const { error: storageError } =
      await supabaseAdmin.storage
        .from("seasonal-schedule-pdfs")
        .remove([storagePath]);

    if (storageError) {
      console.error(
        "Unable to delete seasonal PDF from storage:",
        storageError.message
      );
    }
  }

  revalidateSchedulePages();

  redirect("/admin/davening-times?seasonalDeleted=1");
}