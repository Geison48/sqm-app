"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startAudit } from "@/lib/actions/audits";

export function StartButton({ auditId, disabled }: { auditId: string; disabled?: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending || disabled} onClick={() => start(async () => {
      const r = await startAudit(auditId);
      if (r?.error) return void toast.error(t(r.error as never));
      toast.success(t("audits.started"));
      router.push(`/audits/${auditId}/execute`);
    })}><PlayIcon />{t("audits.start")}</Button>
  );
}
