"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

export async function generateMonthlyDues(formData: FormData) {
  const billingMonth = getNumber(formData, "billing_month");
  const billingYear = getNumber(formData, "billing_year");
  const defaultAmount = getNumber(formData, "default_amount");
  const dueDate = getString(formData, "due_date");
  const memberId = getString(formData, "member_id");

  if (billingMonth < 1 || billingMonth > 12) {
    throw new Error("Choose a valid billing month.");
  }

  if (billingYear < 2026) {
    throw new Error("Choose a valid billing year.");
  }

  if (defaultAmount <= 0) {
    throw new Error("Default monthly amount must be greater than 0.");
  }

  if (!dueDate) {
    throw new Error("Due date is required.");
  }

  let membersQuery = supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, status, recurring_amount, autopay_active"
    )
    .eq("status", "active");

  if (memberId) {
    membersQuery = membersQuery.eq("id", memberId);
  }

  const { data: members, error: membersError } = await membersQuery;

  if (membersError) {
    throw new Error(membersError.message);
  }

  if (!members || members.length === 0) {
    throw new Error(
      memberId
        ? "The selected active member was not found."
        : "No active members were found."
    );
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const member of members) {
    const memberRecurringAmount = Number(member.recurring_amount || 0);

    const amount =
      memberRecurringAmount > 0
        ? memberRecurringAmount
        : defaultAmount;

    const { data: existingCharge, error: existingError } =
      await supabaseAdmin
        .from("member_charges")
        .select("id")
        .eq("member_id", member.id)
        .eq("charge_type", "Membership Dues")
        .eq("billing_month", billingMonth)
        .eq("billing_year", billingYear)
        .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingCharge) {
      skippedCount += 1;
      continue;
    }

    const monthName = new Intl.DateTimeFormat("en-US", {
      month: "long",
    }).format(new Date(billingYear, billingMonth - 1, 1));

    const description = member.autopay_active
      ? `${monthName} ${billingYear} membership dues — awaiting automatic payment`
      : `${monthName} ${billingYear} membership dues`;

    const { error: insertError } = await supabaseAdmin
      .from("member_charges")
      .insert({
        member_id: member.id,
        charge_type: "Membership Dues",
        description,
        amount,
        status: "unpaid",
        due_date: dueDate,
        billing_month: billingMonth,
        billing_year: billingYear,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    createdCount += 1;
  }

  revalidatePath("/admin/billing");
  revalidatePath("/admin/members");

  if (memberId) {
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath(`/admin/members/${memberId}/payments`);
  }

  redirect(
    `/admin/billing?generated=1&created=${createdCount}&skipped=${skippedCount}`
  );
}