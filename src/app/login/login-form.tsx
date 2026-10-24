"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { signInWithMicrosoft, signInWithPassword } from "@/lib/actions/auth";

export function LoginForm({ azureEnabled, initialError }: { azureEnabled: boolean; initialError?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signInWithPassword, undefined);

  return (
    <div className="space-y-6">
      {azureEnabled && (
        <>
          <form action={signInWithMicrosoft}>
            <Button type="submit" variant="outline" className="w-full">
              <MicrosoftLogo />
              {t("signInMicrosoft")}
            </Button>
          </form>
          <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state?.email} required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              {t("forgotPassword")}
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <FormMessage messageKey={state?.error ?? initialError} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("signingIn") : t("signIn")}
        </Button>
      </form>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" aria-hidden="true" className="size-4">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
