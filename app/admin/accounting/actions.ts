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

export async function addExpense(formData: FormData) {
  const amount = getNumber(formData, "amount");
  const vendor = getString(formData, "vendor");
  const category = getString(formData, "category") || "General";
  const expenseDate = getString(formData, "expense_date");
  const note = getString(formData, "note") || null;
  const receiptUrl = getString(formData, "receipt_url") || null;

  if (amount <= 0 || !vendor || !expenseDate) {
    redirect(
      "/admin/accounting?accountingError=Expense%20requires%20vendor%2C%20date%2C%20and%20amount."
    );
  }

  const { error } = await supabaseAdmin
    .from("accounting_expenses")
    .insert({
      vendor,
      category,
      amount,
      expense_date: expenseDate,
      note,
      receipt_url: receiptUrl,
      status: "recorded",
    });

  if (error) {
    redirect(
      `/admin/accounting?accountingError=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/accounting");
  redirect("/admin/accounting?expenseAdded=1");
}

export async function addZellePayment(formData: FormData) {
  const amount = getNumber(formData, "amount");
  const payerName = getString(formData, "payer_name");
  const payerEmail = getString(formData, "payer_email") || null;
  const receivedDate = getString(formData, "received_date");
  const purpose = getString(formData, "purpose") || "Zelle Payment";
  const note = getString(formData, "note") || null;

  if (amount <= 0 || !payerName || !receivedDate) {
    redirect(
      "/admin/accounting?accountingError=Zelle%20payment%20requires%20payer%2C%20date%2C%20and%20amount."
    );
  }

  const { error } = await supabaseAdmin
    .from("zelle_payments")
    .insert({
      payer_name: payerName,
      payer_email: payerEmail,
      amount,
      received_date: receivedDate,
      purpose,
      note,
      status: "unmatched",
    });

  if (error) {
    redirect(
      `/admin/accounting?accountingError=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/accounting");
  redirect("/admin/accounting?zelleAdded=1");
}
