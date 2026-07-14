import { supabaseAdmin } from "@/lib/supabaseAdmin";

function recurringExpenseDates({
  frequency,
  dayOfMonth,
  dayOfWeek,
  month,
  year,
}: {
  frequency: string | null;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  month: number;
  year: number;
}) {
  const monthEndDate = new Date(Date.UTC(year, month, 0));
  const lastDay = monthEndDate.getUTCDate();

  if (frequency === "weekly") {
    const targetDay = Math.min(6, Math.max(0, Number(dayOfWeek || 0)));
    const dates: string[] = [];

    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day));

      if (date.getUTCDay() === targetDay) {
        dates.push(
          `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
            2,
            "0"
          )}`
        );
      }
    }

    return dates;
  }

  const expenseDay = Math.min(lastDay, Number(dayOfMonth || 1));
  return [
    `${year}-${String(month).padStart(2, "0")}-${String(expenseDay).padStart(
      2,
      "0"
    )}`,
  ];
}

export async function generateAccountingRecurringExpenses({
  month,
  year,
}: {
  month: number;
  year: number;
}) {
  if (month < 1 || month > 12 || year < 2026) {
    throw new Error("Choose a valid month and year.");
  }

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEndDate = new Date(Date.UTC(year, month, 0));
  const monthEnd = monthEndDate.toISOString().slice(0, 10);

  const { data: templates, error: templatesError } = await supabaseAdmin
    .from("accounting_recurring_expenses")
    .select(
      "id, vendor, category, amount, frequency, day_of_month, day_of_week, start_date, end_date, note"
    )
    .eq("active", true)
    .lte("start_date", monthEnd)
    .or(`end_date.is.null,end_date.gte.${monthStart}`)
    .order("vendor", { ascending: true });

  if (templatesError) {
    throw new Error(templatesError.message);
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const template of templates || []) {
    const expenseDates = recurringExpenseDates({
      frequency: template.frequency,
      dayOfMonth: template.day_of_month,
      dayOfWeek: template.day_of_week,
      month,
      year,
    }).filter((expenseDate) => {
      const startsAfterExpense =
        template.start_date && template.start_date > expenseDate;
      const endedBeforeExpense =
        template.end_date && template.end_date < expenseDate;

      return !startsAfterExpense && !endedBeforeExpense;
    });

    for (const expenseDate of expenseDates) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("accounting_expenses")
        .select("id")
        .eq("recurring_template_id", template.id)
        .eq("expense_date", expenseDate)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existing) {
        skippedCount += 1;
        continue;
      }

      const { error: insertError } = await supabaseAdmin
        .from("accounting_expenses")
        .insert({
          vendor: template.vendor,
          category: template.category || "Monthly",
          amount: Number(template.amount || 0),
          expense_date: expenseDate,
          note: [
            `Generated from ${template.frequency || "monthly"} recurring expense template.`,
            template.note,
          ]
            .filter(Boolean)
            .join(" "),
          status: "recorded",
          recurring_template_id: template.id,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      createdCount += 1;
    }
  }

  return {
    createdCount,
    skippedCount,
  };
}
