"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LanguagesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales } from "@/i18n/config";
import { setLocale } from "@/lib/actions/auth";

export function LanguageSwitcher() {
  const t = useTranslations("languages");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} aria-label={t("label")}>
          <LanguagesIcon />
          <span className="hidden sm:inline">{t(locale)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={locale} onValueChange={change}>
          {locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {t(l)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
