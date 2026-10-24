"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { setPassword } from "@/lib/actions/auth";

export function SetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(setPassword, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="text-xs text-muted-foreground">{t("passwordRules")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">{t("confirmPassword")}</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <FormMessage messageKey={state?.error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {t("setPasswordTitle")}
      </Button>
    </form>
  );
}
