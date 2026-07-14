"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendHallReservationRequestEmails } from "@/lib/kiddush/email";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function submitHallReservationRequest(formData: FormData) {
  const fullName = getString(formData, "full_name");
  const email = getString(formData, "email").toLowerCase();
  const phone = getString(formData, "phone");
  const datesNeeded = getString(formData, "dates_needed");
  const details = getString(formData, "details");

  if (!fullName || !email || !datesNeeded) {
    redirect(
      `/?hallError=${encodeURIComponent(
        "Please enter your name, email, and date needed."
      )}#hall-request`
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hall_reservation_requests")
    .insert({
      full_name: fullName,
      email,
      phone: phone || null,
      dates_needed: datesNeeded,
      details: details || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      `/?hallError=${encodeURIComponent(
        error?.message || "Unable to submit the request."
      )}#hall-request`
    );
  }

  try {
    await sendHallReservationRequestEmails({
      requestId: data.id,
      fullName,
      email,
      phone,
      datesNeeded,
      details,
    });
  } catch (emailError) {
    console.error("HALL_REQUEST_EMAIL_SEND_FAILED", {
      requestId: data.id,
      error:
        emailError instanceof Error
          ? emailError.message
          : String(emailError),
    });
  }

  revalidatePath("/");
  redirect("/?hallSubmitted=1#hall-request");
}
