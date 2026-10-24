import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { RecordDialog } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton } from "@/components/shared/icon-buttons";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { reviewSimpleNc, respondSimpleNc, saveNcItem, setDisposition } from "@/lib/actions/ncs";
import type { NcRow } from "./types";

export async function OverviewTab({ nc, canManage, isOwnSupplier }: { nc: NcRow; canManage: boolean; isOwnSupplier: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data: items }, origins, failureModes, dispositions] = await Promise.all([
    supabase.from("nc_items").select("*").eq("nc_id", nc.id).is("cancelled_at", null).order("created_at"),
    getLookup("nc_origins", true),
    getLookup("failure_modes", true),
    getLookup("dispositions", true),
  ]);
  const label = (list: { code: string; label_pt: string; label_en: string }[], code: string | null) =>
    code ? lookupLabel(list.find((i) => i.code === code), locale) : "—";
  const dt = (v: string | null) => (v ? format.dateTime(new Date(v), { dateStyle: "short", timeStyle: "short" }) : "—");
  const path = `/ncs/${nc.id}?tab=overview`;

  const details: [string, React.ReactNode][] = [
    [t("ncs.origin"), label(origins, nc.origin_code)],
    [t("ncs.failureMode"), label(failureModes, nc.failure_mode_code)],
    [t("ncs.detectedOn"), format.dateTime(new Date(`${nc.detected_on}T12:00:00`), { dateStyle: "short" })],
    [t("ncs.detectedLocation"), nc.detected_location ?? "—"],
    [t("ncs.quantityAffected"), nc.quantity_affected ?? "—"],
    [t("ncs.customerAffected"), nc.customer_affected ? t("common.yes") : t("common.no")],
    [t("ncs.openedAt"), dt(nc.opened_at)],
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-xs font-medium text-muted-foreground uppercase">{t("ncs.description")}</h2>
        <p className="text-sm whitespace-pre-line">{nc.description}</p>
      </section>

      <dl className="grid gap-x-8 gap-y-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
        {details.map(([k, v]) => (
          <div key={k} className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase">{k}</dt>
            <dd className="text-sm">{v}</dd>
          </div>
        ))}
        {nc.suggestion_reasons.length > 0 && (
          <div className="space-y-1 sm:col-span-2 lg:col-span-4">
            <dt className="text-xs font-medium text-muted-foreground uppercase">{t("ncs.suggest8d")}</dt>
            <dd className="text-sm">{nc.suggestion_reasons.map((r) => t(`ncs.suggestionReasons.${r as "severity"}`)).join("; ")}</dd>
          </div>
        )}
      </dl>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{t("ncs.items")}</h2>
          {canManage && (
            <RecordDialog trigger={<AddButton label={t("ncs.addItem")} />} title={t("ncs.addItem")} action={saveNcItem}
              hidden={{ nc_id: nc.id, supplier_id: nc.supplier_id }}
              fields={[
                { name: "sn_or_lot", label: t("ncs.snOrLot"), required: true, span: 1 },
                { name: "quantity", label: t("ncs.quantity"), type: "number", span: 1 },
                { name: "notes", label: t("ncs.notes") },
              ]} />
          )}
        </div>
        {(items ?? []).length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
          <ul className="divide-y rounded-lg border">
            {(items ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span><span className="font-mono">{i.sn_or_lot}</span>{i.quantity != null && <> · {i.quantity}</>}{i.notes && <span className="text-muted-foreground"> · {i.notes}</span>}</span>
                {canManage && <CancelRecordButton table="nc_items" id={i.id} path={path} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {nc.type === "simple" && (
        <section className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <h2 className="font-medium">{t("ncs.disposition")}</h2>
              <p className="text-sm">{label(dispositions, nc.disposition_code)}</p>
              {nc.disposition_notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{nc.disposition_notes}</p>}
            </div>
            {canManage && (
              <RecordDialog trigger={<Button variant="outline" size="sm">{t("ncs.setDisposition")}</Button>} title={t("ncs.setDisposition")}
                hidden={{ id: nc.id }} action={setDisposition}
                fields={[
                  { name: "disposition_code", label: t("ncs.disposition"), type: "select",
                    options: dispositions.filter((d) => !d.cancelled_at).map((d) => ({ value: d.code, label: lookupLabel(d, locale) })),
                    defaultValue: nc.disposition_code },
                  { name: "disposition_notes", label: t("ncs.dispositionNotes"), type: "textarea", defaultValue: nc.disposition_notes },
                ]} />
            )}
          </div>

          <div className="space-y-1 border-t pt-4">
            <h2 className="font-medium">{t("ncs.supplierAction")}</h2>
            {nc.supplier_action ? (
              <>
                <p className="text-sm whitespace-pre-line">{nc.supplier_action}</p>
                <p className="text-xs text-muted-foreground">{t("ncs.respondedAt")}: {dt(nc.supplier_responded_at)}</p>
              </>
            ) : <p className="text-sm text-muted-foreground">{t("ncs.waitingSupplier")}</p>}
            {nc.status === "open" && nc.response_due_at && (
              <p className="text-xs text-muted-foreground">{t("ncs.responseDue")}: {dt(nc.response_due_at)}</p>
            )}
            {nc.sqe_review_comment && (
              <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                <span className="font-medium">{t("ncs.sqeComment")}:</span> {nc.sqe_review_comment}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {isOwnSupplier && nc.status === "open" && !nc.cancelled_at && (
              <RecordDialog trigger={<Button>{t("ncs.respond")}</Button>} title={t("ncs.respondTitle")} hidden={{ id: nc.id }}
                action={respondSimpleNc}
                fields={[{ name: "supplier_action", label: t("ncs.supplierAction"), type: "textarea", required: true, defaultValue: nc.supplier_action }]} />
            )}
            {canManage && nc.status === "awaiting_sqe" && (
              <RecordDialog trigger={<Button>{t("ncs.review")}</Button>} title={t("ncs.review")} hidden={{ id: nc.id }}
                action={reviewSimpleNc}
                fields={[
                  { name: "decision", label: t("ncs.review"), type: "select", required: true,
                    options: [{ value: "accept", label: t("ncs.accept") }, { value: "return", label: t("ncs.return") }] },
                  { name: "comment", label: t("ncs.reviewComment"), type: "textarea", hint: t("eightD.rejectHint") },
                ]} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
