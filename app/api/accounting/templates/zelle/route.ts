export async function GET() {
  const csv = [
    "payer_name,payer_email,amount,received_date,purpose,note",
    "Sample Member,member@example.com,75.00,2026-07-01,Membership Dues,July dues",
    "Guest Donor,donor@example.com,180.00,2026-07-06,Donation,Shabbos donation",
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kba-zelle-template.csv"',
    },
  });
}
