"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generatePlan, submitPlan } from "@/lib/actions/audits";

export function PlanActionButton({ kind, year, planId, label }: { kind: "generate" | "submit"; year?: number; planId?: string; label: string }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <Button variant={kind === "generate" ? "outline" : "default"} disabled={pending} onClick={() => start(async () => {
      const r = kind === "generate" ? await generatePlan(year!) : await submitPlan(planId!);
      if (r?.error) toast.error(t(r.error as never));
      else if (r?.success) toast.success(t(r.success as never));
    })}>{label}</Button>
  );
}
