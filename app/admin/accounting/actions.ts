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
    redirect("/admin/accounting?zelleAdded=1");
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
