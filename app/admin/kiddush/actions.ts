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
    const maxQuantityRaw = getString(formData, `max_quantity_${id}`);

    return {
      id,
      name: getString(formData, `name_${id}`),
      description: getString(formData, `description_${id}`) || null,
      price: Math.max(0, getNumber(formData, `price_${id}`)),
      default_quantity: Math.max(
        0,
        Math.floor(getNumber(formData, `default_quantity_${id}`))
      ),
      max_quantity:
        maxQuantityRaw === ""
          ? null
          : Math.max(0, Math.floor(Number(maxQuantityRaw))),
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

  const maxQuantityRaw = getString(formData, "new_max_quantity");

  const { error } = await supabaseAdmin.from("kiddush_items").insert({
    name,
    description: getString(formData, "new_description") || null,
    price: Math.max(0, getNumber(formData, "new_price")),
    default_quantity: Math.max(
      0,
      Math.floor(getNumber(formData, "new_default_quantity"))
    ),
    max_quantity:
      maxQuantityRaw === ""
        ? null
        : Math.max(0, Math.floor(Number(maxQuantityRaw))),
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
