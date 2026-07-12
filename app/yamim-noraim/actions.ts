"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

export async function submitYamimNoraimReservation(formData: FormData) {
  const fullName = getString(formData, "full_name");
  const email = getString(formData, "email") || null;
  const phone = getString(formData, "phone") || null;
  const memberName = getString(formData, "member_name") || null;
  const notes = getString(formData, "notes") || null;
  const roshHashanaMenSeats = Math.max(
    0,
    Math.floor(getNumber(formData, "rosh_hashana_men_seats"))
  );
  const roshHashanaWomenSeats = Math.max(
    0,
    Math.floor(getNumber(formData, "rosh_hashana_women_seats"))
  );
  const yomKippurMenSeats = Math.max(
    0,
    Math.floor(getNumber(formData, "yom_kippur_men_seats"))
  );
  const yomKippurWomenSeats = Math.max(
    0,
    Math.floor(getNumber(formData, "yom_kippur_women_seats"))
  );
  const menSeats = roshHashanaMenSeats + yomKippurMenSeats;
  const womenSeats = roshHashanaWomenSeats + yomKippurWomenSeats;

  if (!fullName) {
    redirect(
      "/yamim-noraim?error=Please%20enter%20your%20name."
    );
  }

  if (menSeats + womenSeats <= 0) {
    redirect(
      "/yamim-noraim?error=Please%20reserve%20at%20least%20one%20seat."
    );
  }

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("yamim_noraim_settings")
    .select(
      "enabled, active_year, men_seat_price, women_seat_price"
    )
    .eq("id", "default")
    .maybeSingle();

  if (settingsError || !settings?.enabled) {
    redirect(
      "/yamim-noraim?error=Reservations%20are%20not%20open%20right%20now."
    );
  }

  const menSeatPrice = Number(settings.men_seat_price || 0);
  const womenSeatPrice = Number(settings.women_seat_price || 0);
  const totalAmount =
    menSeats * menSeatPrice + womenSeats * womenSeatPrice;

  const { data: reservation, error } = await supabaseAdmin
    .from("yamim_noraim_reservations")
    .insert({
      reservation_year: settings.active_year,
      full_name: fullName,
      email,
      phone,
      member_name: memberName,
      rosh_hashana_men_seats: roshHashanaMenSeats,
      rosh_hashana_women_seats: roshHashanaWomenSeats,
      yom_kippur_men_seats: yomKippurMenSeats,
      yom_kippur_women_seats: yomKippurWomenSeats,
      men_seats: menSeats,
      women_seats: womenSeats,
      men_seat_price: menSeatPrice,
      women_seat_price: womenSeatPrice,
      total_amount: totalAmount,
      notes,
      payment_status: totalAmount > 0 ? "pending" : "no_payment_due",
    })
    .select("id")
    .single();

  if (error || !reservation) {
    redirect(
      `/yamim-noraim?error=${encodeURIComponent(
        error?.message || "Unable to save the reservation."
      )}`
    );
  }

  if (totalAmount <= 0) {
    redirect("/yamim-noraim?reserved=1");
  }

  const note = [
    `Yamim Noraim ${settings.active_year} seats`,
    `RH ${roshHashanaMenSeats} men/${roshHashanaWomenSeats} women`,
    `YK ${yomKippurMenSeats} men/${yomKippurWomenSeats} women`,
    `Reservation ${reservation.id}`,
  ].join(" - ");

  redirect(
    `/donate?amount=${encodeURIComponent(
      totalAmount.toFixed(2)
    )}&purpose=${encodeURIComponent(
      "Yamim Noraim Seats"
    )}&note=${encodeURIComponent(note)}&name=${encodeURIComponent(
      fullName
    )}&email=${encodeURIComponent(email || "")}&phone=${encodeURIComponent(
      phone || ""
    )}`
  );
}
