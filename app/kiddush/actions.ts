"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendZelleReviewEmail } from "@/lib/payments/sendZelleReviewEmail";
import { sendKiddushReservationNotification } from "@/lib/kiddush/email";
import { formatKiddushShabbosLong } from "@/lib/kiddush/shabbos";

type KiddushItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
};

function uniqueItemsByName(items: KiddushItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function errorRedirect(message: string): never {
  redirect(`/kiddush?error=${encodeURIComponent(message)}`);
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
      notes: "Created automatically from the public Kiddush reservation page.",
      updated_at: now,
    })
    .select("id, first_name, last_name, email")
    .single();

  if (error || !sponsor) {
    throw new Error(error?.message || "Unable to save sponsor information.");
  }

  return sponsor;
}

export async function submitKiddushReservation(formData: FormData) {
  const shabbosDate = getString(formData, "shabbos_date");
  const sponsorName = getString(formData, "sponsor_name");
  const sponsorEmail = getString(formData, "sponsor_email").toLowerCase();
  const sponsorPhone = getString(formData, "sponsor_phone");
  const sponsorshipText = getString(formData, "sponsorship_text");
  const specialRequests = getString(formData, "special_requests") || null;
  const paymentMethod = getString(formData, "payment_method");

  if (!shabbosDate) {
    errorRedirect("Please choose a Shabbos.");
  }

  if (!sponsorName || !sponsorEmail || !sponsorshipText) {
    errorRedirect("Please enter your name, email, and sponsorship text.");
  }

  if (!["card", "zelle"].includes(paymentMethod)) {
    errorRedirect("Please choose card or Zelle payment.");
  }

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("kiddush_settings")
    .select(
      "enabled, notification_email, zelle_email, base_fee_amount, minimum_total_amount"
    )
    .eq("id", "default")
    .maybeSingle();

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  if (!settings?.enabled) {
    errorRedirect("Kiddush reservations are not open right now.");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("kiddush_reservations")
    .select("id")
    .eq("shabbos_date", shabbosDate)
    .in("payment_status", ["pending", "paid", "zelle_review", "no_payment_due"])
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    errorRedirect("That Shabbos is already reserved. Please choose another week.");
  }

  const { data: itemRows, error: itemsError } = await supabaseAdmin
    .from("kiddush_items")
    .select("id, name, description, price, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const selectedItems = uniqueItemsByName((itemRows || []) as KiddushItem[])
    .map((item) => {
      const rawQuantity = Math.max(
        0,
        Math.floor(getNumber(formData, `item_${item.id}`))
      );
      const unitPrice = Number(item.price || 0);

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: rawQuantity,
        unitPrice,
        lineTotal: rawQuantity * unitPrice,
      };
    })
    .filter((item) => item.quantity > 0);

  const itemSubtotalAmount = selectedItems.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  );
  const baseFeeAmount = Math.max(0, Number(settings.base_fee_amount || 49));
  const subtotalAmount = itemSubtotalAmount + baseFeeAmount;
  const minimumTotalAmount = Math.max(
    0,
    Number(settings.minimum_total_amount || 215)
  );
  const minimumAdjustmentAmount = Math.max(
    0,
    minimumTotalAmount - subtotalAmount
  );
  const totalAmount = subtotalAmount + minimumAdjustmentAmount;

  if (itemSubtotalAmount <= 0 && !specialRequests) {
    errorRedirect("Please select at least one item or enter a special request.");
  }

  const paymentStatus =
    totalAmount <= 0
      ? "no_payment_due"
      : paymentMethod === "zelle"
        ? "zelle_review"
        : "pending";

  const { data: reservation, error: reservationError } = await supabaseAdmin
    .from("kiddush_reservations")
    .insert({
      shabbos_date: shabbosDate,
      sponsor_name: sponsorName,
      sponsor_email: sponsorEmail,
      sponsor_phone: sponsorPhone || null,
      sponsorship_text: sponsorshipText,
      items: selectedItems,
      special_requests: specialRequests,
      item_subtotal_amount: itemSubtotalAmount,
      base_fee_amount: baseFeeAmount,
      minimum_adjustment_amount: minimumAdjustmentAmount,
      subtotal_amount: subtotalAmount,
      total_amount: totalAmount,
      final_total_amount: totalAmount,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
    })
    .select("id")
    .single();

  if (reservationError || !reservation) {
    errorRedirect(
      reservationError?.message || "Unable to save the Kiddush reservation."
    );
  }

  const savedReservation = reservation;
  const notificationEmail = String(settings.notification_email || "").trim();

  if (paymentMethod === "card" && totalAmount > 0) {
    const note = [
      `Kiddush for ${formatKiddushShabbosLong(shabbosDate)}`,
      `Reservation ${savedReservation.id}`,
    ].join(" - ");

    revalidatePath("/kiddush");
    redirect(
      `/donate?amount=${encodeURIComponent(
        totalAmount.toFixed(2)
      )}&purpose=${encodeURIComponent(
        "Kiddush Reservation"
      )}&note=${encodeURIComponent(note)}&name=${encodeURIComponent(
        sponsorName
      )}&email=${encodeURIComponent(sponsorEmail)}&phone=${encodeURIComponent(
        sponsorPhone
      )}`
    );
  }

  let chargeId: string | null = null;

  if (paymentMethod === "zelle" && totalAmount > 0) {
    const sponsor = await findOrCreateSponsor({
      sponsorName,
      email: sponsorEmail,
      phone: sponsorPhone,
    });
    const description = `Kiddush reservation for ${formatKiddushShabbosLong(
      shabbosDate
    )}`;

    const { data: charge, error: chargeError } = await supabaseAdmin
      .from("member_charges")
      .insert({
        member_id: sponsor.id,
        charge_type: "Kiddush Reservation",
        description,
        amount: totalAmount,
        status: "unpaid",
        due_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (chargeError || !charge) {
      throw new Error(
        chargeError?.message || "Unable to save the Kiddush charge."
      );
    }

    chargeId = charge.id;

    await supabaseAdmin
      .from("kiddush_reservations")
      .update({
        charge_id: charge.id,
        payment_reference: `Zelle review: ${charge.id}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", savedReservation.id);

    const zelleNote = [
      `Kiddush reservation ${savedReservation.id}.`,
      `Shabbos ${shabbosDate}.`,
      specialRequests,
    ]
      .filter(Boolean)
      .join(" ");

    const { error: zelleError } = await supabaseAdmin
      .from("zelle_payments")
      .insert({
        payer_name: sponsorName,
        payer_email: sponsorEmail,
        amount: totalAmount,
        received_date: new Date().toISOString().slice(0, 10),
        purpose: description,
        note: zelleNote,
        status: "pending_review",
      });

    if (zelleError) {
      throw new Error(zelleError.message);
    }

    await sendZelleReviewEmail({
      memberName: sponsorName,
      memberEmail: sponsorEmail,
      amount: totalAmount,
      purpose: description,
      note: zelleNote,
      chargeId: charge.id,
    });
  }

  await sendKiddushReservationNotification({
    reservationId: savedReservation.id,
    shabbosDate,
    sponsorName,
    sponsorEmail,
    sponsorPhone,
    sponsorshipText,
    items: selectedItems,
    specialRequests,
    totalAmount,
    paymentStatus,
    paymentReference: chargeId,
    notifyEmail: notificationEmail,
  });

  revalidatePath("/");
  revalidatePath("/kiddush");
  revalidatePath("/admin/kiddush");

  redirect(
    `/kiddush?reserved=1&method=${encodeURIComponent(paymentMethod)}`
  );
}
