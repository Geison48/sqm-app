"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { offlineDb, type AuditItemData, type AuditMeta, type AuditValues, type Item, type Pack } from "@/lib/offline/db";
import { recordChange } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";
import { OfflinePhotos } from "./photos";

const SCORES = [0, 4, 6, 8, 10] as const;
const RESULTS = ["conform", "observation", "minor_nc", "major_nc", "not_applicable"] as const;
const RESULT_STYLE: Record<string, string> = {
  conform: "data-[on=true]:bg-emerald-600", observation: "data-[on=true]:bg-sky-600", minor_nc: "data-[on=true]:bg-amber-500",
  major_nc: "data-[on=true]:bg-red-600", not_applicable: "data-[on=true]:bg-neutral-500",
};
const scoreStyle = (s: number) => (s >= 8 ? "data-[on=true]:bg-emerald-600" : s >= 6 ? "data-[on=true]:bg-amber-500" : "data-[on=true]:bg-red-600");
const answered = (v: AuditValues) => v.score != null || v.not_applicable || v.result != null;

// Checklist de auditoria sem sinal: mesmo fluxo item a item da tela online,
// gravando no aparelho; a fila envia ao voltar a conexão.
export function OfflineAudit({ pack }: { pack: Pack }) {
  const t = useTranslations();
  const locale = useLocale();
  const method = (pack.meta as AuditMeta).method;
  const items = useLiveQuery(() => offlineDb().items.where("pack").equals(pack.key).sortBy("order"), [pack.key], [] as Item[]);
  const changes = useLiveQuery(() => offlineDb().changes.where("pack").equals(pack.key).toArray(), [pack.key], []);
  const [index, setIndex] = useState(0);
  const pendingKeys = useMemo(() => new Map(changes.map((c) => [c.key, c])), [changes]);
  if (!items.length) return null;

  const current = items[Math.min(index, items.length - 1)]!;
  const data = current.data as AuditItemData;
  const values = current.values as AuditValues;
  const done = items.filter((i) => answered(i.values as AuditValues)).length;
  const elements = [...new Set(items.map((i) => (i.data as AuditItemData).element_code))];
  const change = pendingKeys.get(current.key);

  const patch = (p: Partial<AuditValues>) => recordChange(offlineDb(), current.key, p, { ...values, ...p });

  return (
    <div className="space-y-4 pb-24">
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-medium">{pack.number} · {pack.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{t("offline.items", { done, total: items.length })}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {elements.map((el) => {
            const first = items.findIndex((i) => (i.data as AuditItemData).element_code === el);
            return (
              <button key={el} type="button" onClick={() => setIndex(first)}
                className={cn("shrink-0 rounded-md border px-2 py-1 font-mono text-xs", data.element_code === el && "border-primary bg-muted")}>{el}</button>
            );
          })}
        </div>
      </div>

      <article className="space-y-5 rounded-lg border p-4">
        <header className="space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {t("execute.item", { n: index + 1, total: items.length })} · <span className="font-mono">{data.element_code}</span>
            {locale === "en" ? data.element_title_en : data.element_title_pt}
            {change && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t("offline.itemPending")}</span>}
          </p>
          <h1 className="text-lg leading-snug font-medium">
            <span className="font-mono text-sm text-muted-foreground">{data.item_code}</span>{" "}
            {data.is_star && <span className="text-amber-600" title={t("audits.star")}>*</span>} {locale === "en" ? data.question_en : data.question_pt}
          </h1>
          {change?.error && <p className="text-sm text-red-600">{t("offline.notSent", { error: t(change.error as never) })}</p>}
        </header>

        {method === "vda63" ? (
          <div className="grid grid-cols-6 gap-2">
            {SCORES.map((s) => (
              <button key={s} type="button" data-on={!values.not_applicable && values.score === s} onClick={() => patch({ score: s, not_applicable: false })}
                className={cn("h-14 rounded-md border text-lg font-semibold tabular-nums data-[on=true]:border-transparent data-[on=true]:text-white", scoreStyle(s))}>{s}</button>
            ))}
            <button type="button" data-on={values.not_applicable} onClick={() => patch({ not_applicable: !values.not_applicable, score: null })}
              className="h-14 rounded-md border text-sm font-medium data-[on=true]:border-transparent data-[on=true]:bg-neutral-500 data-[on=true]:text-white">
              {t("audits.notApplicable")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RESULTS.map((r) => (
              <button key={r} type="button" data-on={values.result === r} onClick={() => patch({ result: r })}
                className={cn("min-h-14 rounded-md border px-2 text-sm font-medium data-[on=true]:border-transparent data-[on=true]:text-white", RESULT_STYLE[r])}>
                {t(`audits.results.${r}`)}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="off-comment">{t("execute.comment")}</Label>
          <Textarea id="off-comment" key={`c-${current.key}`} defaultValue={values.comment ?? ""} rows={3}
            onBlur={(e) => e.target.value !== (values.comment ?? "") && patch({ comment: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="off-evidence">{t("execute.evidence")}</Label>
          <Textarea id="off-evidence" key={`e-${current.key}`} defaultValue={values.evidence ?? ""} rows={2}
            onBlur={(e) => e.target.value !== (values.evidence ?? "") && patch({ evidence: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>{t("execute.photos")}</Label>
          <OfflinePhotos pack={pack.key} itemId={current.id} />
        </div>
      </article>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <Button variant="outline" size="lg" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeftIcon />{t("execute.previous")}</Button>
          <Button size="lg" disabled={index >= items.length - 1} onClick={() => setIndex(index + 1)}>{t("execute.next")}<ChevronRightIcon /></Button>
        </div>
      </nav>
    </div>
  );
}
