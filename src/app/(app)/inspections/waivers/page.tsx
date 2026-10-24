import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { ToneBadge } from "@/components/shared/badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestWaiver, reviewWaiver } from "@/lib/actions/inspections";
import { WaiverRequestFields } from "./request-fields";

const TONE: Record<string, string> = { requested: "warning", approved: "success", rejected: "danger", expired: "neutral" };

export default async function WaiversPage() {
  const profile = await requireProfile();
  const internal = profile.role !== "supplier";
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data }, { data: links }, { data: chars }, { data: units }] = await Promise.all([
    supabase.from("waivers").select("*, suppliers(legal_name, responsible_sqe_id), components(gw_code, description)")
      .is("cancelled_at", null).order("created_at", { ascending: false }),
    supabase.from("supplier_components").select("supplier_id, suppliers(legal_name, responsible_sqe_id), components(id, gw_code, description)").is("cancelled_at", null),
    supabase.from("inspection_characteristics").select("id, name_pt, name_en, inspection_plans!inner(component_id, active)")
      .eq("inspection_plans.active", true).is("cancelled_at", null).order("sort_order"),
    supabase.from("serial_units").select("id, identifier, supplier_id, component_id").eq("scrapped", false).is("cancelled_at", null).order("identifier"),
  ]);
  const rows = data ?? [];
  const charName = new Map((chars ?? []).map((c) => [c.id, locale === "en" ? c.name_en : c.name_pt]));
  const unitName = new Map((units ?? []).map((u) => [u.id, u.identifier]));
  const pairs = (links ?? []).filter((l) => l.components && l.suppliers && (
    profile.role === "sqm" || (profile.role === "sqe" && l.suppliers.responsible_sqe_id === profile.id) || l.supplier_id === profile.supplierId))
    .map((l) => ({ value: `${l.supplier_id}|${l.components!.id}`,
      label: `${internal ? `${l.suppliers!.legal_name} · ` : ""}${l.components!.gw_code} — ${l.components!.description}` }));
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "short" }) : "—");

  return (
    <>
      <PageHeader title={t("waivers.title")} description={t("waivers.rule10")} actions={
        <WaiverRequestFields
          pairs={pairs}
          characteristics={(chars ?? []).map((c) => ({ id: c.id, componentId: c.inspection_plans.component_id, label: locale === "en" ? c.name_en : c.name_pt }))}
          units={(units ?? []).map((u) => ({ id: u.id, pair: `${u.supplier_id}|${u.component_id}`, label: u.identifier }))}
          action={requestWaiver}
          trigger={<Button><PlusIcon />{t("waivers.request")}</Button>}
        />
      } />
      {rows.length === 0 ? <EmptyState>{t("waivers.empty")}</EmptyState> : (
        <ul className="space-y-3">
          {rows.map((w) => {
            const canDecide = internal && w.status === "requested"
              && (profile.role === "sqm" || w.suppliers?.responsible_sqe_id === profile.id);
            return (
              <li key={w.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium"><span className="font-mono text-sm">{w.number}</span> · {w.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {internal && <>{w.suppliers?.legal_name} · </>}<span className="font-mono">{w.components?.gw_code}</span> {w.components?.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToneBadge tone={TONE[w.status]!}>{t(`waivers.statuses.${w.status as "approved"}`)}</ToneBadge>
                    {canDecide && (
                      <RecordDialog trigger={<Button size="sm">{t("waivers.review")}</Button>} title={`${t("waivers.review")} — ${w.number}`}
                        hidden={{ id: w.id }} action={reviewWaiver} fields={[
                          { name: "decision", label: t("waivers.decision"), type: "select", required: true, defaultValue: "approve",
                            options: [{ value: "approve", label: t("waivers.approve") }, { value: "reject", label: t("waivers.reject") }] },
                          { name: "comment", label: t("waivers.comment"), type: "textarea", hint: t("eightD.rejectHint") },
                        ]} />
                    )}
                    {w.status === "requested" && <CancelRecordButton table="waivers" id={w.id} path="/inspections/waivers" />}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-line">{w.justification}</p>
                <dl className="grid gap-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground uppercase">{t("waivers.validUntil")}</dt><dd>{date(w.valid_until)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground uppercase">{t("waivers.used")}</dt>
                    <dd>{Number(w.used_quantity)}{w.max_quantity != null && ` / ${Number(w.max_quantity)}`}</dd></div>
                  <div><dt className="text-xs text-muted-foreground uppercase">{t("waivers.characteristics")}</dt>
                    <dd>{w.characteristic_ids.length ? w.characteristic_ids.map((c: string) => charName.get(c) ?? "—").join(", ") : t("common.all")}</dd></div>
                  <div><dt className="text-xs text-muted-foreground uppercase">{t("waivers.units")}</dt>
                    <dd className="font-mono text-xs">{w.serial_unit_ids.length ? w.serial_unit_ids.map((u: string) => unitName.get(u) ?? "—").join(", ") : t("common.all")}</dd></div>
                </dl>
                {w.decision_comment && <p className="text-sm"><span className="font-medium">{t("waivers.comment")}:</span> {w.decision_comment}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
