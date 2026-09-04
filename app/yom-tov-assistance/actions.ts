"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateAssistanceTotals, type AssistanceCounts } from "@/lib/yomTovAssistance";
import { verifyPublicForm } from "@/lib/turnstile";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getCount(formData: FormData, key: string) {
  return Math.min(50, Math.max(0, Math.floor(Number(formData.get(key) || 0) || 0)));
}

export async function submitYomTovAssistanceRequest(formData: FormData) {
  const spamCheck = await verifyPublicForm(formData);
  if (!spamCheck.success) {
    redirect("/yom-tov-assistance?error=Please%20complete%20the%20security%20check%20and%20try%20again.");
  }

  const familyName = getString(formData, "family_name");
  const contactName = getString(formData, "contact_name") || null;
  const counts: AssistanceCounts = {
    adultsCount: 0,
    childrenUnder3Count: 0,
    childrenAges3To8RoshHashanah: getCount(formData, "children_ages_3_8_rosh_hashanah"),
    childrenAges3To8FirstDaysSukkos: getCount(formData, "children_ages_3_8_first_days_sukkos"),
    childrenAges3To8SheminiAtzeres: getCount(formData, "children_ages_3_8_shemini_atzeres"),
    childrenAges9To13RoshHashanah: getCount(formData, "children_ages_9_13_rosh_hashanah"),
    childrenAges9To13FirstDaysSukkos: getCount(formData, "children_ages_9_13_first_days_sukkos"),
    childrenAges9To13SheminiAtzeres: getCount(formData, "children_ages_9_13_shemini_atzeres"),
    age14PlusRoshHashanah: getCount(formData, "age_14_plus_rosh_hashanah"),
    age14PlusFirstDaysSukkos: getCount(formData, "age_14_plus_first_days_sukkos"),
    age14PlusSheminiAtzeres: getCount(formData, "age_14_plus_shemini_atzeres"),
  };
  const totals = calculateAssistanceTotals(counts);

  if (!familyName) {
    redirect("/yom-tov-assistance?error=Please%20enter%20the%20family%20name.");
  }

  const { data, error } = await supabaseAdmin
    .from("yom_tov_assistance_requests")
    .insert({
      family_name: familyName,
      contact_name: contactName,
      email: null,
      phone: null,
      adults_count: counts.adultsCount,
      children_under_3_count: counts.childrenUnder3Count,
      children_ages_3_8_rosh_hashanah: counts.childrenAges3To8RoshHashanah,
      children_ages_3_8_first_days_sukkos: counts.childrenAges3To8FirstDaysSukkos,
      children_ages_3_8_shemini_atzeres: counts.childrenAges3To8SheminiAtzeres,
      children_ages_9_13_rosh_hashanah: counts.childrenAges9To13RoshHashanah,
      children_ages_9_13_first_days_sukkos: counts.childrenAges9To13FirstDaysSukkos,
      children_ages_9_13_shemini_atzeres: counts.childrenAges9To13SheminiAtzeres,
      age_14_plus_rosh_hashanah: counts.age14PlusRoshHashanah,
      age_14_plus_first_days_sukkos: counts.age14PlusFirstDaysSukkos,
      age_14_plus_shemini_atzeres: counts.age14PlusSheminiAtzeres,
      total_people_in_family: totals.totalPeopleInFamily,
      total_points: totals.totalPoints,
      notes: getString(formData, "notes") || null,
    })
    .select("family_id_number")
    .single();

  if (error || !data) {
    redirect(
      `/yom-tov-assistance?error=${encodeURIComponent(
        error?.message || "Unable to submit the request."
      )}`
    );
  }

  redirect("/yom-tov-assistance?submitted=1");
}
