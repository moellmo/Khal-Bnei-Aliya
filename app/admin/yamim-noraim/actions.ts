"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

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
    member?.portal_role !== "admin" ||
    member.portal_status === "disabled"
  ) {
    redirect("/member/dashboard");
  }
}

function refresh(year?: number) {
  revalidatePath("/");
  revalidatePath("/yamim-noraim");
  revalidatePath("/admin");
  revalidatePath("/admin/yamim-noraim");

  if (year) {
    revalidatePath(`/admin/yamim-noraim?year=${year}`);
  }
}

export async function updateYamimNoraimSettings(formData: FormData) {
  await requireAdmin();

  const activeYear = Math.max(
    2026,
    Math.floor(getNumber(formData, "active_year") || new Date().getFullYear())
  );
  const menSeatPrice = Math.max(0, getNumber(formData, "men_seat_price"));
  const womenSeatPrice = Math.max(0, getNumber(formData, "women_seat_price"));

  const { error } = await supabaseAdmin
    .from("yamim_noraim_settings")
    .upsert({
      id: "default",
      enabled: formData.get("enabled") === "on",
      active_year: activeYear,
      men_seat_price: menSeatPrice,
      women_seat_price: womenSeatPrice,
      headline:
        getString(formData, "headline") || "Yamim Noraim Seat Reservations",
      message: getString(formData, "message") || null,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    redirect(
      `/admin/yamim-noraim?year=${activeYear}&error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  refresh(activeYear);
  redirect(`/admin/yamim-noraim?year=${activeYear}&tab=controls&settingsSaved=1`);
}

export async function markReservationPaid(
  reservationId: string,
  year: number,
  formData: FormData
) {
  await requireAdmin();

  const paymentReference = getString(formData, "payment_reference") || null;

  const { error } = await supabaseAdmin
    .from("yamim_noraim_reservations")
    .update({
      payment_status: "paid",
      payment_reference: paymentReference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId);

  if (error) {
    redirect(
      `/admin/yamim-noraim?year=${year}&error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  refresh(year);
  redirect(`/admin/yamim-noraim?year=${year}&tab=results&reservationUpdated=1`);
}

export async function clearReservationsForYear(formData: FormData) {
  await requireAdmin();

  const year = Math.max(2026, Math.floor(getNumber(formData, "year")));
  const confirmation = getString(formData, "confirmation");

  if (confirmation !== `CLEAR ${year}`) {
    redirect(
      `/admin/yamim-noraim?year=${year}&tab=controls&error=${encodeURIComponent(
        `Type CLEAR ${year} to clear that year's responses.`
      )}`
    );
  }

  const { error } = await supabaseAdmin
    .from("yamim_noraim_reservations")
    .delete()
    .eq("reservation_year", year);

  if (error) {
    redirect(
      `/admin/yamim-noraim?year=${year}&error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  refresh(year);
  redirect(`/admin/yamim-noraim?year=${year}&tab=controls&cleared=1`);
}
