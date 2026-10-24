import { getTranslations } from "next-intl/server";
import { LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { ToneBadge } from "@/components/shared/badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getContactRoles, getLookup, getQualificationStepTypes, getSupplierStatuses, type LookupItem, type StatusItem,
} from "@/lib/lookups";
import { saveAuditSettings, saveGeneralSettings, saveLookupItem } from "@/lib/actions/settings";

const TONES = ["neutral", "success", "warning", "danger", "info"] as const;

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  await requireProfile(["sqe", "sqm"]);
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const supabase = await createClient();
  const [statuses, roles, steps, { data: settings }, origins, severities, failureModes, dispositions, locations, costTypes, disciplines] =
    await Promise.all([
      getSupplierStatuses(),
      getContactRoles(),
      getQualificationStepTypes(),
      supabase.from("app_settings").select("key, value").in("key", [
        "certificate_alert_days", "timezone", "deadline_warning_ratio", "simple_nc_response_days", "recurrence_window_days",
      ]),
      getLookup("nc_origins"), getLookup("nc_severities"), getLookup("failure_modes"), getLookup("dispositions"),
      getLookup("containment_locations"), getLookup("cost_types"), getLookup("eight_d_disciplines"),
    ]);
  const [auditTypes, auditScopes, { data: auditSettings }] = await Promise.all([
    getLookup("audit_types"), getLookup("audit_scopes"),
    supabase.from("app_settings").select("key, value").in("key", [
      "audit_frequency_months", "vda_rules", "gwi_rules", "audit_status_suggestion", "finding_response_days",
    ]),
  ]);
  const aset = (key: string) => (auditSettings?.find((s) => s.key === key)?.value ?? {}) as Record<string, number | boolean | string>;
  const freq = aset("audit_frequency_months");
  const vda = aset("vda_rules");
  const gwi = aset("gwi_rules");
  const suggest = aset("audit_status_suggestion");
  const findingDays = Number(auditSettings?.find((s) => s.key === "finding_response_days")?.value ?? 15);
  const statusOptions = statuses.map((s) => ({ value: s.code, label: s.label_pt }));
  const num = (key: string, fallback: number) => {
    const n = Number(setting(key));
    return Number.isFinite(n) ? n : fallback;
  };
  const setting = (key: string) => settings?.find((s) => s.key === key)?.value;

  const alertDays = Array.isArray(setting("certificate_alert_days")) ? (setting("certificate_alert_days") as number[]).join(", ") : "60, 30, 7";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">{t("general")}</h2>
          <RecordDialog
            trigger={<Button variant="outline" size="sm">{tc("edit")}</Button>}
            title={t("general")}
            action={saveGeneralSettings}
            fields={[
              { name: "certificate_alert_days", label: t("certificateAlertDays"), required: true,
                hint: t("certificateAlertDaysHint"), defaultValue: alertDays },
              { name: "timezone", label: t("timezone"), required: true, defaultValue: String(setting("timezone") ?? "America/Sao_Paulo") },
              { name: "deadline_warning_ratio", label: t("deadlineWarningRatio"), type: "number", required: true, span: 1,
                defaultValue: Math.round(num("deadline_warning_ratio", 0.25) * 100) },
              { name: "simple_nc_response_days", label: t("simpleNcResponseDays"), type: "number", required: true, span: 1,
                defaultValue: num("simple_nc_response_days", 10) },
              { name: "recurrence_window_days", label: t("recurrenceWindowDays"), type: "number", required: true, span: 1,
                defaultValue: num("recurrence_window_days", 365) },
            ]}
          />
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground uppercase">{t("certificateAlertDays")}</dt>
            <dd>{alertDays}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">{t("timezone")}</dt>
            <dd>{String(setting("timezone") ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">{t("deadlineWarningRatio")}</dt>
            <dd>{Math.round(num("deadline_warning_ratio", 0.25) * 100)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">{t("simpleNcResponseDays")}</dt>
            <dd>{num("simple_nc_response_days", 10)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">{t("recurrenceWindowDays")}</dt>
            <dd>{num("recurrence_window_days", 365)}</dd>
          </div>
        </dl>
      </section>

      <LookupSection table="supplier_statuses" title={t("supplierStatuses")} items={statuses} withTone />
      <LookupSection table="contact_roles" title={t("contactRoles")} items={roles} />
      <LookupSection table="qualification_step_types" title={t("qualificationSteps")} items={steps} />
      <h2 className="border-t pt-6 text-xl font-semibold">{t("ncGeneral")}</h2>
      <LookupSection table="eight_d_disciplines" title={t("eightD")} items={disciplines} withDeadline fixed />
      <LookupSection table="nc_origins" title={t("ncOrigins")} items={origins} />
      <LookupSection table="nc_severities" title={t("ncSeverities")} items={severities} withTone />
      <LookupSection table="failure_modes" title={t("failureModes")} items={failureModes} />
      <LookupSection table="dispositions" title={t("dispositions")} items={dispositions} />
      <LookupSection table="containment_locations" title={t("containmentLocations")} items={locations} />
      <LookupSection table="cost_types" title={t("costTypes")} items={costTypes} />

      <h2 className="border-t pt-6 text-xl font-semibold">{t("auditGeneral")}</h2>
      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-medium">{t("auditGeneral")}</h3>
          <RecordDialog trigger={<Button variant="outline" size="sm">{tc("edit")}</Button>} title={t("auditGeneral")}
            action={saveAuditSettings} fields={[
              { name: "freq_A", label: `${t("auditFrequency")} — A`, type: "number", required: true, span: 1, defaultValue: Number(freq.A ?? 12) },
              { name: "freq_B", label: `${t("auditFrequency")} — B`, type: "number", required: true, span: 1, defaultValue: Number(freq.B ?? 24) },
              { name: "freq_C", label: `${t("auditFrequency")} — C`, type: "number", required: true, span: 1, defaultValue: Number(freq.C ?? 36) },
              { name: "finding_response_days", label: t("findingResponseDays"), type: "number", required: true, span: 1, defaultValue: findingDays },
              { name: "vda_a_min", label: `VDA — ${t("vdaAMin")}`, type: "number", required: true, span: 1, defaultValue: Number(vda.a_min ?? 90) },
              { name: "vda_b_min", label: `VDA — ${t("vdaBMin")}`, type: "number", required: true, span: 1, defaultValue: Number(vda.b_min ?? 80) },
              { name: "vda_element_to_b", label: t("vdaElementToB"), type: "number", required: true, span: 1, defaultValue: Number(vda.element_to_b ?? 80) },
              { name: "vda_element_to_c", label: t("vdaElementToC"), type: "number", required: true, span: 1, defaultValue: Number(vda.element_to_c ?? 70) },
              { name: "vda_star4_to_b", label: t("vdaStar4"), type: "checkbox", defaultValue: vda.star4_to_b !== false },
              { name: "vda_any0_to_b", label: t("vdaAny0"), type: "checkbox", defaultValue: vda.any0_to_b !== false },
              { name: "vda_star0_to_c", label: t("vdaStar0"), type: "checkbox", defaultValue: vda.star0_to_c !== false },
              { name: "gwi_a_min", label: `GWI — ${t("gwiAMin")}`, type: "number", required: true, span: 1, defaultValue: Number(gwi.a_min ?? 90) },
              { name: "gwi_b_min", label: `GWI — ${t("gwiBMin")}`, type: "number", required: true, span: 1, defaultValue: Number(gwi.b_min ?? 80) },
              { name: "gwi_major_nc_limits_to_b", label: t("gwiMajor"), type: "checkbox", defaultValue: gwi.major_nc_limits_to_b !== false },
              ...(["A", "B", "C"] as const).map((c) => ({
                name: `suggest_${c}`, label: `${t("suggestionMap")} ${c}`, type: "select" as const, span: 1 as const,
                options: statusOptions, defaultValue: (suggest[c] as string | undefined) ?? null,
              })),
            ]} />
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground uppercase">{t("auditFrequency")}</dt><dd>{`${freq.A ?? 12} / ${freq.B ?? 24} / ${freq.C ?? 36}`}</dd></div>
          <div><dt className="text-xs text-muted-foreground uppercase">{t("findingResponseDays")}</dt><dd>{findingDays}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground uppercase">{t("vdaRules")}</dt>
            <dd>A ≥ {String(vda.a_min ?? 90)}% · B ≥ {String(vda.b_min ?? 80)}% · {t("vdaElementToB")} {String(vda.element_to_b ?? 80)}% · {t("vdaElementToC")} {String(vda.element_to_c ?? 70)}%
              {vda.star4_to_b !== false && <> · {t("vdaStar4")}</>}{vda.any0_to_b !== false && <> · {t("vdaAny0")}</>}{vda.star0_to_c !== false && <> · {t("vdaStar0")}</>}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground uppercase">{t("gwiRules")}</dt>
            <dd>A ≥ {String(gwi.a_min ?? 90)}% · B ≥ {String(gwi.b_min ?? 80)}%{gwi.major_nc_limits_to_b !== false && <> · {t("gwiMajor")}</>}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground uppercase">{t("suggestionMap")}</dt>
            <dd>{(["A", "B", "C"] as const).map((c) => `${c}: ${statuses.find((s) => s.code === suggest[c])?.label_pt ?? t("none")}`).join(" · ")}</dd></div>
        </dl>
      </section>
      <LookupSection table="audit_types" title={t("auditTypes")} items={auditTypes} />
      <LookupSection table="audit_scopes" title={t("auditScopes")} items={auditScopes} />
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <LockIcon className="size-3" /> {t("systemHint")}
      </p>
    </div>
  );
}

type LookupTable =
  | "supplier_statuses" | "contact_roles" | "qualification_step_types" | "nc_origins" | "nc_severities" | "failure_modes"
  | "dispositions" | "containment_locations" | "cost_types" | "eight_d_disciplines" | "audit_types" | "audit_scopes";
type Item = (LookupItem | StatusItem) & { deadline_hours?: number };

async function LookupSection({
  table, title, items, withTone, withDeadline, fixed,
}: {
  table: LookupTable;
  title: string;
  items: Item[];
  withTone?: boolean;
  /** Prazo em horas (disciplinas do 8D). */
  withDeadline?: boolean;
  /** Lista fechada: sem adicionar itens. */
  fixed?: boolean;
}) {
  const t = await getTranslations("settings");
  const fields = (item?: Item): FieldDef[] => {
    const list: FieldDef[] = [];
    if (!item) list.push({ name: "code", label: t("code"), required: true, hint: t("codeHint") });
    list.push(
      { name: "label_pt", label: t("labelPt"), required: true, span: 1, defaultValue: item?.label_pt },
      { name: "label_en", label: t("labelEn"), required: true, span: 1, defaultValue: item?.label_en },
      { name: "sort_order", label: t("sortOrder"), type: "number", span: 1,
        defaultValue: item?.sort_order ?? (items.length + 1) * 10 },
    );
    if (withDeadline) {
      list.push({ name: "deadline_hours", label: t("deadlineHours"), type: "number", required: true, span: 1,
        defaultValue: item?.deadline_hours });
    }
    if (withTone) {
      list.push({ name: "tone", label: t("tone"), type: "select", required: true, span: 1,
        options: TONES.map((x) => ({ value: x, label: t(`tones.${x}`) })),
        defaultValue: (item as StatusItem | undefined)?.tone ?? "neutral" });
    }
    return list;
  };
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{title}</h2>
        {!fixed && (
          <RecordDialog trigger={<AddButton label={t("addItem")} />} title={`${title} — ${t("addItem")}`}
            fields={fields()} hidden={{ table }} action={saveLookupItem} />
        )}
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("code")}</TableHead>
              <TableHead>{t("labelPt")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("labelEn")}</TableHead>
              {withDeadline && <TableHead>{t("deadlineHours")}</TableHead>}
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">
                  <span className="inline-flex items-center gap-1">
                    {item.code}
                    {item.is_system && <LockIcon className="size-3 text-muted-foreground" aria-label={t("systemHint")} />}
                  </span>
                </TableCell>
                <TableCell>
                  {withTone ? <ToneBadge tone={(item as StatusItem).tone}>{item.label_pt}</ToneBadge> : item.label_pt}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{item.label_en}</TableCell>
                {withDeadline && <TableCell>{item.deadline_hours} h</TableCell>}
                <TableCell>
                  <div className="flex flex-wrap justify-end">
                    <RecordDialog trigger={<EditButton label={t("editItem")} />} title={`${title} — ${t("editItem")}`}
                      fields={fields(item)} hidden={{ table, id: item.id }} action={saveLookupItem} />
                    {!item.is_system && table !== "eight_d_disciplines" && (
                      <CancelRecordButton table={table} id={item.id} path="/settings" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
