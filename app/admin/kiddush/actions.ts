"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatKiddushShabbosLabel } from "@/lib/kiddush/shabbos";
import { sendPaymentRequestEmail } from "@/lib/payments/sendPaymentRequestEmail";

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

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      firstName: parts[0] || "Guest",
      lastName: "Sponsor",
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) || "Sponsor",
  };
}

async function findOrCreateSponsor({
  sponsorName,
  email,
  phone,
}: {
  sponsorName: string;
  email: string;
  phone: string;
}) {
  const { data: existingByEmail, error: emailLookupError } =
    await supabaseAdmin
      .from("members")
      .select("id, first_name, last_name, email")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

  if (emailLookupError) {
    throw new Error(emailLookupError.message);
  }

  if (existingByEmail) {
    return existingByEmail;
  }

  const { firstName, lastName } = splitName(sponsorName);
  const now = new Date().toISOString();

  const { data: sponsor, error } = await supabaseAdmin
    .from("members")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      membership_type: "Donor",
      status: "donor",
      notes: "Created automatically from Kiddush reservation billing.",
      updated_at: now,
    })
    .select("id, first_name, last_name, email")
    .single();

  if (error || !sponsor) {
    throw new Error(error?.message || "Unable to save sponsor information.");
  }

  return sponsor;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/kiddush");
  revalidatePath("/admin");
  revalidatePath("/admin/kiddush");
}

export async function updateKiddushSettings(formData: FormData) {
  await requireAdmin();

  const notificationEmail =
    getString(formData, "notification_email") || "ybcuzz@gmail.com";
  const zelleEmail =
    getString(formData, "zelle_email") || "khalbneialiyah@gmail.com";

  const { error } = await supabaseAdmin
    .from("kiddush_settings")
    .upsert({
      id: "default",
      enabled: formData.get("enabled") === "on",
      notification_email: notificationEmail,
      zelle_email: zelleEmail,
      weeks_to_show: Math.min(
        104,
        Math.max(1, Math.floor(getNumber(formData, "weeks_to_show") || 26))
      ),
      base_fee_amount: Math.max(0, getNumber(formData, "base_fee_amount")),
      minimum_total_amount: Math.max(
        0,
        getNumber(formData, "minimum_total_amount")
      ),
      headline: getString(formData, "headline") || "Kiddush Reservations",
      message: getString(formData, "message") || null,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    redirect(`/admin/kiddush?error=${encodeURIComponent(error.message)}`);
  }

  refresh();
  redirect("/admin/kiddush?settingsSaved=1");
}

export async function updateKiddushItems(formData: FormData) {
  await requireAdmin();

  const itemIds = formData.getAll("item_id").map((value) => String(value));
  const updates = itemIds.map((id) => {
    return {
      id,
      name: getString(formData, `name_${id}`),
      description: getString(formData, `description_${id}`) || null,
      price: Math.max(0, getNumber(formData, `price_${id}`)),
      default_quantity: Math.max(
        0,
        Math.floor(getNumber(formData, `default_quantity_${id}`))
      ),
      max_quantity: null,
      display_order: Math.floor(getNumber(formData, `display_order_${id}`)),
      is_active: formData.get(`is_active_${id}`) === "on",
      updated_at: new Date().toISOString(),
    };
  });

  for (const update of updates) {
    if (!update.name) continue;

    const { error } = await supabaseAdmin
      .from("kiddush_items")
      .update(update)
      .eq("id", update.id);

    if (error) {
      redirect(`/admin/kiddush?error=${encodeURIComponent(error.message)}`);
    }
  }

  refresh();
  redirect("/admin/kiddush?itemsSaved=1");
}

export async function addKiddushItem(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "new_name");

  if (!name) {
    redirect(
      `/admin/kiddush?error=${encodeURIComponent("Enter an item name.")}`
    );
  }

  const { error } = await supabaseAdmin.from("kiddush_items").insert({
    name,
    description: getString(formData, "new_description") || null,
    price: Math.max(0, getNumber(formData, "new_price")),
    default_quantity: Math.max(
      0,
      Math.floor(getNumber(formData, "new_default_quantity"))
    ),
    max_quantity: null,
    display_order: Math.floor(getNumber(formData, "new_display_order")),
    is_active: true,
  });

  if (error) {
    redirect(`/admin/kiddush?error=${encodeURIComponent(error.message)}`);
  }

  refresh();
  redirect("/admin/kiddush?itemAdded=1");
}

export async function markKiddushPaid(
  reservationId: string,
  formData: FormData
) {
  await requireAdmin();

  const paymentReference = getString(formData, "payment_reference") || null;

  const { error } = await supabaseAdmin
    .from("kiddush_reservations")
    .update({
      payment_status: "paid",
      payment_reference: paymentReference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId);

  if (error) {
    redirect(`/admin/kiddush?error=${encodeURIComponent(error.message)}`);
  }

  refresh();
  redirect("/admin/kiddush?reservationUpdated=1#reservations");
}

export async function updateKiddushFinalTotal(
  reservationId: string,
  formData: FormData
) {
  await requireAdmin();

  const { data: reservation, error: reservationError } = await supabaseAdmin
    .from("kiddush_reservations")
    .select(
      "id, shabbos_date, sponsor_name, sponsor_email, sponsor_phone, total_amount, charge_id, additional_charge_id, payment_status"
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError || !reservation) {
    redirect(
      `/admin/kiddush?error=${encodeURIComponent(
        reservationError?.message || "Reservation not found."
      )}#reservations`
    );
  }

  const chargeIds = [reservation.charge_id, reservation.additional_charge_id]
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  let paidAmount = 0;

  if (chargeIds.length > 0) {
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .in("charge_id", chargeIds)
      .eq("status", "paid");

    if (paymentsError) {
      redirect(
        `/admin/kiddush?error=${encodeURIComponent(
          paymentsError.message
        )}#reservations`
      );
    }

    paidAmount = (payments || []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }

  if (paidAmount <= 0) {
    const { data: reservationPayments, error: reservationPaymentsError } =
      await supabaseAdmin
        .from("payments")
        .select("amount, note")
        .eq("status", "paid")
        .ilike("note", `%${reservation.id}%`);

    if (reservationPaymentsError) {
      redirect(
        `/admin/kiddush?error=${encodeURIComponent(
          reservationPaymentsError.message
        )}#reservations`
      );
    }

    paidAmount = (reservationPayments || []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );
  }

  if (paidAmount <= 0 && reservation.payment_status === "paid") {
    paidAmount = Number(reservation.total_amount || 0);
  }

  const originalTotal = Number(reservation.total_amount || 0);
  const finalTotal = formData.has("add_on_amount")
    ? originalTotal + Math.max(0, getNumber(formData, "add_on_amount"))
    : Math.max(0, getNumber(formData, "final_total_amount"));
  const remainingAmount = Math.max(0, finalTotal - paidAmount);
  const specialRequestAmount = Math.max(0, finalTotal - originalTotal);
  let additionalChargeId = reservation.additional_charge_id || null;

  if (remainingAmount > 0) {
    const sponsor = await findOrCreateSponsor({
      sponsorName: reservation.sponsor_name,
      email: reservation.sponsor_email,
      phone: reservation.sponsor_phone || "",
    });
    const description = `Kiddush add-on balance for ${formatKiddushShabbosLabel(
      reservation.shabbos_date
    )}`;
    let chargeIdForEmail = additionalChargeId;

    if (additionalChargeId) {
      const { error: chargeUpdateError } = await supabaseAdmin
        .from("member_charges")
        .update({
          amount: remainingAmount,
          description,
          status: "unpaid",
          due_date: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("id", additionalChargeId);

      if (chargeUpdateError) {
        redirect(
          `/admin/kiddush?error=${encodeURIComponent(
            chargeUpdateError.message
          )}#reservations`
        );
      }
    } else {
      const { data: charge, error: chargeError } = await supabaseAdmin
        .from("member_charges")
        .insert({
          member_id: sponsor.id,
          charge_type: "Kiddush Reservation",
          description,
          amount: remainingAmount,
          status: "unpaid",
          due_date: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();

      if (chargeError || !charge) {
        redirect(
          `/admin/kiddush?error=${encodeURIComponent(
            chargeError?.message || "Unable to create balance charge."
          )}#reservations`
        );
      }

      additionalChargeId = charge.id;
      chargeIdForEmail = charge.id;
    }

    await sendPaymentRequestEmail({
      recipient: reservation.sponsor_email,
      memberFirstName: reservation.sponsor_name.split(/\s+/)[0] || "Sponsor",
      amount: remainingAmount,
      chargeType: "Kiddush Reservation",
      description,
      chargeId: chargeIdForEmail,
      isOpenAmount: false,
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from("kiddush_reservations")
    .update({
      final_total_amount: finalTotal,
      special_request_amount: specialRequestAmount,
      additional_amount: remainingAmount,
      additional_charge_id: additionalChargeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservation.id);

  if (updateError) {
    redirect(
      `/admin/kiddush?error=${encodeURIComponent(
        updateError.message
      )}#reservations`
    );
  }

  refresh();
  redirect("/admin/kiddush?balanceBilled=1#reservations");
}
