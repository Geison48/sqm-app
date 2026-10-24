"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { FormMessage } from "@/components/form-message";
import { convertTo8d } from "@/lib/actions/ncs";

export function ConvertButton({ ncId }: { ncId: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">{t("ncs.convertTo8d")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ncs.convertTo8d")}</DialogTitle>
          <DialogDescription>{t("ncs.convertConfirm")}</DialogDescription>
        </DialogHeader>
        <FormMessage messageKey={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await convertTo8d(ncId);
            if (r?.error) return setError(r.error);
            toast.success(t("ncs.converted"));
            setOpen(false);
          })}>{t("ncs.convertTo8d")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
