import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { reservationIdFromPaymentNote } from "@/lib/kiddush/reservations";

function cents(value: number) {
  return Math.round(value * 100);
}

export async function validateYamimNoraimPaymentAmount({
  purpose,
  note,
  amount,
}: {
  purpose: string;
  note: string;
  amount: number;
}) {
  if (purpose !== "Yamim Noraim Seats") {
    return { valid: true } as const;
  }

  const reservationId = reservationIdFromPaymentNote(note);
  if (!reservationId) {
    return {
      valid: false,
      error: "This seat reservation payment link is incomplete.",
    } as const;
  }

  const { data: reservation, error } = await supabaseAdmin
    .from("yamim_noraim_reservations")
    .select("id, total_amount, payment_status")
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !reservation) {
    return {
      valid: false,
      error: "The seat reservation could not be found.",
    } as const;
  }

  if (reservation.payment_status === "paid") {
    return {
      valid: false,
      error: "This seat reservation has already been paid.",
    } as const;
  }

  if (cents(Number(reservation.total_amount || 0)) !== cents(amount)) {
    return {
      valid: false,
      error: "The payment amount does not match the seat reservation.",
    } as const;
  }

  return { valid: true } as const;
}
