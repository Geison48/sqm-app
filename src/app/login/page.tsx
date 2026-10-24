import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { getProfile } from "@/lib/auth";
import { AZURE_LOGIN_ENABLED } from "@/lib/env";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getProfile()) redirect("/");
  const t = await getTranslations("auth");
  const { error } = await searchParams;

  return (
    <AuthShell title={t("loginTitle")} description={t("loginSubtitle")}>
      <LoginForm azureEnabled={AZURE_LOGIN_ENABLED} initialError={error ? "auth.linkInvalid" : undefined} />
    </AuthShell>
  );
}
