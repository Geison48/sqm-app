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
  getContactRoles, getQualificationStepTypes, getSupplierStatuses, type LookupItem, type StatusItem,
} from "@/lib/lookups";
import { saveGeneralSettings, saveLookupItem } from "@/lib/actions/settings";

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
  const [statuses, roles, steps, { data: settings }] = await Promise.all([
    getSupplierStatuses(),
    getContactRoles(),
    getQualificationStepTypes(),
    supabase.from("app_settings").select("key, value").in("key", ["certificate_alert_days", "timezone"]),
  ]);
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
        </dl>
      </section>

      <LookupSection table="supplier_statuses" title={t("supplierStatuses")} items={statuses} withTone />
      <LookupSection table="contact_roles" title={t("contactRoles")} items={roles} />
      <LookupSection table="qualification_step_types" title={t("qualificationSteps")} items={steps} />
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <LockIcon className="size-3" /> {t("systemHint")}
      </p>
    </div>
  );
}

async function LookupSection({
table, title, items, withTone,
}: {
  table: "supplier_statuses" | "contact_roles" | "qualification_step_types";
  title: string;
  items: (LookupItem | StatusItem)[];
withTone?: boolean;
}) {
const t = await getTranslations("settings");
  const fields = (item?: LookupItem | StatusItem): FieldDef[] => {
    const list: FieldDef[] = [];
    if (!item) list.push({ name: "code", label: t("code"), required: true, hint: t("codeHint") });
    list.push(
      { name: "label_pt", label: t("labelPt"), required: true, span: 1, defaultValue: item?.label_pt },
      { name: "label_en", label: t("labelEn"), required: true, span: 1, defaultValue: item?.label_en },
      { name: "sort_order", label: t("sortOrder"), type: "number", span: 1,
        defaultValue: item?.sort_order ?? (items.length + 1) * 10 },
    );
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
        <RecordDialog trigger={<AddButton label={t("addItem")} />} title={`${title} — ${t("addItem")}`}
          fields={fields()} hidden={{ table }} action={saveLookupItem} />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("code")}</TableHead>
              <TableHead>{t("labelPt")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("labelEn")}</TableHead>
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
                <TableCell>
                  <div className="flex flex-wrap justify-end">
                    <RecordDialog trigger={<EditButton label={t("editItem")} />} title={`${title} — ${t("editItem")}`}
                      fields={fields(item)} hidden={{ table, id: item.id }} action={saveLookupItem} />
                    {!item.is_system && <CancelRecordButton table={table} id={item.id} path="/settings" />}
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
