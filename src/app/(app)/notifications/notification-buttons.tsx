"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCheckIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";

export function MarkReadButton({ id }: { id: string }) {
  const t = useTranslations("notifications");
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="icon" className="size-8" disabled={pending} title={t("markRead")} aria-label={t("markRead")}
      onClick={() => start(() => markNotificationRead(id))}>
      <CheckIcon />
    </Button>
  );
}

export function MarkAllReadButton() {
  const t = useTranslations("notifications");
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(() => markAllNotificationsRead())}>
      <CheckCheckIcon />
      {t("markAllRead")}
    </Button>
  );
}
