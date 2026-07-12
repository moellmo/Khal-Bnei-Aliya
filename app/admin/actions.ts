"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPaymentRequestEmail } from "@/lib/payments/sendPaymentRequestEmail";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function memberDisplayName(member: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}) {
  return (
    [member.first_name, member.last_name].filter(Boolean).join(" ").trim() ||
    member.email ||
    "Member"
  );
}

function appendGuestDescription(
  description: string | null,
  guestName: string,
  hostName?: string
) {
  if (!guestName) return description;

  const guestText = hostName
    ? `Guest of ${hostName}: ${guestName}`
    : `Guest: ${guestName}`;

  return description ? `${description} (${guestText})` : guestText;
}

function normalizeLookup(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("id, portal_role, portal_status")
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

export async function createQuickCharge(formData: FormData) {
  await requireAdmin();

  const memberId = getString(formData, "member_id");
  const memberSearch = getString(formData, "member_search");
  const guestName = getString(formData, "guest_name");
  const guestEmail = getString(formData, "guest_email");
  const guestPhone = getString(formData, "guest_phone");
  const chargeGuestDirectly = formData.get("guest_charge") === "on";
  const guestOfMember = formData.get("guest_of_member") === "on";
  const chargeType = getString(formData, "charge_type") || "Mishaberach";
  const rawDescription = getString(formData, "description") || null;
  const dueDate =
    getString(formData, "due_date") ||
    new Date().toISOString().slice(0, 10);
  const amount = getNumber(formData, "amount");
  const isOpenAmount =
    formData.get("open_amount") === "on" ||
    chargeType.toLowerCase() === "matana";

  if (!chargeGuestDirectly && !memberId && !memberSearch) {
    redirect(
      `/admin?quickChargeError=${encodeURIComponent(
        "Choose a member or create a guest charge."
      )}`
    );
  }

  if (chargeGuestDirectly && !guestName && !guestEmail) {
    redirect(
      `/admin?quickChargeError=${encodeURIComponent(
        "Guest charges need at least a guest name or guest email."
      )}`
    );
  }

  if (!isOpenAmount && amount <= 0) {
    redirect(
      `/admin?quickChargeError=${encodeURIComponent(
        "Amount must be greater than $0."
      )}`
    );
  }

  let chargeMemberId = memberId;
  let member: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null = null;

  if (chargeGuestDirectly) {
    const fallbackName = guestEmail || "Guest";
    const nameParts = (guestName || fallbackName).split(/\s+/).filter(Boolean);
    const lastName =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Guest";

    let existingGuest:
      | {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        }
      | null = null;

    if (guestEmail) {
      const { data } = await supabaseAdmin
        .from("members")
        .select("id, first_name, last_name, email")
        .eq("email", guestEmail)
        .maybeSingle();

      existingGuest = data;
    }

    if (existingGuest) {
      member = existingGuest;
      chargeMemberId = existingGuest.id;
    } else {
      const { data: newGuest, error: guestError } = await supabaseAdmin
        .from("members")
        .insert({
          first_name: nameParts[0] || "Guest",
          last_name: lastName,
          email: guestEmail || null,
          phone: guestPhone || null,
          membership_type: "Guest",
          status: "active",
          notes: "Created from admin guest quick charge.",
        })
        .select("id, first_name, last_name, email")
        .single();

      if (guestError || !newGuest) {
        redirect(
          `/admin?quickChargeError=${encodeURIComponent(
            guestError?.message || "Unable to create guest charge account."
          )}`
        );
      }

      member = newGuest;
      chargeMemberId = newGuest.id;
    }
  } else {
    const lookupId =
      memberId ||
      memberSearch
        .split("|")
        .at(-1)
        ?.trim();

    let selectedMember:
      | {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        }
      | null = null;
    let memberError: { message: string } | null = null;

    if (lookupId) {
      const { data, error } = await supabaseAdmin
        .from("members")
        .select("id, first_name, last_name, email")
        .eq("id", lookupId)
        .maybeSingle();

      selectedMember = data;
      memberError = error;
    }

    if (!selectedMember && memberSearch) {
      const searchTerm = normalizeLookup(memberSearch.split("|")[0] || "");
      const { data, error } = await supabaseAdmin
        .from("members")
        .select("id, first_name, last_name, email")
        .limit(500);

      memberError = error;

      selectedMember =
        data?.find((candidate) => {
          const name = normalizeLookup(memberDisplayName(candidate));
          const email = normalizeLookup(candidate.email || "");

          return name.includes(searchTerm) || email.includes(searchTerm);
        }) || null;
    }

    if (memberError || !selectedMember) {
      redirect(
        `/admin?quickChargeError=${encodeURIComponent(
          memberError?.message || "Member was not found."
        )}`
      );
    }

    member = selectedMember;
    chargeMemberId = selectedMember.id;
  }

  const description = appendGuestDescription(
    rawDescription,
    guestOfMember || chargeGuestDirectly ? guestName : "",
    guestOfMember && member ? memberDisplayName(member) : undefined
  );

  const { data: charge, error } = await supabaseAdmin
    .from("member_charges")
    .insert({
      member_id: chargeMemberId,
      charge_type: chargeType,
      description,
      amount: isOpenAmount ? 0 : amount,
      status: "unpaid",
      due_date: dueDate,
      payment_note: isOpenAmount
        ? "Open amount: payer chooses amount when paying"
        : guestName
        ? `Guest charge: ${guestName}`
        : null,
    })
    .select("id")
    .single();

  if (error || !charge) {
    redirect(
      `/admin?quickChargeError=${encodeURIComponent(
        error?.message || "Unable to create the charge."
      )}`
    );
  }

  if (member?.email) {
    try {
      await sendPaymentRequestEmail({
        recipient: member.email,
        memberFirstName: member.first_name || "Member",
        amount,
        chargeType,
        description,
        chargeId: charge.id,
        isOpenAmount,
      });
    } catch (emailError) {
      console.error("QUICK_CHARGE_EMAIL_ERROR", {
        memberId: chargeMemberId,
        chargeId: charge.id,
        error: emailError,
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${chargeMemberId}`);
  revalidatePath(`/admin/members/${chargeMemberId}/payments`);
  revalidatePath("/member/dashboard");

  redirect(
    `/admin?quickChargeCreated=1&memberId=${encodeURIComponent(chargeMemberId)}`
  );
}
