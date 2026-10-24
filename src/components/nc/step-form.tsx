"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon, SendIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DISCIPLINE_FIELDS, type Discipline, type ScalarField, type StepContent } from "@/lib/eight-d";
import { saveStep } from "@/lib/actions/ncs";

type Row = Record<string, string>;

// Formulário de uma disciplina, gerado a partir de DISCIPLINE_FIELDS.
export function StepForm({
  ncId,
  stepId,
  discipline,
  initial,
  editable,
}: {
  ncId: string;
  stepId: string;
  discipline: Discipline;
  initial: StepContent;
  editable: boolean;
}) {
  const t = useTranslations("eightD");
  const tr = useTranslations();
  const [content, setContent] = useState<StepContent>(initial);
  const [error, setError] = useState<{ key: string; fields?: string }>();
  const [pending, start] = useTransition();
  const fields = DISCIPLINE_FIELDS[discipline];
  const set = (key: string, value: unknown) => setContent((c) => ({ ...c, [key]: value }));

  function save(submit: boolean) {
    start(async () => {
      const result = await saveStep({ ncId, stepId, discipline, content, submit });
      if (result?.error) {
        const names = (result.missing ?? []).map((k) => t(`fields.${k}` as "fields.what")).join(", ");
        return setError({ key: result.error, fields: names });
      }
      setError(undefined);
      toast.success(tr(result!.success as never));
    });
  }

  function scalar(f: ScalarField, value: unknown, onChange: (v: unknown) => void, id: string, compact = false) {
    const str = typeof value === "string" ? value : "";
    if (!editable) {
      if (f.type === "checkbox") return <p className="text-sm">{value ? tr("common.yes") : tr("common.no")}</p>;
      if (f.type === "select" && str) return <p className="text-sm">{t(`${f.optionsNamespace}.${str}` as "addresses.occurrence")}</p>;
      return <p className="text-sm whitespace-pre-line">{str || "—"}</p>;
    }
    switch (f.type) {
      case "textarea":
        return <Textarea id={id} value={str} rows={compact ? 2 : 3} onChange={(e) => onChange(e.target.value)} />;
      case "checkbox":
        return <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-primary" />;
      case "select":
        return (
          <select id={id} value={str} onChange={(e) => onChange(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
            <option value="">—</option>
            {f.options?.map((o) => <option key={o} value={o}>{t(`${f.optionsNamespace}.${o}` as "addresses.occurrence")}</option>)}
          </select>
        );
      default:
        return <Input id={id} type={f.type === "date" ? "date" : "text"} value={str} onChange={(e) => onChange(e.target.value)} />;
    }
  }

  return (
    <div className="space-y-5">
      {fields.map((f) => {
        const label = (
          <Label htmlFor={`${discipline}-${f.key}`}>
            {t(`fields.${f.key}` as "fields.what")}
            {f.required && editable && <span className="text-destructive"> *</span>}
          </Label>
        );
        if (f.type === "list") {
          const rows = (Array.isArray(content[f.key]) ? content[f.key] : []) as Row[];
          const view = editable && rows.length === 0 ? [{}] : rows;
          return (
            <div key={f.key} className="space-y-2">
              {label}
              {!editable && rows.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              {view.length > 0 && (
                <div className="space-y-2">
                  {view.map((row, i) => (
                    <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))_auto] sm:items-end">
                      {f.columns.map((c) => (
                        <div key={c.key} className="space-y-1">
                          <span className="text-xs text-muted-foreground">{t(`fields.${c.key}` as "fields.what")}</span>
                          {scalar(c, row[c.key], (v) => {
                            const next = [...view];
                            next[i] = { ...next[i], [c.key]: String(v ?? "") };
                            set(f.key, next);
                          }, `${discipline}-${f.key}-${i}-${c.key}`, true)}
                        </div>
                      ))}
                      {editable && (
                        <Button type="button" variant="ghost" size="icon" aria-label={t("removeRow")}
                          onClick={() => set(f.key, view.filter((_, j) => j !== i))}><Trash2Icon /></Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {editable && (
                <Button type="button" variant="outline" size="sm" onClick={() => set(f.key, [...view, {}])}>
                  <PlusIcon />{t("addRow")}
                </Button>
              )}
            </div>
          );
        }
        if (f.type === "checkbox") {
          return (
            <div key={f.key} className="flex items-center gap-2">
              {scalar(f, content[f.key], (v) => set(f.key, v), `${discipline}-${f.key}`)}
              {label}
            </div>
          );
        }
        return (
          <div key={f.key} className="space-y-2">
            {label}
            {scalar(f, content[f.key], (v) => set(f.key, v), `${discipline}-${f.key}`)}
          </div>
        );
      })}

      {discipline === "D7" && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{t("d7Hint")}</p>}

      {editable && (
        <>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {tr(error.key as never, { fields: error.fields ?? "" } as never)}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => save(false)}>{t("saveDraft")}</Button>
            <Button type="button" disabled={pending} onClick={() => save(true)}><SendIcon />{t("submit")}</Button>
          </div>
        </>
      )}
    </div>
  );
}
