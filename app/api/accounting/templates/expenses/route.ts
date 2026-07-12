export async function GET() {
  const csv = [
    "vendor,category,amount,expense_date,receipt_url,note",
    "Rent,Rent,1200.00,2026-07-01,,July rent",
    "Kiddush,Kiddush,180.00,2026-07-06,,Shabbos kiddush",
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kba-expenses-template.csv"',
    },
  });
}
