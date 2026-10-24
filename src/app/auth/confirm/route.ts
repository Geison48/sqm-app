import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

// Destino dos links de e-mail (convite e redefinição de senha).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user) {
      // A tela de definir senha já aparece no idioma escolhido no convite.
      const { data: profile } = await supabase
        .from("users")
        .select("language")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile && isLocale(profile.language)) {
        (await cookies()).set(LOCALE_COOKIE, profile.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
      }
      const next = type === "invite" || type === "recovery" ? "/auth/set-password" : "/";
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
