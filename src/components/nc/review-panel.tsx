"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/form-message";
import { reviewStep } from "@/lib/actions/ncs";

// SQE aprova (em ordem) ou reprova (comentário obrigatório) a D enviada.
export function ReviewPanel({ ncId, stepId, canApprove }: { ncId: string; stepId: string; canApprove: boolean }) {
  const t = useTranslations("eightD");
  const tr = useTranslations();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function decide(approve: boolean) {
    start(async () => {
      const result = await reviewStep({ ncId, stepId, approve, comment });
      if (result?.error) return setError(result.error);
      setError(undefined);
      setComment("");
      toast.success(tr(result!.success as never));
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
      <div className="space-y-2">
        <Label htmlFor={`review-${stepId}`}>{t("reviewComment")}</Label>
        <Textarea id={`review-${stepId}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        <p className="text-xs text-muted-foreground">{t("rejectHint")}</p>
      </div>
      <FormMessage messageKey={error} />
      {!canApprove && <p className="text-sm text-amber-700 dark:text-amber-400">{t("approveBlocked")}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={pending || comment.trim().length < 3} onClick={() => decide(false)}>
          <XIcon />{t("reject")}
        </Button>
        <Button disabled={pending || !canApprove} onClick={() => decide(true)}>
          <CheckIcon />{t("approve")}
        </Button>
      </div>
    </div>
  );
}
