"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCheckIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { markAllNotificationsRead, markNotificationRead, setEmailNotifications } from "@/lib/actions/notifications";

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

export function EmailToggle({ enabled }: { enabled: boolean }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm" title={t("notifications.emailToggleHint")}>
      <input type="checkbox" defaultChecked={enabled} disabled={pending} className="mt-0.5 size-4 accent-primary"
        onChange={(e) => {
          const value = e.target.checked;
          start(async () => {
            const r = await setEmailNotifications(value);
            if (r.error) toast.error(t(r.error as never));
            else toast.success(t(r.success as never));
          });
        }} />
      <span>{t("notifications.emailToggle")}</span>
    </label>
  );
}
