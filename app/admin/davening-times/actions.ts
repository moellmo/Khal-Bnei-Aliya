"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function saveDaveningTimes(formData: FormData) {
  const title = String(formData.get("title") || "Current Shul Times");
  const weekday_shacharis = String(formData.get("weekday_shacharis") || "");
  const sunday_shacharis = String(formData.get("sunday_shacharis") || "");
  const mincha = String(formData.get("mincha") || "");
  const maariv = String(formData.get("maariv") || "");
  const notes = String(formData.get("notes") || "");

  await supabaseAdmin
    .from("davening_schedules")
    .update({
      is_published: false,
      show_on_homepage: false,
    })
    .eq("is_published", true);

  const { error } = await supabaseAdmin.from("davening_schedules").insert({
    title,
    weekday_shacharis,
    sunday_shacharis,
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

export async function uploadSchedulePdf(formData: FormData) {
  const rawTitle = String(formData.get("pdf_title") || "").trim();
  const rawParsha = String(formData.get("parsha") || "").trim();

  const title = rawTitle || rawParsha || "Weekly Shul Schedule";
  const parsha = rawParsha;

  const effective_from = String(formData.get("effective_from") || "");
  const effective_to = String(formData.get("effective_to") || "");

  const friday_mincha = String(formData.get("friday_mincha") || "").trim();
  const candle_lighting = String(formData.get("candle_lighting") || "").trim();
  const friday_shkia = String(formData.get("friday_shkia") || "").trim();

  const shabbos_shacharis = String(formData.get("weekly_shabbos_shacharis") || "").trim();
  const sof_zman_shema = String(formData.get("sof_zman_shema") || "").trim();
  const shabbos_mincha = String(formData.get("weekly_shabbos_mincha") || "").trim();
  const shabbos_shkia = String(formData.get("shabbos_shkia") || "").trim();
  const shabbos_maariv = String(formData.get("weekly_shabbos_maariv") || "").trim();
  const announcements = String(formData.get("announcements") || "").trim();

  const file = formData.get("pdf_file") as File | null;

  if (!parsha) {
    throw new Error("Please enter the Parsha / Week Title.");
  }

  if (!file || file.size === 0) {
    throw new Error("Please choose a PDF file.");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
  const filePath = `${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("schedule-pdfs")
    .upload(filePath, file, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabaseAdmin.storage
    .from("schedule-pdfs")
    .getPublicUrl(filePath);

  const publicUrl = data.publicUrl;

  await supabaseAdmin
    .from("schedule_pdfs")
    .update({
      is_published: false,
      show_on_homepage: false,
    })
    .eq("is_published", true);

  const { error: dbError } = await supabaseAdmin.from("schedule_pdfs").insert({
    title,
    parsha,
    effective_from: effective_from || null,
    effective_to: effective_to || null,
    file_url: publicUrl,
    file_path: filePath,
    friday_mincha,
    candle_lighting,
    friday_shkia,
    shabbos_shacharis,
    sof_zman_shema,
    shabbos_mincha,
    shabbos_shkia,
    shabbos_maariv,
    announcements,
    is_published: true,
    show_on_homepage: true,
  });

  if (dbError) {
    throw new Error(dbError.message);
  }

  revalidatePath("/");
  revalidatePath("/davening-times");
  revalidatePath("/admin/davening-times");

  redirect("/admin/davening-times?uploaded=1");
}