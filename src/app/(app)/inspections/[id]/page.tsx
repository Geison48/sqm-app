import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/badges";
import { UnitTag } from "@/components/shared/unit-tag";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { RecordDialog } from "@/components/shared/record-dialog";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { applyWaiver } from "@/lib/actions/inspections";
import { AddUnit } from "./add-unit";
import { ResultRow } from "./result-row";
import { CompleteButton } from "./complete-button";

const RESULT_TONE: Record<string, string> = { approved: "success", rejected: "danger", partial: "warning" };

export default async function InspectionPage({ params }: PageProps<"/inspections/[id]">) {
  const profile = await requireProfile();
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const { data: insp } = await supabase.from("inspections")
    .select("*, suppliers(legal_name), components(id, gw_code, description), inspection_plans(revision)").eq("id", id).maybeSingle();
  if (!insp) notFound();

  const internal = profile.role !== "supplier";
  const [{ data: canEdit }, types, { data: chars }, { data: units }, { data: results }] = await Promise.all([
    supabase.rpc("can_edit_inspection", { p_inspection_id: id }),
    getLookup("inspection_types", true),
    supabase.from("inspection_characteristics").select("*").eq("plan_id", insp.plan_id).is("cancelled_at", null).order("sort_order"),
    supabase.from("inspection_units").select("id, result, serial_units(id, identifier, kind, quantity, tag, scrapped)")
      .eq("inspection_id", id).is("cancelled_at", null).order("created_at"),
    supabase.from("inspection_results").select("*, waivers(number)").eq("inspection_id", id).is("cancelled_at", null),
  ]);
  const editable = !!canEdit && insp.status === "in_progress" && !insp.cancelled_at;
  const isSelf = insp.type_code === "self_inspection";

  // Peças elegíveis (regra 9): verdes para o SQE; sem reparo aberto na autoinspeção.
  const inInspection = new Set((units ?? []).map((u) => u.serial_units?.id));
  let eligibleQuery = supabase.from("serial_units").select("id, identifier, tag").eq("supplier_id", insp.supplier_id)
    .eq("component_id", insp.component_id).eq("scrapped", false).is("cancelled_at", null).order("identifier");
  eligibleQuery = isSelf ? eligibleQuery.or("tag.is.null,tag.neq.yellow") : eligibleQuery.eq("tag", "green");
  const { data: eligible } = editable ? await eligibleQuery : { data: [] as { id: string; identifier: string; tag: string | null }[] };

  // Concessões aprovadas e válidas deste componente (para aceite de NOK).
  const today = new Date().toISOString().slice(0, 10);
  const { data: waivers } = internal && editable
    ? await supabase.from("waivers").select("id, number, characteristic_ids, serial_unit_ids, valid_until, max_quantity, used_quantity")
        .eq("supplier_id", insp.supplier_id).eq("component_id", insp.component_id).eq("status", "approved").is("cancelled_at", null)
    : { data: [] as never[] };
  const activeWaivers = (waivers ?? []).filter((w: { valid_until: string | null; max_quantity: number | null; used_quantity: number }) =>
    (!w.valid_until || w.valid_until >= today) && (w.max_quantity == null || Number(w.used_quantity) < Number(w.max_quantity)));

  // Fotos por resultado.
  const resultIds = (results ?? []).map((r) => r.id);
  const { data: files } = resultIds.length
    ? await supabase.from("attachments").select("entity_id, storage_path, file_name, mime_type").eq("entity_table", "inspection_results")
        .in("entity_id", resultIds).is("cancelled_at", null)
    : { data: [] as { entity_id: string; storage_path: string; file_name: string; mime_type: string | null }[] };
  const images = (files ?? []).filter((f) => f.mime_type?.startsWith("image/"));
  const { data: signed } = images.length
    ? await supabase.storage.from("attachments").createSignedUrls(images.map((f) => f.storage_path), 600)
    : { data: [] as { signedUrl: string }[] };
  const photos: Record<string, { url: string; name: string }[]> = {};
  images.forEach((f, i) => { if (signed?.[i]?.signedUrl) (photos[f.entity_id] ??= []).push({ url: signed[i]!.signedUrl, name: f.file_name }); });

  const charById = new Map((chars ?? []).map((c) => [c.id, c]));
  const name = (c: { name_pt: string; name_en: string }) => (locale === "en" ? c.name_en : c.name_pt);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<><span className="font-mono">{insp.number}</span> · {lookupLabel(types.find((x) => x.code === insp.type_code), locale)}</>}
        description={<>{insp.suppliers?.legal_name} · <span className="font-mono">{insp.components?.gw_code}</span> {insp.components?.description}
          {insp.inspection_plans && <> · {t("inspPlans.revision")} {insp.inspection_plans.revision}</>}</>}
        actions={editable ? (
          <>
            <CompleteButton inspectionId={id} />
            <CancelRecordButton table="inspections" id={id} path={`/inspections/${id}`} compact={false} />
          </>
        ) : undefined}
      >
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
          {insp.result ? <ToneBadge tone={RESULT_TONE[insp.result]!}>{t(`inspections.results.${insp.result as "approved"}`)}</ToneBadge>
            : <ToneBadge tone="info">{t(`inspections.statuses.${insp.status as "in_progress"}`)}</ToneBadge>}
          <span className="text-muted-foreground">{format.dateTime(new Date(`${insp.inspected_on}T12:00:00`), { dateStyle: "short" })}</span>
          {insp.location && <span className="text-muted-foreground">· {insp.location}</span>}
        </div>
      </PageHeader>
      {insp.notes && <p className="text-sm text-muted-foreground">{insp.notes}</p>}

      {editable && (
        <AddUnit inspectionId={id} units={(eligible ?? []).filter((u) => !inInspection.has(u.id))}
          hint={isSelf ? t("inspections.eligibleHintSelf") : t("inspections.eligibleHint")} />
      )}

      {(units ?? []).length === 0 ? <EmptyState>{t("inspections.noEligible")}</EmptyState> : (units ?? []).map((u) => {
        const unit = u.serial_units!;
        const rows = (results ?? []).filter((r) => r.serial_unit_id === unit.id)
          .sort((a, b) => (charById.get(a.characteristic_id)?.sort_order ?? 0) - (charById.get(b.characteristic_id)?.sort_order ?? 0));
        const noks = rows.filter((r) => r.ok === false);
        const ncParams = new URLSearchParams({
          supplier: insp.supplier_id, component: insp.component_id,
          origin: insp.type_code === "receiving" ? "receiving_plant" : "supplier_inspection",
          title: t("inspections.ncTitle", { number: insp.number, characteristic: noks.map((r) => name(charById.get(r.characteristic_id)!)).join(", ") }).slice(0, 200),
          description: noks.map((r) => `${name(charById.get(r.characteristic_id)!)}: ${r.measured_values?.join("; ") || r.measured_text || ""} ${r.comment ?? ""}`.trim()).join("\n"),
          sn: unit.identifier, unit: unit.id,
        });
        return (
          <section key={u.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/inspections/units/${unit.id}`} className="font-mono font-medium hover:underline">{unit.identifier}</Link>
                {unit.kind === "lot" && <span className="text-sm text-muted-foreground">{t("units.kinds.lot")} · {unit.quantity}</span>}
                <UnitTag tag={unit.tag} scrapped={unit.scrapped} />
                {u.result && <ToneBadge tone={u.result === "approved" ? "success" : "danger"}>{t(`inspections.unitResult.${u.result as "approved"}`)}</ToneBadge>}
              </div>
              {internal && u.result === "rejected" && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/ncs/new?${ncParams.toString()}`}><AlertTriangleIcon />{t("inspections.openNc")}</Link>
                </Button>
              )}
            </div>
            <div className="divide-y rounded-md border">
              {rows.map((r) => {
                const c = charById.get(r.characteristic_id)!;
                const applicable = activeWaivers.filter((w: { characteristic_ids: string[]; serial_unit_ids: string[] }) =>
                  (w.characteristic_ids.length === 0 || w.characteristic_ids.includes(c.id))
                  && (w.serial_unit_ids.length === 0 || w.serial_unit_ids.includes(unit.id)));
                return (
                  <ResultRow key={r.id} editable={editable} supplierId={insp.supplier_id} inspectionId={id}
                    result={{ id: r.id, measured: (r.measured_values ?? []).join(" "), qty_inspected: r.qty_inspected, qty_nok: r.qty_nok,
                      ok: r.ok, auto: r.auto_evaluated, comment: r.comment, waiver: (r.waivers as { number: string } | null)?.number ?? null }}
                    characteristic={{ name: name(c), spec: c.specification, lower: c.lower_limit, upper: c.upper_limit, unit: c.unit,
                      sampling: c.sampling, sampleSize: c.sample_size, accept: c.accept_number, critical: c.is_critical, isLot: unit.kind === "lot" }}
                    photos={photos[r.id] ?? []}
                    waiverAction={editable && internal && r.ok === false && !r.waiver_id && applicable.length > 0 ? (
                      <RecordDialog trigger={<Button size="sm" variant="outline">{t("inspections.applyWaiver")}</Button>}
                        title={t("inspections.applyWaiver")} hidden={{ result_id: r.id, inspection_id: id }} action={applyWaiver}
                        fields={[{ name: "waiver_id", label: t("waivers.number"), type: "select", required: true,
                          options: applicable.map((w: { id: string; number: string }) => ({ value: w.id, label: w.number })) }]} />
                    ) : null}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
