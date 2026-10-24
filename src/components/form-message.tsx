"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Mostra uma mensagem cuja chave de tradução veio de uma server action.
export function FormMessage({ messageKey, tone = "error" }: { messageKey?: string; tone?: "error" | "success" }) {
  const t = useTranslations();
  if (!messageKey) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("text-sm", tone === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {t(messageKey as any)}
    </p>
  );
}
