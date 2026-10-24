"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeftIcon, CameraIcon, ChevronLeftIcon, ChevronRightIcon, FlagIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RecordDialog } from "@/components/shared/record-dialog";
import { createClient } from "@/lib/supabase/client";
import { registerAttachment } from "@/lib/actions/attachments";
import { saveAnswer, saveFinding, type ScoreResult } from "@/lib/actions/audits";
import { cn } from "@/lib/utils";

type Answer = {
  id: string; element_code: string; element_title_pt: string | null; element_title_en: string | null; item_code: string;
  question_pt: string; question_en: string; is_star: boolean; score: number | null; result: string | null;
  not_applicable: boolean; comment: string | null; evidence: string | null;
};
type Audit = { id: string; number: string; supplierId: string; supplierName: string; method: "vda63" | "gwi" };

const SCORES = [0, 4, 6, 8, 10] as const;
const RESULTS = ["conform", "observation", "minor_nc", "major_nc", "not_applicable"] as const;
const RESULT_STYLE: Record<string, string> = {
  conform: "data-[on=true]:bg-emerald-600", observation: "data-[on=true]:bg-sky-600", minor_nc: "data-[on=true]:bg-amber-500",
  major_nc: "data-[on=true]:bg-red-600", not_applicable: "data-[on=true]:bg-neutral-500",
};
const scoreStyle = (s: number) => (s >= 8 ? "data-[on=true]:bg-emerald-600" : s >= 6 ? "data-[on=true]:bg-amber-500" : "data-[on=true]:bg-red-600");

const answered = (a: Answer) => a.score != null || a.not_applicable || a.result != null;

// Execução item a item, pensada para celular/tablet. Cada resposta é salva na hora.
export function Runner({ audit, answers: initial, initialScore, photos }: {
  audit: Audit; answers: Answer[]; initialScore: ScoreResult | null; photos: Record<string, { id: string; url: string; name: string }[]>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [answers, setAnswers] = useState(initial);
  const [index, setIndex] = useState(() => Math.max(0, initial.findIndex((a) => !answered(a))));
  const [score, setScore] = useState(initialScore);
  const [saving, startSave] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = answers[index]!;
  const total = answers.length;
  const done = answers.filter(answered).length;
  const elements = useMemo(() => [...new Set(answers.map((a) => a.element_code))], [answers]);

  function patch(values: Partial<Answer>) {
    const next = { ...current, ...values };
    setAnswers((list) => list.map((a) => (a.id === current.id ? next : a)));
    startSave(async () => {
      const r = await saveAnswer({
        id: current.id, auditId: audit.id,
        ...(values.score !== undefined ? { score: values.score as 0 } : {}),
        ...(values.result !== undefined ? { result: values.result as "conform" } : {}),
        ...(values.not_applicable !== undefined ? { not_applicable: values.not_applicable } : {}),
        ...(values.comment !== undefined ? { comment: values.comment } : {}),
        ...(values.evidence !== undefined ? { evidence: values.evidence } : {}),
      });
      if (r.error) toast.error(t(r.error as never));
      else if (r.score) setScore(r.score);
    });
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const path = `${audit.supplierId}/${crypto.randomUUID()}/${file.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type || undefined });
      if (error) { toast.error(t("errors.uploadFailed")); continue; }
      await registerAttachment({
        entityTable: "audit_answers", entityId: current.id, supplierId: audit.supplierId, storagePath: path, fileName: file.name,
        mimeType: file.type || null, sizeBytes: file.size, internalOnly: false, supersedesId: null, description: null,
        path: `/audits/${audit.id}/execute`,
      });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const question = locale === "en" ? current.question_en : current.question_pt;
  const elementTitle = locale === "en" ? current.element_title_en : current.element_title_pt;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild><Link href={`/audits/${audit.id}`}><ArrowLeftIcon />{t("execute.backToAudit")}</Link></Button>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {saving ? <><Loader2Icon className="size-3 animate-spin" />{t("execute.saving")}</> : t("execute.saved")}
        </span>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-medium">{audit.number} · {audit.supplierName}</span>
          <span className="shrink-0 tabular-nums">
            {t("execute.live")}: <strong>{score?.percent ?? "—"}{score?.percent != null && "%"}</strong> {score?.classification ?? ""}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{t("audits.answered", { answered: done, items: total })}</p>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {elements.map((el) => {
            const first = answers.findIndex((a) => a.element_code === el);
            const elDone = answers.filter((a) => a.element_code === el).every(answered);
            return (
              <button key={el} type="button" onClick={() => setIndex(first)}
                className={cn("shrink-0 rounded-md border px-2 py-1 font-mono text-xs",
                  current.element_code === el && "border-primary bg-muted", elDone && "text-emerald-700 dark:text-emerald-400")}>
                {el}
              </button>
            );
          })}
        </div>
      </div>

      <article className="space-y-5 rounded-lg border p-4">
        <header className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {t("execute.item", { n: index + 1, total })} · <span className="font-mono">{current.element_code}</span> {elementTitle}
          </p>
          <h1 className="text-lg leading-snug font-medium">
            <span className="font-mono text-sm text-muted-foreground">{current.item_code}</span>{" "}
            {current.is_star && <span className="text-amber-600" title={t("audits.star")}>*</span>} {question}
          </h1>
        </header>

        {audit.method === "vda63" ? (
          <div className="grid grid-cols-6 gap-2">
            {SCORES.map((s) => (
              <button key={s} type="button" data-on={!current.not_applicable && current.score === s}
                onClick={() => patch({ score: s, not_applicable: false })}
                className={cn("h-14 rounded-md border text-lg font-semibold tabular-nums transition-colors data-[on=true]:border-transparent data-[on=true]:text-white", scoreStyle(s))}>
                {s}
              </button>
            ))}
            <button type="button" data-on={current.not_applicable} onClick={() => patch({ not_applicable: !current.not_applicable, score: null })}
              className="h-14 rounded-md border text-sm font-medium data-[on=true]:border-transparent data-[on=true]:bg-neutral-500 data-[on=true]:text-white">
              {t("audits.notApplicable")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RESULTS.map((r) => (
              <button key={r} type="button" data-on={current.result === r} onClick={() => patch({ result: r })}
                className={cn("min-h-14 rounded-md border px-2 text-sm font-medium data-[on=true]:border-transparent data-[on=true]:text-white", RESULT_STYLE[r])}>
                {t(`audits.results.${r}`)}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="ans-comment">{t("execute.comment")}</Label>
          <Textarea id="ans-comment" key={`c-${current.id}`} defaultValue={current.comment ?? ""} rows={3}
            onBlur={(e) => e.target.value !== (current.comment ?? "") && patch({ comment: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ans-evidence">{t("execute.evidence")}</Label>
          <Textarea id="ans-evidence" key={`e-${current.id}`} defaultValue={current.evidence ?? ""} rows={2}
            onBlur={(e) => e.target.value !== (current.evidence ?? "") && patch({ evidence: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>{t("execute.photos")}</Label>
          <div className="flex flex-wrap gap-2">
            {(photos[current.id] ?? []).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.name} className="size-20 rounded-md border object-cover" /></a>
            ))}
            <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-center text-xs text-muted-foreground hover:bg-muted">
              {uploading ? <Loader2Icon className="size-5 animate-spin" /> : <CameraIcon className="size-5" />}
              {uploading ? t("execute.uploading") : t("execute.takePhoto")}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="sr-only"
                aria-label={t("execute.takePhoto")} onChange={(e) => uploadPhotos(e.target.files)} />
            </label>
          </div>
        </div>

        <RecordDialog
          trigger={<Button variant="outline" size="sm"><FlagIcon />{t("execute.addFinding")}</Button>}
          title={t("findings.add")}
          hidden={{ audit_id: audit.id, answer_id: current.id }}
          action={saveFinding}
          fields={[
            { name: "classification", label: t("findings.classification"), type: "select", required: true,
              options: (["major_nc", "minor_nc", "observation", "improvement"] as const).map((c) => ({ value: c, label: t(`findings.classifications.${c}`) })),
              defaultValue: current.result === "major_nc" ? "major_nc" : current.result === "observation" ? "observation" : "minor_nc",
              hint: t("findings.majorHint") },
            { name: "description", label: t("findings.description"), type: "textarea", required: true, defaultValue: current.comment },
            { name: "requirement", label: t("findings.requirement"), defaultValue: `${current.item_code}` },
          ]}
        />
      </article>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <Button variant="outline" size="lg" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            <ChevronLeftIcon />{t("execute.previous")}
          </Button>
          {index < total - 1 ? (
            <Button size="lg" onClick={() => setIndex(index + 1)}>{t("execute.next")}<ChevronRightIcon /></Button>
          ) : (
            <Button size="lg" asChild><Link href={`/audits/${audit.id}`}>{t("execute.finish")}</Link></Button>
          )}
        </div>
      </nav>
    </div>
  );
}
