"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LightbulbIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormMessage } from "@/components/form-message";
import { NONE } from "@/lib/action-state";
import { createNc, suggest8d, type SuggestionResult } from "@/lib/actions/ncs";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

function Field({ label, children, optional, className }: { label: string; children: React.ReactNode; optional?: boolean; className?: string }) {
  const t = useTranslations("common");
  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label}
        {optional && <span className="font-normal text-muted-foreground"> ({t("optional")})</span>}
      </Label>
      {children}
    </div>
  );
}

function Choice({ name, options, value, defaultValue, onChange, required, placeholder }: {
  name: string; options: Option[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  const t = useTranslations("common");
  const list = required ? options : [{ value: NONE, label: "—" }, ...options];
  return (
    <Select name={name} value={value} defaultValue={defaultValue} onValueChange={onChange} required={required}>
      <SelectTrigger className="w-full" aria-label={name}><SelectValue placeholder={placeholder ?? t("select")} /></SelectTrigger>
      <SelectContent>
        {list.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function NewNcForm(props: {
  suppliers: Option[];
  componentsBySupplier: Record<string, Option[]>;
  origins: Option[];
  severities: Option[];
  failureModes: Option[];
  dispositions: Option[];
  // Vindo de uma inspeção NOK (Etapa 5): dados já preenchidos, editáveis.
  prefill?: { supplier?: string; component?: string; origin?: string; title?: string; description?: string; sn?: string; unit?: string };
}) {
  const pre = props.prefill ?? {};
  const t = useTranslations();
  const [supplierId, setSupplierId] = useState(pre.supplier ?? "");
  const [componentId, setComponentId] = useState(pre.component ?? NONE);
  const [severity, setSeverity] = useState("");
  const [failureMode, setFailureMode] = useState(NONE);
  const [customer, setCustomer] = useState(false);
  const [type, setType] = useState<"simple" | "8d">("simple");
  const [items, setItems] = useState([{ sn: pre.sn ?? "", qty: pre.sn ? "1" : "", unit: pre.unit ?? "" }]);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [, startSuggest] = useTransition();
  const [, startSubmit] = useTransition();
  const [state, dispatch, pending] = useActionState(createNc, undefined);

  // Regra 5: recalcula a sugestão sempre que um gatilho muda.
  useEffect(() => {
    startSuggest(async () => {
      const result = await suggest8d({
        severity: severity || null,
        customerAffected: customer,
        componentId: componentId === NONE ? null : componentId,
        failureMode: failureMode === NONE ? null : failureMode,
      });
      setSuggestion(result);
    });
  }, [severity, customer, componentId, failureMode]);

  const components = props.componentsBySupplier[supplierId] ?? [];
  const reasons = suggestion?.reasons ?? [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSubmit(() => dispatch(fd));
      }}
      className="space-y-6"
    >
      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <Field label={t("ncs.supplier")} className="sm:col-span-2">
          <Choice name="supplier_id" options={props.suppliers} value={supplierId || undefined} required
            onChange={(v) => { setSupplierId(v); setComponentId(NONE); }} />
        </Field>
        <Field label={t("ncs.component")} optional className="sm:col-span-2">
          <Choice name="component_id" options={components} value={componentId} onChange={setComponentId} />
        </Field>
        <Field label={t("ncs.origin")}>
          <Choice name="origin_code" options={props.origins} required defaultValue={pre.origin} />
        </Field>
        <Field label={t("ncs.severity")}>
          <Choice name="severity_code" options={props.severities} value={severity || undefined} onChange={setSeverity} required />
        </Field>
        <Field label={t("ncs.failureMode")} optional>
          <Choice name="failure_mode_code" options={props.failureModes} value={failureMode} onChange={setFailureMode} />
        </Field>
        <Field label={t("ncs.detectedOn")}>
          <Input name="detected_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="customer_affected" checked={customer} onChange={(e) => setCustomer(e.target.checked)}
            className="size-4 accent-primary" />
          {t("ncs.customerAffected")}
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <Field label={t("ncs.ncTitle")} className="sm:col-span-2">
          <Input name="title" required maxLength={200} defaultValue={pre.title} />
        </Field>
        <Field label={t("ncs.description")} className="sm:col-span-2">
          <Textarea name="description" required rows={4} defaultValue={pre.description} />
        </Field>
        <Field label={t("ncs.detectedLocation")} optional>
          <Input name="detected_location" />
        </Field>
        <Field label={t("ncs.quantityAffected")} optional>
          <Input name="quantity_affected" type="number" min={0} step="any" />
        </Field>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t("ncs.items")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></Label>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input type="hidden" name="item_unit" value={item.unit} />
              <Input name="item_sn" placeholder={t("ncs.snOrLot")} value={item.sn}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, sn: e.target.value, unit: "" } : x)))} />
              <Input name="item_qty" type="number" min={0} step="any" placeholder={t("ncs.quantity")} className="w-24" value={item.qty}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label={t("ncs.removeItem")} disabled={items.length === 1}
                onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2Icon /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { sn: "", qty: "", unit: "" }])}>
            <PlusIcon />{t("ncs.addItem")}
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        {severity && (
          <div className={cn("flex gap-3 rounded-md p-3 text-sm", suggestion?.suggest ? "bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "bg-muted")}>
            <LightbulbIcon className="mt-0.5 size-4 shrink-0" />
            {suggestion?.suggest ? (
              <div className="space-y-1">
                <p className="font-medium">{t("ncs.suggest8d")}</p>
                <ul className="list-disc pl-4">
                  {reasons.map((r) => <li key={r}>{t(`ncs.suggestionReasons.${r as "severity"}`)}</li>)}
                </ul>
                {suggestion.previous.length > 0 && (
                  <p>
                    {t("ncs.suggestionPrevious", { list: "" })}
                    {suggestion.previous.map((p, i) => (
                      <span key={p.id}>{i > 0 && ", "}<Link href={`/ncs/${p.id}`} target="_blank" className="underline">{p.number}</Link></span>
                    ))}
                  </p>
                )}
                <p className="text-xs opacity-80">{t("ncs.decisionIsYours")}</p>
              </div>
            ) : (
              <p>{t("ncs.suggestionNone")}</p>
            )}
          </div>
        )}
        <Field label={t("ncs.type")}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["simple", "8d"] as const).map((v) => (
              <label key={v} className={cn("flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm",
                type === v && "border-primary ring-1 ring-primary")}>
                <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="accent-primary" />
                {t(`ncs.types.${v}`)}
              </label>
            ))}
          </div>
        </Field>
        {type === "simple" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("ncs.disposition")} optional>
              <Choice name="disposition_code" options={props.dispositions} />
            </Field>
            <Field label={t("ncs.dispositionNotes")} optional className="sm:col-span-2">
              <Textarea name="disposition_notes" rows={2} />
            </Field>
          </div>
        )}
      </section>

      <FormMessage messageKey={state?.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild><Link href="/ncs">{t("common.cancel")}</Link></Button>
        <Button type="submit" disabled={pending}>{t("ncs.new")}</Button>
      </div>
    </form>
  );
}
