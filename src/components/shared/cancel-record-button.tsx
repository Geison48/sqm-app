"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BanIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/form-message";
import { cancelRecord } from "@/lib/actions/records";

type Table = Parameters<typeof cancelRecord>[0]["table"];

export function CancelRecordButton({
  table,
  id,
  path,
  compact = true,
}: {
  table: Table;
  id: string;
  path: string;
  compact?: boolean;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await cancelRecord({ table, id, reason, path });
      if (result?.error) return setError(result.error);
      toast.success(t("recordCancelled"));
      setOpen(false);
      setReason("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={t("cancelRecord")} title={t("cancelRecord")}>
            <BanIcon />
          </Button>
        ) : (
          <Button variant="outline">
            <BanIcon />
            {t("cancelRecord")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("cancelRecordTitle")}</DialogTitle>
          <DialogDescription>{t("cancelRecordDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`reason-${id}`}>{t("cancelReason")}</Label>
          <Textarea id={`reason-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <FormMessage messageKey={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("back")}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending || reason.trim().length < 3}>
            {t("confirmCancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
