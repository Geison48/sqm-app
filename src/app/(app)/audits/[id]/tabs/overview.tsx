import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { RecordDialog } from "@/components/shared/record-dialog";
import { ToneBadge } from "@/components/shared/badges";
import { ClassificationBadge } from "@/components/audit/audit-badges";
import { createClient } from "@/lib/supabase/server";
import { getInternalUsers, getLookup, getSupplierStatuses, lookupLabel } from "@/lib/lookups";
import { resolveSuggestion, type ScoreResult } from "@/lib/actions/audits";
import type { AuditRow } from "./types";

export async function OverviewTab({ audit, internal }: { audit: AuditRow; internal: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const [scopes, users, statuses, { data: liveScore }, { data: canManage }] = await Promise.all([
    getLookup("audit_scopes", true),
    internal ? getInternalUsers() : Promise.resolve([] as { id: string; full_name: string }[]),
    getSupplierStatuses(true),
    audit.status === "in_progress" ? supabase.rpc("audit_score", { p_audit_id: audit.id }) : Promise.resolve({ data: null }),
    supabase.rpc("can_manage_supplier", { p_supplier_id: audit.supplier_id }),
  ]);
  const score = (liveScore ?? null) as ScoreResult | null;
  const userName = new Map(users.map((u) => [u.id, u.full_name]));
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "short" }) : "—");
  const reportIssued = ["completed", "closed"].includes(audit.status);
  const elements = (reportIssued ? audit.element_scores : score?.elements ?? {}) as Record<string, number>;
  const reasons = reportIssued ? audit.downgrade_reasons : score?.reasons ?? [];
  const reasonLabel = (r: string) => {
    const [key, el] = r.split(":");
    return t(`audits.reasonLabels.${key as "star4_to_b"}`, { el: el ?? "" } as never);
  };
  const suggestionStatus = statuses.find((s) => s.code === audit.status_suggestion);

  const details: [string, React.ReactNode][] = [
    [t("audits.scopes"), audit.scope_codes.length ? audit.scope_codes.map((c) => lookupLabel(scopes.find((s) => s.code === c), locale)).join(", ") : "—"],
    [t("audits.actualDates"), audit.actual_start ? `${date(audit.actual_start)} – ${date(audit.actual_end)}` : "—"],
  ];
  if (internal) {
    details.push(
      [t("audits.leadAuditor"), audit.lead_auditor_id ? userName.get(audit.lead_auditor_id) ?? "—" : "—"],
      [t("audits.auditors"), audit.auditor_ids.map((a) => userName.get(a)).filter(Boolean).join(", ") || "—"],
    );
  }

  return (
    <div className="space-y-6">
      {audit.status_suggestion && internal && (
        <section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <h2 className="font-medium">{t("audits.suggestion")}</h2>
          <p className="text-sm">{t("audits.suggestionText", { classification: audit.classification ?? "", status: lookupLabel(suggestionStatus, locale) })}</p>
          {audit.status_suggestion_resolution ? (
            <ToneBadge tone="neutral">{t(`audits.suggestionResolution.${audit.status_suggestion_resolution as "applied"}`)}</ToneBadge>
          ) : canManage ? (
            <div className="flex flex-wrap gap-2">
              <RecordDialog trigger={<Button size="sm">{t("audits.apply")}</Button>} title={t("audits.apply")}
                hidden={{ id: audit.id, decision: "apply" }} action={resolveSuggestion}
                fields={[{ name: "justification", label: t("audits.justification"), type: "textarea", required: true,
                  defaultValue: `${audit.number}: ${t("audits.classification")} ${audit.classification} (${audit.score_percent}%)` }]} />
              <RecordDialog trigger={<Button size="sm" variant="outline">{t("audits.dismiss")}</Button>} title={t("audits.dismiss")}
                hidden={{ id: audit.id, decision: "dismiss" }} action={resolveSuggestion} fields={[]} submitLabel={t("audits.dismiss")} />
            </div>
          ) : null}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 rounded-lg border p-4 lg:col-span-1">
          <h2 className="text-xs font-medium text-muted-foreground uppercase">{reportIssued ? t("audits.score") : t("execute.live")}</h2>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold tabular-nums">
              {(reportIssued ? audit.score_percent : score?.percent) ?? "—"}{(reportIssued ? audit.score_percent : score?.percent) != null && "%"}
            </span>
            <ClassificationBadge value={reportIssued ? audit.classification : score?.classification ?? null} />
          </div>
          {score && <p className="text-sm text-muted-foreground">{t("audits.answered", { answered: score.answered, items: score.items })}</p>}
          {audit.status === "scheduled" && <p className="text-sm text-muted-foreground">{t("audits.notStartedHint")}</p>}
          {!internal && !reportIssued && <p className="text-sm text-muted-foreground">{t("audits.noAnswersVisible")}</p>}
          {reasons.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">{t("audits.reasons")}</h3>
              <ul className="list-disc pl-4 text-sm">{reasons.map((r) => <li key={r}>{reasonLabel(r)}</li>)}</ul>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-lg border p-4 lg:col-span-2">
          <h2 className="text-xs font-medium text-muted-foreground uppercase">{t("audits.elements")}</h2>
          {Object.keys(elements).length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <ul className="space-y-2">
              {Object.entries(elements).map(([el, pct]) => (
                <li key={el} className="grid grid-cols-[3rem_1fr_3.5rem] items-center gap-2 text-sm">
                  <span className="font-mono font-medium">{el}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className={`block h-full rounded-full ${pct >= 90 ? "bg-emerald-500" : pct >= 80 ? "bg-amber-400" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, pct)}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <dl className="grid gap-x-8 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
        {details.map(([k, v]) => (
          <div key={k} className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase">{k}</dt>
            <dd className="text-sm">{v}</dd>
          </div>
        ))}
        {audit.summary && (
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("audits.summary")}</dt>
            <dd className="text-sm whitespace-pre-line">{audit.summary}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
