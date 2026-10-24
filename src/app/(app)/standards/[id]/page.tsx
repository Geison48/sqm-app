import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { TabNav } from "@/components/shared/tab-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveRequirement } from "@/lib/actions/catalog";
import { param } from "@/lib/filters";
import type { Database } from "@/lib/database.types";
import { StandardFormDialog } from "../standard-form-dialog";

const TABS = ["overview", "requirements", "components", "attachments"] as const;
type Tab = (typeof TABS)[number];
const KINDS = ["audit", "inspection", "both"] as const;
type Requirement = Database["public"]["Tables"]["standard_requirements"]["Row"];

export default async function StandardPage({ params, searchParams }: PageProps<"/standards/[id]">) {
  await requireProfile(["sqe", "sqm"]);
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations("standards");
  const locale = await getLocale();
  const requested = param(sp.tab) as Tab | undefined;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "requirements";
  const path = `/standards/${id}`;

  const supabase = await createClient();
  const { data: standard } = await supabase.from("standards").select("*").eq("id", id).maybeSingle();
  if (!standard) notFound();
  const title = locale === "en" ? standard.title_en : standard.title_pt;

  let body: React.ReactNode = null;
  if (tab === "overview") {
    const items: [string, string][] = [
      [t("code"), standard.code],
      [t("revision"), standard.revision ?? "—"],
      [t("titlePt"), standard.title_pt],
      [t("titleEn"), standard.title_en],
      [t("application"), t(`applications.${standard.application as "product"}`)],
      [t("issuer"), standard.issuer ?? "—"],
      [t("notes"), standard.notes ?? "—"],
    ];
    body = (
      <dl className="grid gap-x-8 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground uppercase">{label}</dt>
            <dd className="text-sm whitespace-pre-line">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (tab === "requirements") {
    const { data } = await supabase.from("standard_requirements").select("*").eq("standard_id", id)
      .is("cancelled_at", null).order("sort_order").order("item_code");
    const reqs = data ?? [];
    const fields = (r?: Requirement): FieldDef[] => [
      { name: "item_code", label: t("itemCode"), required: true, span: 1, defaultValue: r?.item_code },
      { name: "kind", label: t("kind"), type: "select", required: true, span: 1,
        options: KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) })), defaultValue: r?.kind ?? "both" },
      { name: "text_pt", label: t("textPt"), type: "textarea", required: true, defaultValue: r?.text_pt },
      { name: "text_en", label: t("textEn"), type: "textarea", required: true, defaultValue: r?.text_en },
      { name: "sort_order", label: t("sortOrder"), type: "number", span: 1,
        defaultValue: r?.sort_order ?? (reqs.length + 1) * 10 },
    ];
    body = (
      <div className="space-y-3">
        <div className="flex justify-end">
          <RecordDialog trigger={<AddButton label={t("addRequirement")} />} title={t("addRequirement")}
            fields={fields()} hidden={{ standard_id: id }} action={saveRequirement} />
        </div>
        {reqs.length === 0 ? <EmptyState>{t("requirementsEmpty")}</EmptyState> : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">{t("itemCode")}</TableHead>
                  <TableHead>{t("requirements")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("kind")}</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqs.map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell className="font-mono text-xs">{r.item_code}</TableCell>
                    <TableCell className="whitespace-normal">
                      {locale === "en" ? r.text_en : r.text_pt}
                      <div className="text-xs text-muted-foreground">{locale === "en" ? r.text_pt : r.text_en}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell"><Badge variant="outline">{t(`kinds.${r.kind as "audit"}`)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end">
                        <RecordDialog trigger={<EditButton label={t("editRequirement")} />} title={t("editRequirement")}
                          fields={fields(r)} hidden={{ id: r.id, standard_id: id }} action={saveRequirement} />
                        <CancelRecordButton table="standard_requirements" id={r.id} path={`${path}?tab=requirements`} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  if (tab === "components") {
    const { data } = await supabase.from("component_standards").select("id, components(id, gw_code, description)")
      .eq("standard_id", id).is("cancelled_at", null);
    body = (data ?? []).length === 0 ? <EmptyState>—</EmptyState> : (
      <ul className="divide-y rounded-lg border">
        {(data ?? []).map((l) => l.components && (
          <li key={l.id} className="px-4 py-3">
            <Link href={`/components/${l.components.id}`} className="hover:underline">
              <span className="font-mono text-xs">{l.components.gw_code}</span> — {l.components.description}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (tab === "attachments") {
    body = (
      <AttachmentsPanel
        target={{ entityTable: "standards", entityId: id, supplierId: null, path: `${path}?tab=attachments` }}
        canUpload canManage allowInternal={false} forceInternal
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={[standard.code, standard.revision].filter(Boolean).join(":")}
        description={title}
        actions={<StandardFormDialog values={standard} trigger={<Button variant="outline"><PencilIcon />{t("editData")}</Button>} />}
      />
      <TabNav active={tab} tabs={TABS.map((key) => ({ key, label: t(`tabs.${key}`), href: `${path}?tab=${key}` }))} />
      {body}
    </div>
  );
}
