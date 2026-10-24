import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

// Retorno do login Microsoft (OAuth). Só entra quem já foi convidado: o cadastro
// público está desligado no Supabase e o perfil precisa existir em public.users.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth", request.url));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=oauth", request.url));

  const { data: profile } = await supabase
    .from("users")
    .select("language, cancelled_at")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || profile.cancelled_at) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/auth/unauthorized", request.url));
  }

  if (isLocale(profile.language)) {
    (await cookies()).set(LOCALE_COOKIE, profile.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return NextResponse.redirect(new URL("/", request.url));
}
