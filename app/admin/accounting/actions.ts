"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateAccountingRecurringExpenses } from "@/lib/accounting/recurringExpenses";
import { createAndSendReceipt } from "@/lib/payments/createReceipt";

const ACCOUNTING_RECEIPTS_BUCKET = "accounting-receipts";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function safeStorageName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

async function uploadAccountingReceipt(file: File | null) {
  if (!file || file.size === 0) {
    return null;
  }

  const allowedTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/webp",
  ]);

  if (
    file.type &&
    !allowedTypes.has(file.type) &&
    !/\.(pdf|jpe?g|png|heic|heif|webp)$/i.test(file.name)
  ) {
    throw new Error("Receipt must be a PDF or image file.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Receipt file must be 8MB or smaller.");
  }

  const safeName = safeStorageName(file.name || "receipt");
  const storagePath = `accounting/${Date.now()}-${safeName}`;
  const fileBytes = await file.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from(ACCOUNTING_RECEIPTS_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

export async function addExpense(formData: FormData) {
  const amount = getNumber(formData, "amount");
  const vendor = getString(formData, "vendor");
  const category = getString(formData, "category") || "General";
  const expenseDate = getString(formData, "expense_date");
  const note = getString(formData, "note") || null;
  let receiptUrl = getString(formData, "receipt_url") || null;
  const receiptEntry = formData.get("receipt_file");
  const receiptFile = receiptEntry instanceof File ? receiptEntry : null;

  if (amount <= 0 || !vendor || !expenseDate) {
    redirect(
      "/admin/accounting?accountingError=Expense%20requires%20vendor%2C%20date%2C%20and%20amount."
    );
  }

  try {
    const uploadedReceipt = await uploadAccountingReceipt(receiptFile);
    receiptUrl = uploadedReceipt || receiptUrl;
  } catch (uploadError) {
    redirect(
      `/admin/accounting?view=receipts&accountingError=${encodeURIComponent(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload receipt."
      )}`
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
  redirect("/admin/accounting?view=receipts&expenseAdded=1");
}

export async function updateExpense(formData: FormData) {
  const expenseId = getString(formData, "expense_id");
  const vendor = getString(formData, "vendor");
  const category = getString(formData, "category") || "General";
  const amount = getNumber(formData, "amount");
  const expenseDate = getString(formData, "expense_date");
  const note = getString(formData, "note") || null;
  const month = getString(formData, "month");
  const year = getString(formData, "year");

  const redirectUrl = `/admin/accounting?view=expenses&month=${encodeURIComponent(
    month
  )}&year=${encodeURIComponent(year)}`;

  if (!expenseId || !vendor || amount <= 0 || !expenseDate) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        "Expense update requires vendor, date, and amount."
      )}`
    );
  }

  const { error } = await supabaseAdmin
    .from("accounting_expenses")
    .update({
      vendor,
      category,
      amount,
      expense_date: expenseDate,
      note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", expenseId);

  if (error) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/admin/accounting");
  redirect(`${redirectUrl}&expenseAdded=1`);
}

export async function uploadExpenseReceipt(formData: FormData) {
  const expenseId = getString(formData, "expense_id");
  const receiptEntry = formData.get("receipt_file");
  const receiptFile = receiptEntry instanceof File ? receiptEntry : null;

  if (!expenseId || !receiptFile || receiptFile.size === 0) {
    redirect(
      "/admin/accounting?view=receipts&accountingError=Choose%20an%20expense%20and%20receipt%20file."
    );
  }

  let storagePath: string | null = null;

  try {
    storagePath = await uploadAccountingReceipt(receiptFile);
  } catch (uploadError) {
    redirect(
      `/admin/accounting?view=receipts&accountingError=${encodeURIComponent(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload receipt."
      )}`
    );
  }

  const { error } = await supabaseAdmin
    .from("accounting_expenses")
    .update({
      receipt_url: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", expenseId);

  if (error) {
    redirect(
      `/admin/accounting?view=receipts&accountingError=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/accounting");
  redirect("/admin/accounting?view=receipts&expenseAdded=1");
}

export async function addPresetExpense(formData: FormData) {
  const vendor = getString(formData, "vendor");
  const category = getString(formData, "category") || "Monthly";
  const amount = getNumber(formData, "amount");
  const expenseDate =
    getString(formData, "expense_date") ||
    new Date().toISOString().slice(0, 10);

  if (!vendor || amount <= 0) {
    redirect(
      "/admin/accounting?accountingError=Preset%20expense%20requires%20vendor%20and%20amount."
    );
  }

  const { error } = await supabaseAdmin
    .from("accounting_expenses")
    .insert({
      vendor,
      category,
      amount,
      expense_date: expenseDate,
      note: "Added from monthly quick list",
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

export async function saveRecurringExpenseTemplate(formData: FormData) {
  const templateId = getString(formData, "template_id");
  const vendor = getString(formData, "vendor");
  const category = getString(formData, "category") || "Monthly";
  const amount = getNumber(formData, "amount");
  const frequency =
    getString(formData, "frequency") === "weekly" ? "weekly" : "monthly";
  const dayOfMonth = Math.min(
    31,
    Math.max(1, Math.round(getNumber(formData, "day_of_month") || 1))
  );
  const dayOfWeek = Math.min(
    6,
    Math.max(0, Math.round(getNumber(formData, "day_of_week") || 0))
  );
  const startDate =
    getString(formData, "start_date") || new Date().toISOString().slice(0, 10);
  const endDate = getString(formData, "end_date") || null;
  const note = getString(formData, "note") || null;
  const active = formData.get("active") === "on";

  if (!vendor || amount <= 0) {
    redirect(
      "/admin/accounting?view=expenses&accountingError=Recurring%20expense%20requires%20vendor%20and%20amount."
    );
  }

  const payload = {
    vendor,
    category,
    amount,
    frequency,
    day_of_month: dayOfMonth,
    day_of_week: dayOfWeek,
    start_date: startDate,
    end_date: endDate,
    note,
    active,
    updated_at: new Date().toISOString(),
  };

  const { error } = templateId
    ? await supabaseAdmin
        .from("accounting_recurring_expenses")
        .update(payload)
        .eq("id", templateId)
    : await supabaseAdmin
        .from("accounting_recurring_expenses")
        .insert(payload);

  if (error) {
    redirect(
      `/admin/accounting?view=expenses&accountingError=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/accounting");
  redirect("/admin/accounting?view=expenses&recurringSaved=1");
}

export async function generateRecurringExpenses(formData: FormData) {
  const month = getNumber(formData, "month");
  const year = getNumber(formData, "year");

  if (month < 1 || month > 12 || year < 2026) {
    redirect(
      "/admin/accounting?view=expenses&accountingError=Choose%20a%20valid%20month%20and%20year."
    );
  }

  let result: {
    createdCount: number;
    skippedCount: number;
  };

  try {
    result = await generateAccountingRecurringExpenses({
      month,
      year,
    });
  } catch (error) {
    redirect(
      `/admin/accounting?view=expenses&month=${month}&year=${year}&accountingError=${encodeURIComponent(
        error instanceof Error
          ? error.message
          : "Unable to generate recurring expenses."
      )}`
    );
  }

  revalidatePath("/admin/accounting");
  redirect(
    `/admin/accounting?view=expenses&month=${month}&year=${year}&recurringGenerated=1&created=${result.createdCount}&skipped=${result.skippedCount}`
  );
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
  redirect("/admin/accounting?view=payments&zelleAdded=1#zelle-matching");
}

export async function approveZellePayment(formData: FormData) {
  const zelleId = getString(formData, "zelle_id");
  const chargeId = getString(formData, "charge_id");
  const month = getString(formData, "month");
  const year = getString(formData, "year");

  const redirectUrl = `/admin/accounting?view=payments&month=${encodeURIComponent(
    month
  )}&year=${encodeURIComponent(year)}`;

  if (!zelleId || !chargeId) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        "Choose a Zelle payment and a member charge to match."
      )}`
    );
  }

  const { data: zelle, error: zelleError } = await supabaseAdmin
    .from("zelle_payments")
    .select("id, payer_name, payer_email, amount, received_date, purpose, note, status")
    .eq("id", zelleId)
    .maybeSingle();

  if (zelleError || !zelle) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        zelleError?.message || "Zelle payment not found."
      )}`
    );
  }

  if (zelle.status === "matched") {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        "This Zelle payment was already matched."
      )}`
    );
  }

  const { data: charge, error: chargeError } = await supabaseAdmin
    .from("member_charges")
    .select("id, member_id, amount, status, charge_type, description")
    .eq("id", chargeId)
    .maybeSingle();

  if (chargeError || !charge) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        chargeError?.message || "Member charge not found."
      )}`
    );
  }

  if (charge.status === "paid") {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        "The selected charge is already paid."
      )}`
    );
  }

  const paidAt = zelle.received_date
    ? `${zelle.received_date}T12:00:00.000Z`
    : new Date().toISOString();
  const amount = Number(zelle.amount || 0);

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .insert({
      member_id: charge.member_id,
      charge_id: charge.id,
      amount,
      payment_method: "Zelle",
      payment_provider: "manual",
      payer_email: zelle.payer_email || null,
      status: "paid",
      note: [
        `Matched Zelle payment from ${zelle.payer_name}.`,
        zelle.note,
      ]
        .filter(Boolean)
        .join(" "),
      paid_at: paidAt,
    })
    .select("id")
    .single();

  if (paymentError || !payment) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        paymentError?.message || "Unable to save matched payment."
      )}`
    );
  }

  const { error: chargeUpdateError } = await supabaseAdmin
    .from("member_charges")
    .update({
      status: "paid",
      paid_at: paidAt,
      payment_method: "Zelle",
      payment_provider: "manual",
      paid_amount: amount,
      payment_note: `Matched Zelle payment from ${zelle.payer_name}`,
    })
    .eq("id", charge.id);

  if (chargeUpdateError) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        `Payment saved, but charge was not updated: ${chargeUpdateError.message}`
      )}`
    );
  }

  const { error: zelleUpdateError } = await supabaseAdmin
    .from("zelle_payments")
    .update({
      status: "matched",
      updated_at: new Date().toISOString(),
    })
    .eq("id", zelle.id);

  if (zelleUpdateError) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        `Charge was marked paid, but Zelle row was not updated: ${zelleUpdateError.message}`
      )}`
    );
  }

  try {
    await createAndSendReceipt({ paymentId: payment.id });
  } catch (receiptError) {
    console.error("ZELLE_MATCH_RECEIPT_ERROR", {
      paymentId: payment.id,
      zelleId,
      chargeId,
      error: receiptError,
    });
  }

  revalidatePath("/admin/accounting");
  revalidatePath(`/admin/members/${charge.member_id}`);
  revalidatePath(`/admin/members/${charge.member_id}/payments`);
  revalidatePath("/member/dashboard");

  redirect(`${redirectUrl}&zelleAdded=1#zelle-matching`);
}

export async function recordManualPayment(formData: FormData) {
  const chargeId = getString(formData, "charge_id");
  const paymentMethod = getString(formData, "payment_method") || "Check";
  const paidAmount = getNumber(formData, "paid_amount");
  const paidDate =
    getString(formData, "paid_date") ||
    new Date().toISOString().slice(0, 10);
  const payerEmail = getString(formData, "payer_email") || null;
  const paymentNote = getString(formData, "payment_note") || null;
  const month = getString(formData, "month");
  const year = getString(formData, "year");

  const redirectUrl = `/admin/accounting?view=payments&month=${encodeURIComponent(
    month
  )}&year=${encodeURIComponent(year)}`;

  if (!chargeId || paidAmount <= 0 || !paidDate) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        "Choose an open charge and enter the payment amount/date."
      )}`
    );
  }

  const { data: charge, error: chargeError } = await supabaseAdmin
    .from("member_charges")
    .select("id, member_id, amount, status, charge_type, description")
    .eq("id", chargeId)
    .maybeSingle();

  if (chargeError || !charge) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        chargeError?.message || "Member charge not found."
      )}`
    );
  }

  if (charge.status === "paid") {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        "The selected charge is already paid."
      )}`
    );
  }

  const paidAt = `${paidDate}T12:00:00.000Z`;
  const paymentProvider =
    paymentMethod.toLowerCase() === "card" ? "sola" : "manual";

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .insert({
      member_id: charge.member_id,
      charge_id: charge.id,
      amount: paidAmount,
      payment_method: paymentMethod,
      payment_provider: paymentProvider,
      payer_email: payerEmail,
      status: "paid",
      note: paymentNote,
      paid_at: paidAt,
    })
    .select("id")
    .single();

  if (paymentError || !payment) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        paymentError?.message || "Unable to save payment."
      )}`
    );
  }

  const { error: chargeUpdateError } = await supabaseAdmin
    .from("member_charges")
    .update({
      status: "paid",
      paid_at: paidAt,
      payment_method: paymentMethod,
      payment_provider: paymentProvider,
      paid_amount: paidAmount,
      payment_note: paymentNote,
    })
    .eq("id", charge.id);

  if (chargeUpdateError) {
    redirect(
      `${redirectUrl}&accountingError=${encodeURIComponent(
        `Payment saved, but charge was not updated: ${chargeUpdateError.message}`
      )}`
    );
  }

  try {
    await createAndSendReceipt({ paymentId: payment.id });
  } catch (receiptError) {
    console.error("ACCOUNTING_MANUAL_PAYMENT_RECEIPT_ERROR", {
      paymentId: payment.id,
      chargeId,
      error: receiptError,
    });
  }

  revalidatePath("/admin/accounting");
  revalidatePath(`/admin/members/${charge.member_id}`);
  revalidatePath(`/admin/members/${charge.member_id}/payments`);
  revalidatePath("/member/dashboard");

  redirect(`${redirectUrl}&paymentAdded=1`);
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = cells[index] || "";
    });

    return row;
  });
}

function rowAmount(row: Record<string, string>) {
  const value =
    row.amount || row.total || row.payment_amount || row.expense_amount;

  return Number(String(value || "").replace(/[$,]/g, ""));
}

function rowDate(row: Record<string, string>) {
  return (
    row.date ||
    row.received_date ||
    row.expense_date ||
    new Date().toISOString().slice(0, 10)
  );
}

function rowBoolean(value: string | undefined, defaultValue = true) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) return defaultValue;
  return !["false", "no", "n", "0", "inactive"].includes(normalized);
}

function rowInteger(value: string | undefined, fallback: number) {
  const parsed = Number(String(value || "").replace(/[$,]/g, ""));

  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export async function importAccountingCsv(formData: FormData) {
  const importType = getString(formData, "import_type");
  const fileEntry = formData.get("csv_file");
  const file = fileEntry instanceof File ? fileEntry : null;

  if (!file || file.size === 0) {
    redirect(
      "/admin/accounting?accountingError=Please%20choose%20a%20CSV%20file."
    );
  }

  const rows = parseCsv(await file.text());

  if (rows.length === 0) {
    redirect(
      "/admin/accounting?accountingError=CSV%20does%20not%20contain%20importable%20rows."
    );
  }

  if (importType === "zelle") {
    const zelleRows = rows
      .map((row) => ({
        payer_name: row.payer_name || row.name || row.from || row.sender,
        payer_email: row.payer_email || row.email || null,
        amount: rowAmount(row),
        received_date: rowDate(row),
        purpose: row.purpose || row.memo || row.description || "Zelle Payment",
        note: row.note || row.memo || null,
        status: "unmatched",
      }))
      .filter((row) => row.payer_name && row.amount > 0);

    if (zelleRows.length === 0) {
      redirect(
        "/admin/accounting?accountingError=No%20valid%20Zelle%20rows%20were%20found%20in%20the%20CSV."
      );
    }

    const { error } = await supabaseAdmin
      .from("zelle_payments")
      .insert(zelleRows);

    if (error) {
      redirect(
        `/admin/accounting?accountingError=${encodeURIComponent(
          error.message
        )}`
      );
    }

    revalidatePath("/admin/accounting");
    redirect("/admin/accounting?view=payments&zelleAdded=1#zelle-matching");
  }

  if (importType === "recurring_expenses") {
    const recurringRows = rows
      .map((row) => {
        const frequency =
          String(row.frequency || row.repeats || "").toLowerCase() ===
          "weekly"
            ? "weekly"
            : "monthly";
        const dayOfMonth = Math.min(
          31,
          Math.max(
            1,
            rowInteger(row.day_of_month || row.month_day, 1)
          )
        );
        const dayOfWeek = Math.min(
          6,
          Math.max(0, rowInteger(row.day_of_week || row.week_day, 0))
        );

        return {
          vendor: row.vendor || row.payee || row.name || row.description,
          category: row.category || "Imported",
          amount: rowAmount(row),
          frequency,
          day_of_month: dayOfMonth,
          day_of_week: dayOfWeek,
          start_date:
            row.start_date ||
            row.starts ||
            new Date().toISOString().slice(0, 10),
          end_date: row.end_date || row.ends || null,
          active: rowBoolean(row.active, true),
          note: row.note || row.memo || row.description || null,
        };
      })
      .filter((row) => row.vendor && row.amount > 0);

    if (recurringRows.length === 0) {
      redirect(
        "/admin/accounting?view=uploads&accountingError=No%20valid%20recurring%20expense%20rows%20were%20found%20in%20the%20CSV."
      );
    }

    const { error } = await supabaseAdmin
      .from("accounting_recurring_expenses")
      .insert(recurringRows);

    if (error) {
      redirect(
        `/admin/accounting?view=uploads&accountingError=${encodeURIComponent(
          error.message
        )}`
      );
    }

    revalidatePath("/admin/accounting");
    redirect("/admin/accounting?view=expenses&recurringSaved=1");
  }

  const expenseRows = rows
    .map((row) => ({
      vendor: row.vendor || row.payee || row.name || row.description,
      category: row.category || "Imported",
      amount: rowAmount(row),
      expense_date: rowDate(row),
      note: row.note || row.memo || row.description || null,
      receipt_url: row.receipt_url || null,
      status: "recorded",
    }))
    .filter((row) => row.vendor && row.amount > 0);

  if (expenseRows.length === 0) {
    redirect(
      "/admin/accounting?accountingError=No%20valid%20expense%20rows%20were%20found%20in%20the%20CSV."
    );
  }

  const { error } = await supabaseAdmin
    .from("accounting_expenses")
    .insert(expenseRows);

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
