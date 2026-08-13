import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("portal_role, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return member?.portal_role === "admin" && member.portal_status !== "disabled";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("yom_tov_assistance_requests")
    .select("family_name, family_id_number, total_people_in_family, children_ages_3_8_rosh_hashanah, children_ages_3_8_first_days_sukkos, children_ages_3_8_shemini_atzeres, children_ages_9_13_rosh_hashanah, children_ages_9_13_first_days_sukkos, children_ages_9_13_shemini_atzeres, age_14_plus_rosh_hashanah, age_14_plus_first_days_sukkos, age_14_plus_shemini_atzeres, total_points")
    .order("family_id_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "Family Name",
    "Family ID Number",
    "Total People in Family (Auto-calculated)",
    "Children Ages 3–8 - Rosh Hashanah",
    "Children Ages 3–8 - First Days Sukkos",
    "Children Ages 3–8 - Shemini Atzeres",
    "Children Ages 9–13 - Rosh Hashanah",
    "Children Ages 9–13 - First Days Sukkos",
    "Children Ages 9–13 - Shemini Atzeres",
    "Age 14+ - Rosh Hashanah",
    "Age 14+ - First Days Sukkos",
    "Age 14+ - Shemini Atzeres",
    "Total Points",
  ];

  const rows = (data || []).map((row) => [
    row.family_name,
    row.family_id_number,
    row.total_people_in_family,
    row.children_ages_3_8_rosh_hashanah,
    row.children_ages_3_8_first_days_sukkos,
    row.children_ages_3_8_shemini_atzeres,
    row.children_ages_9_13_rosh_hashanah,
    row.children_ages_9_13_first_days_sukkos,
    row.children_ages_9_13_shemini_atzeres,
    row.age_14_plus_rosh_hashanah,
    row.age_14_plus_first_days_sukkos,
    row.age_14_plus_shemini_atzeres,
    Number(row.total_points || 0).toFixed(2),
  ]);

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="yom-tov-assistance.csv"',
      "Cache-Control": "no-store",
    },
  });
}
