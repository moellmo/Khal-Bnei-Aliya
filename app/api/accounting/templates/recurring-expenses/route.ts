export async function GET() {
  const csv = [
    "vendor,category,amount,frequency,day_of_month,day_of_week,start_date,end_date,active,note",
    "Rent,Rent,1200.00,monthly,1,0,2026-07-01,,true,Monthly rent default",
    "Rabbi,Payroll,1500.00,monthly,1,0,2026-07-01,,true,Monthly rabbi default",
    "Baal Korei,Payroll,125.00,weekly,1,6,2026-07-01,,true,Weekly default; edit generated rows when amount changes",
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="kba-recurring-expenses-template.csv"',
    },
  });
}
