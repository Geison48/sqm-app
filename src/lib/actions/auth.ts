"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";

export type FormState = { error?: string; success?: string; email?: string } | undefined;

const ONE_YEAR = 60 * 60 * 24 * 365;

async function persistLocale(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}

// Depois do login, o idioma da interface passa a ser o do perfil.
async function applyProfileLocale() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return;
  const { data } = await supabase.from("users").select("language").eq("id", userId).maybeSingle();
  if (data && isLocale(data.language)) await persistLocale(data.language);
}

export async function signInWithPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "auth.invalidCredentials", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "auth.invalidCredentials", email };

  // Entrou com senha: não precisa passar por "Definir senha".
  await supabase.rpc("mark_password_set");
  await applyProfileLocale();
  redirect("/");
}

export async function signInWithMicrosoft() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: { scopes: "email openid profile", redirectTo: `${SITE_URL}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "users.errorInvalidEmail" };

  const supabase = await createClient();
  // Resposta sempre igual, exista ou não o e-mail (não revela quem é usuário).
  // Fluxo implícito: o link funciona em qualquer aparelho (o PKCE exigiria abrir no
  // mesmo navegador). A sessão volta no fragmento da URL e o AuthHashHandler a recebe.
  const implicit = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: "implicit", persistSession: false } });
  await implicit.auth.resetPasswordForEmail(email.data, { redirectTo: `${SITE_URL}/login` });
  return { success: "auth.resetLinkSent" };
}

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Za-z]/)
  .regex(/[0-9]/);

export async function setPassword(_: FormState, formData: FormData): Promise<FormState> {
  const password = formData.get("password");
  if (password !== formData.get("confirm")) return { error: "auth.passwordMismatch" };
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: "auth.passwordWeak" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: error.code === "weak_password" ? "auth.passwordWeak" : "auth.linkInvalid" };

  await supabase.rpc("mark_password_set");
  await applyProfileLocale();
  redirect("/");
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  await persistLocale(locale);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (userId) await supabase.from("users").update({ language: locale }).eq("id", userId);
}
