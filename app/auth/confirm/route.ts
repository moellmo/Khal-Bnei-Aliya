import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next =
    requestUrl.searchParams.get("next") || "/member/set-password";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL(
        "/login?error=The%20invitation%20link%20is%20invalid%20or%20incomplete.",
        request.url
      )
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        "/login?error=The%20invitation%20link%20has%20expired%20or%20is%20invalid.",
        request.url
      )
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}