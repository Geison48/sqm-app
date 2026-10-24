import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/badges";
import { createClient } from "@/lib/supabase/server";
import { respondFinding, reviewFinding, saveFinding, verifyFinding } from "@/lib/actions/audits";
import type { Database } from "@/lib/database.types";
import type { AuditRow } from "./types";

type Finding = Database["public"]["Tables"]["findings"]["Row"];
const CLASS_TONE: Record<string, string> = { major_nc: "danger", minor_nc: "warning", observation: "info", improvement: "neutral" };
const STATUS_TONE: Record<string, string> = { open: "warning", responded: "info", action_accepted: "info", closed: "success" };
const CLASSES = ["major_nc", "minor_nc", "observation", "improvement"] as const;

// Regra 4 (NC maior → 8D) e regra 11 (fecha só com eficácia verificada).
export async function FindingsTab({ audit, canExecute, isOwnSupplier }: { audit: AuditRow; canExecute: boolean; isOwnSupplier: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data }, { data: answers }] = await Promise.all([
    supabase.from("findings").select("*, ncs!findings_nc_id_fkey(id, number, status)").eq("audit_id", audit.id).is("cancelled_at", null).order("created_at"),
    canExecute ? supabase.from("audit_answers").select("id, item_code, question_pt, question_en").eq("audit_id", audit.id).order("sort_order")
      : Promise.resolve({ data: [] as { id: string; item_code: string; question_pt: string; question_en: string }[] }),
  ]);
  const findings = data ?? [];
  const path = `/audits/${audit.id}?tab=findings`;
  const canAdd = canExecute && ["in_progress", "completed"].includes(audit.status);
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "short" }) : "—");

  const fields = (f?: Finding): FieldDef[] => [
    { name: "classification", label: t("findings.classification"), type: "select", required: true, span: 1,
      options: CLASSES.map((c) => ({ value: c, label: t(`findings.classifications.${c}`) })), defaultValue: f?.classification ?? "minor_nc",
      hint: t("findings.majorHint") },
    { name: "answer_id", label: t("findings.question"), type: "select", span: 1,
      options: (answers ?? []).map((a) => ({ value: a.id, label: `${a.item_code} — ${(locale === "en" ? a.question_en : a.question_pt).slice(0, 60)}` })),
      defaultValue: f?.answer_id },
    { name: "description", label: t("findings.description"), type: "textarea", required: true, defaultValue: f?.description },
    { name: "requirement", label: t("findings.requirement"), defaultValue: f?.requirement },
  ];

  return (
    <div className="space-y-3">
      {canAdd && (
        <div className="flex justify-end">
          <RecordDialog trigger={<AddButton label={t("findings.add")} />} title={t("findings.add")} hidden={{ audit_id: audit.id }}
            action={saveFinding} fields={fields()} />
        </div>
      )}
      {findings.length === 0 ? <EmptyState>{t("findings.empty")}</EmptyState> : (
        <ul className="space-y-3">
          {findings.map((f) => {
            const nc = f.ncs as { id: string; number: string; status: string } | null;
            return (
              <li key={f.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ToneBadge tone={CLASS_TONE[f.classification]!}>{t(`findings.classifications.${f.classification as "major_nc"}`)}</ToneBadge>
                    <ToneBadge tone={STATUS_TONE[f.status]!}>{t(`findings.statuses.${f.status as "open"}`)}</ToneBadge>
                    {f.status === "open" && f.classification !== "major_nc" && (
                      <span className="text-xs text-muted-foreground">{t("findings.responseDue")}: {date(f.response_due)}</span>
                    )}
                  </div>
                  {canExecute && f.status !== "closed" && (
                    <div className="flex flex-wrap">
                      <RecordDialog trigger={<EditButton label={t("findings.edit")} />} title={t("findings.edit")}
                        hidden={{ id: f.id, audit_id: audit.id }} action={saveFinding} fields={fields(f)} />
                      <CancelRecordButton table="findings" id={f.id} path={path} />
                    </div>
                  )}
                </div>
                <p className="text-sm whitespace-pre-line">{f.description}</p>
                {f.requirement && <p className="text-xs text-muted-foreground">{t("findings.requirement")}: {f.requirement}</p>}
                {nc && (
                  <p className="text-sm">
                    {t("findings.linkedNc")}: <Link href={`/ncs/${nc.id}`} className="font-mono underline">{nc.number}</Link>{" "}
                    <span className="text-muted-foreground">({t(`ncs.statuses.${nc.status as "open"}`)})</span>
                  </p>
                )}
                {f.action_plan && (
                  <div className="rounded-md bg-muted/60 p-3 text-sm">
                    <p className="font-medium">{t("findings.actionPlan")}</p>
                    <p className="whitespace-pre-line">{f.action_plan}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("findings.responsible")}: {f.action_responsible} · {t("findings.dueDate")}: {date(f.action_due_date)}
                    </p>
                  </div>
                )}
                {f.sqe_comment && <p className="text-sm"><span className="font-medium">{t("findings.sqeComment")}:</span> {f.sqe_comment}</p>}
                {f.effectiveness_comment && <p className="text-sm"><span className="font-medium">{t("findings.effectiveness")}:</span> {f.effectiveness_comment}</p>}

                <div className="flex flex-wrap justify-end gap-2">
                  {isOwnSupplier && f.status === "open" && f.classification !== "major_nc" && (
                    <RecordDialog trigger={<Button size="sm">{t("findings.respond")}</Button>} title={t("findings.respond")}
                      description={f.description} hidden={{ id: f.id, audit_id: audit.id }} action={respondFinding} fields={[
                        { name: "action_plan", label: t("findings.actionPlan"), type: "textarea", required: true, defaultValue: f.action_plan },
                        { name: "action_responsible", label: t("findings.responsible"), required: true, span: 1, defaultValue: f.action_responsible },
                        { name: "action_due_date", label: t("findings.dueDate"), type: "date", required: true, span: 1, defaultValue: f.action_due_date },
                      ]} />
                  )}
                  {canExecute && f.status === "responded" && (
                    <RecordDialog trigger={<Button size="sm">{t("findings.review")}</Button>} title={t("findings.review")}
                      hidden={{ id: f.id, audit_id: audit.id }} action={reviewFinding} fields={[
                        { name: "decision", label: t("findings.decision"), type: "select", required: true, defaultValue: "accept",
                          options: [{ value: "accept", label: t("findings.accept") }, { value: "return", label: t("findings.return") }] },
                        { name: "comment", label: t("findings.comment"), type: "textarea", hint: t("eightD.rejectHint") },
                      ]} />
                  )}
                  {canExecute && (f.status === "action_accepted" || (f.classification === "major_nc" && f.status !== "closed")) && (
                    <RecordDialog trigger={<Button size="sm" variant="outline">{t("findings.verify")}</Button>} title={t("findings.verify")}
                      hidden={{ id: f.id, audit_id: audit.id }} action={verifyFinding}
                      fields={[{ name: "comment", label: t("findings.verifyComment"), type: "textarea", required: true }]} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
