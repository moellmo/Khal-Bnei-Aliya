"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function createMember(formData: FormData) {
  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const hebrew_name = String(formData.get("hebrew_name") || "").trim();
  const tribe_status = String(formData.get("tribe_status") || "Yisroel").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const membership_type = String(formData.get("membership_type") || "").trim();
  const custom_dues_amount = Number(formData.get("custom_dues_amount") || 0);
  const status = String(formData.get("status") || "pending").trim();
  const seating_location = String(formData.get("seating_location") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!first_name || !last_name) {
    throw new Error("First name and last name are required.");
  }

  const { error } = await supabaseAdmin.from("members").insert({
    first_name,
    last_name,
    hebrew_name: hebrew_name || null,
    tribe_status,
    email: email || null,
    phone: phone || null,
    address: address || null,
    membership_type: membership_type || null,
    custom_dues_amount,
    status,
    seating_location: seating_location || null,
    notes: notes || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/members");
  redirect("/admin/members?created=1");
}