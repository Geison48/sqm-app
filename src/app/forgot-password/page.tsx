import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("forgotTitle")} description={t("forgotSubtitle")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
