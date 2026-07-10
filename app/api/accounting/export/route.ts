import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  autopay_active: boolean | null;
  recurring_amount: number | null;
  sola_recurring_id: string | null;
};

type Charge = {
  id: string;
  member_id: string;
  amount: number;
  status: string | null;
  paid_amount: number | null;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_provider: string | null;
  description: string | null;
};

function escapeCsv(value: unknown) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function getStatus({
  charge,
  autopayActive,
}: {
  charge: Charge | null;
  autopayActive: boolean;
}) {
  if (!charge) return "Not Billed";
  if (charge.status === "paid") return "Paid";
  if (autopayActive) return "Awaiting Auto-Pay";
  return "Unpaid";
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const now = new Date();

    const requestedMonth = Number(
      searchParams.get("month") || now.getMonth() + 1
    );

    const requestedYear = Number(
      searchParams.get("year") || now.getFullYear()
    );

    const month =
      Number.isFinite(requestedMonth) &&
      requestedMonth >= 1 &&
      requestedMonth <= 12
        ? requestedMonth
        : now.getMonth() + 1;

    const year =
      Number.isFinite(requestedYear) && requestedYear >= 2026
        ? requestedYear
        : now.getFullYear();

    const { data: members, error: membersError } = await supabaseAdmin
      .from("members")
      .select(
        "id, first_name, last_name, email, phone, autopay_active, recurring_amount, sola_recurring_id"
      )
      .eq("status", "active")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (membersError) {
      throw new Error(membersError.message);
    }

    const { data: charges, error: chargesError } = await supabaseAdmin
      .from("member_charges")
      .select(
        "id, member_id, amount, status, paid_amount, due_date, paid_at, payment_method, payment_provider, description"
      )
      .eq("charge_type", "Membership Dues")
      .eq("billing_month", month)
      .eq("billing_year", year);

    if (chargesError) {
      throw new Error(chargesError.message);
    }

    const typedMembers = (members || []) as Member[];
    const typedCharges = (charges || []) as Charge[];

    const chargeMap = new Map(
      typedCharges.map((charge) => [charge.member_id, charge])
    );

    const headers = [
      "Member",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Billing Month",
      "Billing Year",
      "Amount Billed",
      "Amount Paid",
      "Balance",
      "Due Date",
      "Status",
      "Paid Date",
      "Payment Method",
      "Payment Provider",
      "Auto-Pay Active",
      "Sola Recurring ID",
      "Description",
    ];

    const rows = typedMembers.map((member) => {
      const charge = chargeMap.get(member.id) || null;

      const amountBilled = Number(charge?.amount || 0);
      const amountPaid =
        charge?.status === "paid"
          ? Number(charge.paid_amount || charge.amount || 0)
          : 0;

      const balance = Math.max(0, amountBilled - amountPaid);

      return [
        `${member.first_name} ${member.last_name}`,
        member.first_name,
        member.last_name,
        member.email || "",
        member.phone || "",
        month,
        year,
        amountBilled.toFixed(2),
        amountPaid.toFixed(2),
        balance.toFixed(2),
        formatDate(charge?.due_date),
        getStatus({
          charge,
          autopayActive: Boolean(member.autopay_active),
        }),
        formatDate(charge?.paid_at),
        charge?.payment_method || "",
        charge?.payment_provider || "",
        member.autopay_active ? "Yes" : "No",
        member.sola_recurring_id || "",
        charge?.description || "",
      ];
    });

    const csv = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\r\n");

    const filename = `kba-accounting-${year}-${String(month).padStart(
      2,
      "0"
    )}.csv`;

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ACCOUNTING_CSV_EXPORT_ERROR", error);

    return NextResponse.json(
      {
        error: "Unable to export the accounting report.",
      },
      { status: 500 }
    );
  }
}