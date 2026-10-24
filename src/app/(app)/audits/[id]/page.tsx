import Link from "next/link";
import { TakeOfflineButton } from "@/components/offline/take-offline-button";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ClipboardCheckIcon, FileDownIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { TabNav } from "@/components/shared/tab-nav";
import { RecordDialog } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { AuditStatusBadge, ClassificationBadge } from "@/components/audit/audit-badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { param } from "@/lib/filters";
import { completeAudit, updateAudit } from "@/lib/actions/audits";
import { auditFields } from "../audit-form";
import { StartButton } from "./start-button";
import { OverviewTab } from "./tabs/overview";
import { ChecklistTab } from "./tabs/checklist";
import { FindingsTab } from "./tabs/findings";

const TABS = ["overview", "checklist", "findings", "attachments"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: PageProps<"/audits/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("audits").select("number").eq("id", id).maybeSingle();
  return { title: data?.number };
}

export default async function AuditPage({ params, searchParams }: PageProps<"/audits/[id]">) {
  const profile = await requireProfile();
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const { data: audit } = await supabase.from("audits")
    .select("*, suppliers(id, legal_name), audit_templates(code, version, name_pt, name_en, method)").eq("id", id).maybeSingle();
  if (!audit) notFound();

  const internal = profile.role !== "supplier";
  const [{ data: canExecuteRaw }, types] = await Promise.all([
    supabase.rpc("can_execute_audit", { p_audit_id: id }),
    getLookup("audit_types", true),
  ]);
  const canExecute = !!canExecuteRaw && !audit.cancelled_at;
  const requested = param(sp.tab) as Tab | undefined;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "overview";
  const path = `/audits/${id}`;
  const reportIssued = ["completed", "closed"].includes(audit.status);
  const preStart = ["planned", "scheduled"].includes(audit.status);
  const edit = canExecute && audit.status !== "closed" ? await auditFields(profile, audit, { supplierFixed: true }) : null;
  const date = (d: string | null) => (d ? format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "short" }) : "—");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={<><span className="font-mono">{audit.number}</span> · {audit.suppliers?.legal_name}</>}
        description={
          <span>
            {lookupLabel(types.find((x) => x.code === audit.type_code), locale)}
            {audit.title && ` · ${audit.title}`} · {date(audit.planned_start)} – {date(audit.planned_end)}
          </span>
        }
        actions={
          <>
            {reportIssued && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline"><FileDownIcon />{t("audits.downloadPdf")}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("ncs.pdfLanguage")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(["pt-BR", "en", "both"] as const).map((l) => (
                    <DropdownMenuItem key={l} asChild>
                      <a href={`${path}/pdf?lang=${l}`} target="_blank" rel="noreferrer">{l === "both" ? t("ncs.pdfBoth") : t(`languages.${l}`)}</a>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {edit && (
              <RecordDialog trigger={<Button variant="outline"><PencilIcon />{t("audits.editData")}</Button>} title={t("audits.editData")}
                hidden={{ id, ...(edit.hasScopes ? { scopes_present: "1" } : {}), auditors_present: "1" }} action={updateAudit}
                fields={[...edit.fields, ...(reportIssued || audit.status === "in_progress"
                  ? [{ name: "summary", label: t("audits.summary"), type: "textarea" as const, defaultValue: audit.summary }] : [])]} />
            )}
            {canExecute && preStart && <StartButton auditId={id} disabled={audit.status === "planned"} />}
            {canExecute && audit.status === "in_progress" && (
              <>
                <Button asChild><Link href={`${path}/execute`}><ClipboardCheckIcon />{t("audits.continue")}</Link></Button>
                <RecordDialog trigger={<Button variant="outline">{t("audits.complete")}</Button>} title={t("audits.complete")}
                  description={t("audits.completeDescription")} hidden={{ id }} action={completeAudit}
                  fields={[{ name: "summary", label: t("audits.summary"), type: "textarea", defaultValue: audit.summary }]} />
              </>
            )}
            {canExecute && preStart && <CancelRecordButton table="audits" id={id} path={path} compact={false} />}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <AuditStatusBadge status={audit.status} cancelled={!!audit.cancelled_at} />
          {audit.audit_templates && (
            <Badge variant="outline">{audit.audit_templates.code} v{audit.audit_templates.version}</Badge>
          )}
          {reportIssued && <ClassificationBadge value={audit.classification} percent={audit.score_percent} />}
          {internal && <Link href={`/suppliers/${audit.supplier_id}`} className="text-sm text-muted-foreground hover:underline">{audit.suppliers?.legal_name}</Link>}
        </div>
      </PageHeader>

      {canExecute && audit.status === "in_progress" && <TakeOfflineButton kind="audit" id={id} userId={profile.id} />}

      {audit.status === "planned" && <p className="rounded-md bg-muted p-3 text-sm">{t("audits.planNotApprovedHint")} {t("plan.rule14")}</p>}

      <TabNav active={tab} tabs={TABS.map((key) => ({ key, label: t(`audits.tabs.${key}`), href: `${path}?tab=${key}` }))} />

      {tab === "overview" && <OverviewTab audit={audit} internal={internal} />}
      {tab === "checklist" && <ChecklistTab audit={audit} internal={internal} />}
      {tab === "findings" && <FindingsTab audit={audit} canExecute={canExecute} isOwnSupplier={profile.supplierId === audit.supplier_id} />}
      {tab === "attachments" && (
        <AttachmentsPanel target={{ entityTable: "audits", entityId: id, supplierId: audit.supplier_id, path: `${path}?tab=attachments` }}
          canUpload={canExecute} canManage={canExecute} allowInternal={internal} />
      )}
    </div>
  );
}
