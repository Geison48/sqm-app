"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormMessage } from "@/components/form-message";
import { locales } from "@/i18n/config";
import type { AppRole } from "@/lib/auth";
import { inviteUser, type InviteState } from "@/lib/actions/users";

export function InviteUserDialog({
  allowedRoles,
  suppliers,
}: {
  allowedRoles: AppRole[];
  suppliers: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AppRole>(allowedRoles.includes("supplier") ? "supplier" : allowedRoles[0]!);
  const [state, action, pending] = useActionState(async (prev: InviteState, formData: FormData) => {
    const result = await inviteUser(prev, formData);
    if (result?.success) {
      toast.success(t("users.inviteSent", { email: result.email ?? "" }));
      setOpen(false);
    }
    return result;
  }, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon />
          {t("users.invite")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.inviteTitle")}</DialogTitle>
          <DialogDescription>{t("users.inviteDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("users.fullName")}</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("users.email")}</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">{t("users.role")}</Label>
              <Select name="role" value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`roles.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">{t("users.language")}</Label>
              <Select name="language" defaultValue={locale}>
                <SelectTrigger id="language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((l) => (
                    <SelectItem key={l} value={l}>
                      {t(`languages.${l}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {role === "supplier" && (
            <div className="space-y-2">
              <Label htmlFor="supplierId">{t("users.supplier")}</Label>
              <Select name="supplierId" required>
                <SelectTrigger id="supplierId" className="w-full">
                  <SelectValue placeholder={t("users.selectSupplier")} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <FormMessage messageKey={state?.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("users.sending") : t("users.sendInvite")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
