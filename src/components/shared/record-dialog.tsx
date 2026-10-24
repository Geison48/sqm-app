"use client";

import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormMessage } from "@/components/form-message";
import { NONE, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "url" | "tel" | "date" | "number" | "textarea" | "select" | "checkbox";
  required?: boolean;
  defaultValue?: string | number | boolean | null;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  span?: 1 | 2;
  step?: string;
};

// Formulário genérico em diálogo. Os rótulos já chegam traduzidos; o resultado
// da action é uma chave de tradução.
export function RecordDialog({
  trigger,
  title,
  description,
  fields,
  action,
  submitLabel,
  hidden,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  fields: FieldDef[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel?: string;
  hidden?: Record<string, string>;
  children?: ReactNode;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  const [state, dispatch, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.success) {
      toast.success(t(result.success as never));
      setOpen(false);
    }
    return result;
  }, undefined);

  // onSubmit em vez de action={}: o React não limpa o formulário quando há erro.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <Field key={f.name} field={f} />
            ))}
          </div>
          {children}
          <FormMessage messageKey={state?.error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {submitLabel ?? t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ field: f }: { field: FieldDef }) {
  const t = useTranslations("common");
  const id = `f-${f.name}`;
  const span = f.span === 1 ? "" : "sm:col-span-2";
  const label = (
    <Label htmlFor={id}>
      {f.label}
      {!f.required && f.type !== "checkbox" && (
        <span className="font-normal text-muted-foreground"> ({t("optional")})</span>
      )}
    </Label>
  );
  const hint = f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>;

  if (f.type === "checkbox") {
    return (
      <div className={cn("flex items-center gap-2", span)}>
        <input
          id={id}
          name={f.name}
          type="checkbox"
          defaultChecked={!!f.defaultValue}
          className="size-4 accent-primary"
        />
        <Label htmlFor={id} className="font-normal">
          {f.label}
        </Label>
      </div>
    );
  }

  if (f.type === "select") {
    const options = f.required ? f.options ?? [] : [{ value: NONE, label: "—" }, ...(f.options ?? [])];
    const defaultValue = f.defaultValue != null && f.defaultValue !== "" ? String(f.defaultValue) : f.required ? undefined : NONE;
    return (
      <div className={cn("space-y-2", span)}>
        {label}
        <Select name={f.name} defaultValue={defaultValue} required={f.required}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={f.placeholder ?? t("select")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hint}
      </div>
    );
  }

  if (f.type === "textarea") {
    return (
      <div className={cn("space-y-2", span)}>
        {label}
        <Textarea
          id={id}
          name={f.name}
          required={f.required}
          defaultValue={f.defaultValue == null ? undefined : String(f.defaultValue)}
          placeholder={f.placeholder}
          rows={3}
        />
        {hint}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", span)}>
      {label}
      <Input
        id={id}
        name={f.name}
        type={f.type ?? "text"}
        required={f.required}
        step={f.step}
        defaultValue={f.defaultValue == null ? undefined : String(f.defaultValue)}
        placeholder={f.placeholder}
      />
      {hint}
    </div>
  );
}
