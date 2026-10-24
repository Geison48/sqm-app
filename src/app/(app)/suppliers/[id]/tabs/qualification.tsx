import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RecordDialog } from "@/components/shared/record-dialog";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/badges";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { createClient } from "@/lib/supabase/server";
import { getQualificationStepTypes, lookupLabel } from "@/lib/lookups";
import { saveQualification, saveQualificationStep } from "@/lib/actions/suppliers";

const STATUS_TONE: Record<string, string> = {
  in_progress: "info", approved: "success", approved_conditional: "warning", rejected: "danger",
  pending: "neutral", not_applicable: "neutral",
};
const STATUSES = ["in_progress", "approved", "approved_conditional", "rejected"] as const;
const RESULTS = ["pending", "approved", "approved_conditional", "rejected", "not_applicable"] as const;

export async function QualificationTab({ supplierId, canManage }: { supplierId: string; canManage: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const { data: qualification } = await supabase.from("qualifications").select("*").eq("supplier_id", supplierId)
    .is("cancelled_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const path = `/suppliers/${supplierId}?tab=qualification`;
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "short" }) : "—");

  const startButton = canManage && (
    <RecordDialog
      trigger={<AddButton label={qualification ? t("qualification.newQualification") : t("qualification.start")} />}
      title={t("qualification.start")}
      hidden={{ supplier_id: supplierId }}
      action={saveQualification}
      fields={[{ name: "purchasing_contact", label: t("qualification.purchasingContact") }]}
    />
  );

  if (!qualification) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("qualification.description")}</p>
        {startButton}
        <EmptyState>{t("qualification.none")}</EmptyState>
      </div>
    );
  }

  const [{ data: steps }, stepTypes] = await Promise.all([
    supabase.from("qualification_steps").select("*").eq("qualification_id", qualification.id).is("cancelled_at", null),
    getQualificationStepTypes(true),
  ]);
  const typeByCode = new Map(stepTypes.map((s) => [s.code, s]));
  const sortedSteps = (steps ?? []).sort(
    (a, b) => (typeByCode.get(a.step_code)?.sort_order ?? 0) - (typeByCode.get(b.step_code)?.sort_order ?? 0),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h2 className="font-medium">{t("qualification.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("qualification.description")}</p>
          </div>
          <div className="flex gap-2">
            {canManage && (
              <RecordDialog
                trigger={<Button size="sm">{t("qualification.conclude")}</Button>}
                title={t("qualification.conclude")}
                hidden={{ id: qualification.id, supplier_id: supplierId }}
                action={saveQualification}
                fields={[
                  { name: "status", label: t("qualification.status"), type: "select", required: true, span: 1,
                    options: STATUSES.map((s) => ({ value: s, label: t(`qualification.statuses.${s}`) })),
                    defaultValue: qualification.status },
                  { name: "concluded_on", label: t("qualification.concludedOn"), type: "date", span: 1,
                    defaultValue: qualification.concluded_on },
                  { name: "purchasing_contact", label: t("qualification.purchasingContact"),
                    defaultValue: qualification.purchasing_contact },
                  { name: "final_opinion", label: t("qualification.finalOpinion"), type: "textarea",
                    defaultValue: qualification.final_opinion },
                ]}
              />
            )}
            {qualification.status !== "in_progress" && startButton}
          </div>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground uppercase">{t("qualification.status")}</dt>
            <dd><ToneBadge tone={STATUS_TONE[qualification.status]!}>{t(`qualification.statuses.${qualification.status as "approved"}`)}</ToneBadge></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">{t("qualification.purchasingContact")}</dt>
            <dd>{qualification.purchasing_contact ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">{t("qualification.concludedOn")}</dt>
            <dd>{date(qualification.concluded_on)}</dd>
          </div>
          {qualification.final_opinion && (
            <div className="sm:col-span-3">
              <dt className="text-xs text-muted-foreground uppercase">{t("qualification.finalOpinion")}</dt>
              <dd className="whitespace-pre-line">{qualification.final_opinion}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">{t("qualification.steps")}</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("qualification.step")}</TableHead>
                <TableHead>{t("qualification.result")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("qualification.performedOn")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("qualification.score")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("qualification.comments")}</TableHead>
                {canManage && <TableHead className="w-0" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSteps.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{lookupLabel(typeByCode.get(s.step_code), locale)}</TableCell>
                  <TableCell>
                    <ToneBadge tone={STATUS_TONE[s.result] ?? "neutral"}>{t(`qualification.results.${s.result as "approved"}`)}</ToneBadge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{date(s.performed_on)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{s.score ?? "—"}</TableCell>
                  <TableCell className="hidden max-w-72 whitespace-normal md:table-cell">{s.comments ?? "—"}</TableCell>
                  {canManage && (
                    <TableCell>
                      <RecordDialog
                        trigger={<EditButton label={t("qualification.editStep")} />}
                        title={lookupLabel(typeByCode.get(s.step_code), locale)}
                        hidden={{ id: s.id, supplier_id: supplierId }}
                        action={saveQualificationStep}
                        fields={[
                          { name: "result", label: t("qualification.result"), type: "select", required: true, span: 1,
                            options: RESULTS.map((r) => ({ value: r, label: t(`qualification.results.${r}`) })),
                            defaultValue: s.result },
                          { name: "performed_on", label: t("qualification.performedOn"), type: "date", span: 1,
                            defaultValue: s.performed_on },
                          { name: "score", label: t("qualification.score"), type: "number", step: "0.01", span: 1,
                            defaultValue: s.score },
                          { name: "comments", label: t("qualification.comments"), type: "textarea", defaultValue: s.comments },
                        ]}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">{t("qualification.files")}</h3>
        <AttachmentsPanel
          target={{ entityTable: "qualifications", entityId: qualification.id, supplierId, path }}
          canUpload={canManage}
          canManage={canManage}
          allowInternal={false}
          forceInternal
        />
      </div>
    </div>
  );
}
