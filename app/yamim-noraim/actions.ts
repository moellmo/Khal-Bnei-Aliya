"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteOrigin } from "@/lib/siteUrl";
import { sendYamimNoraimReservationConfirmation } from "@/lib/yamimNoraim/email";
import {
  calculateYamimNoraimPrice,
  type YamimNoraimMembershipType,
  type YamimNoraimPricingSettings,
} from "@/lib/yamimNoraim/pricing";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

export async function submitYamimNoraimReservation(formData: FormData) {
  const fullName = getString(formData, "full_name");
  const email = getString(formData, "email");
  const phone = getString(formData, "phone");
  const memberName = getString(formData, "member_name") || null;
  const notes = getString(formData, "notes") || null;
  const membershipType =
    getString(formData, "membership_type") === "non_member"
      ? "non_member"
      : "member";
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

  if (!email || !phone) {
    redirect(
      "/yamim-noraim?error=Please%20enter%20your%20email%20and%20phone%20number."
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
      "enabled, active_year, member_rosh_hashana_price, member_yom_kippur_price, member_both_price, nonmember_rosh_hashana_base_price, nonmember_yom_kippur_base_price, nonmember_both_base_price, nonmember_additional_seat_price"
    )
    .eq("id", "default")
    .maybeSingle();

  if (settingsError || !settings?.enabled) {
    redirect(
      "/yamim-noraim?error=Reservations%20are%20not%20open%20right%20now."
    );
  }

  const pricingSettings = settings as YamimNoraimPricingSettings & {
    enabled: boolean;
    active_year: number;
  };
  const pricing = calculateYamimNoraimPrice({
    membershipType: membershipType as YamimNoraimMembershipType,
    counts: {
      roshHashanaMenSeats,
      roshHashanaWomenSeats,
      yomKippurMenSeats,
      yomKippurWomenSeats,
    },
    settings: pricingSettings,
  });
  const totalAmount = pricing.totalAmount;

  const { data: reservation, error } = await supabaseAdmin
    .from("yamim_noraim_reservations")
    .insert({
      reservation_year: settings.active_year,
      full_name: fullName,
      email,
      phone,
      member_name: memberName,
      membership_type: membershipType,
      rosh_hashana_men_seats: roshHashanaMenSeats,
      rosh_hashana_women_seats: roshHashanaWomenSeats,
      yom_kippur_men_seats: yomKippurMenSeats,
      yom_kippur_women_seats: yomKippurWomenSeats,
      men_seats: menSeats,
      women_seats: womenSeats,
      men_seat_price: 0,
      women_seat_price: 0,
      total_amount: totalAmount,
      pricing_option: pricing.option,
      pricing_base_amount: pricing.baseAmount,
      pricing_additional_amount: pricing.additionalAmount,
      pricing_label: pricing.label,
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

  try {
    await sendYamimNoraimReservationConfirmation({
      reservationId: reservation.id,
      year: settings.active_year,
      fullName,
      email,
      pricingLabel: pricing.label,
      roshHashanaMenSeats,
      roshHashanaWomenSeats,
      yomKippurMenSeats,
      yomKippurWomenSeats,
      totalAmount,
      confirmationUrl: `${getSiteOrigin()}/yamim-noraim/confirmation?id=${encodeURIComponent(reservation.id)}`,
    });
  } catch (emailError) {
    console.error("YAMIM_NORAIM_CONFIRMATION_EMAIL_SEND_FAILED", {
      reservationId: reservation.id,
      error: emailError instanceof Error ? emailError.message : String(emailError),
    });
  }

  redirect(`/yamim-noraim/confirmation?id=${encodeURIComponent(reservation.id)}`);
}
