import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("portal_role, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (
    member?.portal_role === "admin" && member.portal_status !== "disabled"
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ expenseId: string }> }
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { expenseId } = await context.params;
    const { data: expense, error } = await supabaseAdmin
      .from("accounting_expenses")
      .select("id, receipt_url")
      .eq("id", expenseId)
      .maybeSingle();

    if (error || !expense?.receipt_url) {
      return NextResponse.json(
        { error: error?.message || "Receipt not found." },
        { status: 404 }
      );
    }

    if (/^https?:\/\//i.test(expense.receipt_url)) {
      return NextResponse.redirect(expense.receipt_url);
    }

    const { data, error: signedUrlError } = await supabaseAdmin.storage
      .from("accounting-receipts")
      .createSignedUrl(expense.receipt_url, 60);

    if (signedUrlError || !data?.signedUrl) {
      return NextResponse.json(
        { error: signedUrlError?.message || "Unable to open receipt." },
        { status: 500 }
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error("ACCOUNTING_RECEIPT_OPEN_ERROR", error);

    return NextResponse.json(
      { error: "Unable to open accounting receipt." },
      { status: 500 }
    );
  }
}
