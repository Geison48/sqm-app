"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeInspection } from "@/lib/actions/inspections";

export function CompleteButton({ inspectionId }: { inspectionId: string }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} title={t("inspections.completeDescription")} onClick={() => start(async () => {
      const r = await completeInspection(inspectionId);
      if (r?.error) return void toast.error(t(r.error as never));
      toast.success(t("inspections.completed"));
    })}><CheckCheckIcon />{t("inspections.complete")}</Button>
  );
}
