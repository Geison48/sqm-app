"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/form-message";
import type { ActionState } from "@/lib/action-state";

// Pedido de concessão: características e SNs dependem do componente escolhido.
export function WaiverRequestFields({ pairs, characteristics, units, action, trigger }: {
  pairs: { value: string; label: string }[];
  characteristics: { id: string; componentId: string; label: string }[];
  units: { id: string; pair: string; label: string }[];
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  trigger: ReactNode;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [pair, setPair] = useState(pairs[0]?.value ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [supplierId, componentId] = pair.split("|");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("supplier_id", supplierId ?? "");
    fd.set("component_id", componentId ?? "");
    setPending(true);
    const r = await action(undefined, fd);
    setPending(false);
    if (r?.error) return setError(r.error);
    toast.success(t(r!.success as never));
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("waivers.request")}</DialogTitle>
          <DialogDescription>{t("waivers.limitHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="w-pair">{t("inspections.component")}</Label>
            <select id="w-pair" value={pair} onChange={(e) => setPair(e.target.value)} required
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              {pairs.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-desc">{t("waivers.description")}</Label>
            <Input id="w-desc" name="description" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-just">{t("waivers.justification")}</Label>
            <Textarea id="w-just" name="justification" required rows={3} />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("waivers.characteristics")}</legend>
            <p className="text-xs text-muted-foreground">{t("waivers.allCharacteristics")}</p>
            {characteristics.filter((c) => c.componentId === componentId).map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="characteristic_ids" value={c.id} className="size-4 accent-primary" />{c.label}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="w-until">{t("waivers.validUntil")}</Label>
              <Input id="w-until" name="valid_until" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="w-qty">{t("waivers.maxQuantity")}</Label>
              <Input id="w-qty" name="max_quantity" type="number" min={1} step="any" />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("waivers.units")}</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {units.filter((u) => u.pair === pair).map((u) => (
                <label key={u.id} className="flex items-center gap-2 font-mono text-xs">
                  <input type="checkbox" name="serial_unit_ids" value={u.id} className="size-4 accent-primary" />{u.label}
                </label>
              ))}
            </div>
          </fieldset>
          <FormMessage messageKey={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={pending}>{t("waivers.request")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
