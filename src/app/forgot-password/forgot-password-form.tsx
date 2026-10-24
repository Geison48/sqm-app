"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { requestPasswordReset } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <FormMessage messageKey={state?.error} />
      <FormMessage messageKey={state?.success} tone="success" />
      <Button type="submit" className="w-full" disabled={pending}>
        {t("sendResetLink")}
      </Button>
      <Link href="/login" className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
        {t("backToLogin")}
      </Link>
    </form>
  );
}
