import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { createPlan, saveCharacteristic } from "@/lib/actions/inspections";
import type { Database } from "@/lib/database.types";

type Char = Database["public"]["Tables"]["inspection_characteristics"]["Row"];

export default async function PlanPage({ params }: PageProps<"/inspections/plans/[id]">) {
  await requireProfile();
  const { id } = await params;
  const t = await getTranslations("inspPlans");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("inspection_plans").select("*, components(gw_code, description)").eq("id", id).maybeSingle();
  if (!plan) notFound();
  const [{ data: canManage }, { data }, types, { data: reqs }] = await Promise.all([
    supabase.rpc("can_manage_component", { p_component_id: plan.component_id }),
    supabase.from("inspection_characteristics").select("*").eq("plan_id", id).is("cancelled_at", null).order("sort_order"),
    getLookup("characteristic_types"),
    supabase.from("standard_requirements").select("id, item_code, text_pt, text_en, standards(code)").in("kind", ["inspection", "both"])
      .is("cancelled_at", null).order("item_code"),
  ]);
  const chars = data ?? [];
  const path = `/inspections/plans/${id}`;

  const fields = (c?: Char): FieldDef[] => [
    { name: "name_pt", label: t("namePt"), required: true, defaultValue: c?.name_pt },
    { name: "name_en", label: t("nameEn"), required: true, defaultValue: c?.name_en },
    { name: "char_type_code", label: t("type"), type: "select", required: true, span: 1,
      options: types.map((x) => ({ value: x.code, label: lookupLabel(x, locale) })), defaultValue: c?.char_type_code ?? "dimensional" },
    { name: "specification", label: t("specification"), span: 1, defaultValue: c?.specification },
    { name: "nominal", label: t("nominal"), type: "number", step: "any", span: 1, defaultValue: c?.nominal },
    { name: "unit", label: t("unit"), span: 1, defaultValue: c?.unit },
    { name: "lower_limit", label: t("lower"), type: "number", step: "any", span: 1, defaultValue: c?.lower_limit },
    { name: "upper_limit", label: t("upper"), type: "number", step: "any", span: 1, defaultValue: c?.upper_limit },
    { name: "method", label: t("method"), span: 1, defaultValue: c?.method },
    { name: "instrument", label: t("instrument"), span: 1, defaultValue: c?.instrument },
    { name: "sampling", label: t("sampling"), type: "select", required: true, span: 1, defaultValue: c?.sampling ?? "100",
      options: (["100", "aql"] as const).map((s) => ({ value: s, label: t(`samplings.${s}`) })) },
    { name: "aql_level", label: t("aqlLevel"), span: 1, defaultValue: c?.aql_level },
    { name: "sample_size", label: t("sampleSize"), type: "number", span: 1, defaultValue: c?.sample_size },
    { name: "accept_number", label: t("acceptNumber"), type: "number", span: 1, defaultValue: c?.accept_number },
    { name: "standard_requirement_id", label: t("requirement"), type: "select",
      options: (reqs ?? []).map((r) => ({ value: r.id, label: `${r.standards?.code} ${r.item_code} — ${(locale === "en" ? r.text_en : r.text_pt).slice(0, 60)}` })),
      defaultValue: c?.standard_requirement_id },
    { name: "sort_order", label: t("sortOrder"), type: "number", span: 1, defaultValue: c?.sort_order ?? (chars.length + 1) * 10 },
    { name: "is_critical", label: t("critical"), type: "checkbox", defaultValue: c?.is_critical },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={<><span className="font-mono">{plan.components?.gw_code}</span> · {t("revision")} {plan.revision}</>}
        description={plan.components?.description}
        actions={canManage ? (
          <>
            <RecordDialog trigger={<Button variant="outline"><PencilIcon />{t("revision")}</Button>} title={t("revision")}
              hidden={{ id, component_id: plan.component_id }} action={createPlan} fields={[
                { name: "revision", label: t("revision"), required: true, span: 1, defaultValue: plan.revision },
                { name: "notes", label: t("notes"), type: "textarea", defaultValue: plan.notes },
              ]} />
            <RecordDialog trigger={<AddButton label={t("add")} />} title={t("add")} hidden={{ plan_id: id }} action={saveCharacteristic} fields={fields()} />
          </>
        ) : undefined}
      />
      {plan.notes && <p className="text-sm text-muted-foreground">{plan.notes}</p>}
      {chars.length === 0 ? <EmptyState>{t("empty")}</EmptyState> : (
        <ul className="divide-y rounded-lg border">
          {chars.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium">
                  {c.is_critical && <span className="text-red-600">◆ </span>}{locale === "en" ? c.name_en : c.name_pt}{" "}
                  <Badge variant="outline">{lookupLabel(types.find((x) => x.code === c.char_type_code), locale)}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {[c.specification,
                    c.lower_limit != null || c.upper_limit != null ? `${t("limits")}: ${c.lower_limit ?? "−∞"} … ${c.upper_limit ?? "+∞"} ${c.unit ?? ""}` : null,
                    c.method, c.instrument,
                    c.sampling === "aql" ? `AQL ${c.aql_level ?? ""} · n=${c.sample_size} · Ac=${c.accept_number}` : "100%"]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0">
                  <RecordDialog trigger={<EditButton label={t("edit")} />} title={t("edit")} hidden={{ id: c.id, plan_id: id }}
                    action={saveCharacteristic} fields={fields(c)} />
                  <CancelRecordButton table="inspection_characteristics" id={c.id} path={path} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
