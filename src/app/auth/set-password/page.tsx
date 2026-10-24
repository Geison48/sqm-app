import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("setPasswordTitle") };
}

// Primeiro acesso (convite) ou redefinição: a sessão veio do link do e-mail.
export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?error=link");

  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("setPasswordTitle")} description={t("setPasswordSubtitle")}>
      <SetPasswordForm />
    </AuthShell>
  );
}
