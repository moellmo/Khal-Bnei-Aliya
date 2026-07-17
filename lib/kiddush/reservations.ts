import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendKiddushReservationNotification } from "./email";

type KiddushReservation = {
  id: string;
  shabbos_date: string;
  sponsor_name: string;
  sponsor_email: string;
  sponsor_phone: string | null;
  sponsorship_text: string;
  items: unknown;
  special_requests: string | null;
  total_amount: number;
  payment_status: string;
  payment_reference: string | null;
};

type KiddushSettings = {
  notification_email: string;
};

type KiddushReservationItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export function reservationIdFromPaymentNote(note: string) {
  const uuidPattern =
    "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const match =
    note.match(new RegExp(`Kiddush\\s+reservation\\s+(${uuidPattern})`, "i")) ||
    note.match(new RegExp(`Reservation\\s+(${uuidPattern})`, "i")) ||
    note.match(new RegExp(`(${uuidPattern})`, "i"));

  return match?.[1] || null;
}

function normalizeItems(items: unknown): KiddushReservationItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;

      return {
        name: String(record.name || "Kiddush item"),
        quantity: Number(record.quantity || 0),
        unitPrice: Number(record.unitPrice || 0),
        lineTotal: Number(record.lineTotal || 0),
      };
    })
    .filter((item): item is KiddushReservationItem => Boolean(item));
}

export async function markKiddushReservationPaidAndNotify({
  note,
  reference,
  chargeId,
}: {
  note: string;
  reference: string;
  chargeId?: string | null;
}) {
  const reservationId = reservationIdFromPaymentNote(note);
  if (!reservationId) return;

  const { data: reservation, error: reservationError } = await supabaseAdmin
    .from("kiddush_reservations")
    .select(
      "id, shabbos_date, sponsor_name, sponsor_email, sponsor_phone, sponsorship_text, items, special_requests, total_amount, payment_status, payment_reference"
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError || !reservation) {
    console.error("KIDDUSH_PAYMENT_LINK_LOAD_ERROR", {
      reservationId,
      error: reservationError?.message || "Reservation not found.",
    });
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("kiddush_reservations")
    .update({
      payment_status: "paid",
      payment_reference: reference,
      charge_id: chargeId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId);

  if (updateError) {
    console.error("KIDDUSH_PAYMENT_LINK_UPDATE_ERROR", {
      reservationId,
      error: updateError.message,
    });
    return;
  }

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("kiddush_settings")
    .select("notification_email")
    .eq("id", "default")
    .maybeSingle();

  if (settingsError || !settings?.notification_email) {
    console.error("KIDDUSH_PAYMENT_NOTIFICATION_SETTINGS_ERROR", {
      reservationId,
      error: settingsError?.message || "Missing notification email.",
    });
    return;
  }

  const row = reservation as KiddushReservation;
  const config = settings as KiddushSettings;

  await sendKiddushReservationNotification({
    reservationId: row.id,
    shabbosDate: row.shabbos_date,
    sponsorName: row.sponsor_name,
    sponsorEmail: row.sponsor_email,
    sponsorPhone: row.sponsor_phone,
    sponsorshipText: row.sponsorship_text,
    items: normalizeItems(row.items),
    specialRequests: row.special_requests,
    totalAmount: Number(row.total_amount || 0),
    paymentStatus: "paid",
    paymentReference: reference,
    notifyEmail: config.notification_email,
  });
}
