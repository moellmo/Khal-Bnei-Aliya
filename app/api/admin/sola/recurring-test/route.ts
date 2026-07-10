import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { callSolaRecurringApi } from "@/lib/solaRecurring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const { data: member, error: memberError } =
      await supabaseAdmin
        .from("members")
        .select("id, portal_role, portal_status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (
      !member ||
      member.portal_role !== "admin" ||
      member.portal_status === "disabled"
    ) {
      return NextResponse.json(
        { error: "Admin access is required." },
        { status: 403 }
      );
    }

    const result = await callSolaRecurringApi(
      "ListSchedules",
      {
        PageSize: 5,
        SortOrder: "Descending",
        Filters: {
          IsDeleted: false,
        },
      }
    );

    return NextResponse.json({
      success: true,
      scheduleCount: Array.isArray(result.Schedules)
        ? result.Schedules.length
        : 0,
      result,
    });
  } catch (error) {
    console.error("SOLA_RECURRING_TEST_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to connect to Sola recurring.",
      },
      { status: 500 }
    );
  }
}