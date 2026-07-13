"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateMonthlyDuesCharges } from "@/lib/billing/monthlyDues";

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

  const result = await generateMonthlyDuesCharges({
    billingMonth,
    billingYear,
    defaultAmount,
    dueDate,
    memberId,
    sendEmails: true,
  });

  revalidatePath("/admin/billing");
  revalidatePath("/admin/members");

  if (memberId) {
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath(`/admin/members/${memberId}/payments`);
  }

  redirect(
    `/admin/billing?generated=1&created=${result.createdCount}&skipped=${result.skippedCount}&emailed=${result.emailSentCount}`
  );
}
