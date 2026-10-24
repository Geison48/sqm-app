import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/badges";
import { createClient } from "@/lib/supabase/server";
import type { AuditRow } from "./types";

const RESULT_TONE: Record<string, string> = { conform: "success", observation: "info", minor_nc: "warning", major_nc: "danger", not_applicable: "neutral" };
const scoreTone = (s: number) => (s >= 8 ? "success" : s >= 6 ? "warning" : "danger");

// Visão de leitura do checklist (a execução fica em /execute).
export async function ChecklistTab({ audit, internal }: { audit: AuditRow; internal: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.from("audit_answers").select("*").eq("audit_id", audit.id).is("cancelled_at", null).order("sort_order");
  const answers = data ?? [];
  if (answers.length === 0) {
    return <EmptyState>{internal ? t("audits.notStartedHint") : t("audits.noAnswersVisible")}</EmptyState>;
  }
  const groups = new Map<string, typeof answers>();
  for (const a of answers) groups.set(a.element_code, [...(groups.get(a.element_code) ?? []), a]);

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([el, items]) => (
        <section key={el} className="space-y-2">
          <h2 className="font-medium">
            <span className="font-mono">{el}</span> {locale === "en" ? items[0]!.element_title_en : items[0]!.element_title_pt}
          </h2>
          <ul className="divide-y rounded-lg border">
            {items.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{a.item_code}</span>{" "}
                    {a.is_star && <span className="font-semibold text-amber-600">*</span>} {locale === "en" ? a.question_en : a.question_pt}
                  </p>
                  {a.comment && <p className="text-xs text-muted-foreground">{a.comment}</p>}
                </div>
                <div className="shrink-0">
                  {a.not_applicable ? <ToneBadge tone="neutral">{t("audits.notApplicable")}</ToneBadge>
                    : a.score != null ? <ToneBadge tone={scoreTone(a.score)} className="tabular-nums">{a.score}</ToneBadge>
                    : a.result ? <ToneBadge tone={RESULT_TONE[a.result]!}>{t(`audits.results.${a.result as "conform"}`)}</ToneBadge>
                    : <span className="text-xs text-muted-foreground">{t("execute.unanswered")}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
