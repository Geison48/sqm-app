import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { FileDownIcon, PencilIcon } from "lucide-react";
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
import { DeadlineBadge, NcStatusBadge, SeverityBadge } from "@/components/shared/nc-badges";
import { ToneBadge } from "@/components/shared/badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, getNumericSetting, lookupLabel } from "@/lib/lookups";
import { deadlineState } from "@/lib/eight-d";
import { updateNc } from "@/lib/actions/ncs";
import { param } from "@/lib/filters";
import { ConvertButton } from "./convert-button";
import { CreatedToast } from "./created-toast";
import { OverviewTab } from "./tabs/overview";
import { EightDTab } from "./tabs/eight-d";
import { CostsTab } from "./tabs/costs";
import { CommentsTab } from "./tabs/comments";
import { ClosureTab } from "./tabs/closure";

const TABS = ["overview", "eightD", "costs", "comments", "attachments", "closure"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: PageProps<"/ncs/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("ncs").select("number").eq("id", id).maybeSingle();
  return { title: data?.number };
}

export default async function NcPage({ params, searchParams }: PageProps<"/ncs/[id]">) {
  const profile = await requireProfile();
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: nc } = await supabase.from("ncs")
    .select("*, suppliers(id, legal_name), components(id, gw_code, description)")
    .eq("id", id).maybeSingle();
  if (!nc) notFound();

  const internal = profile.role !== "supplier";
  const [{ data: canManageRaw }, { data: overview }, ratio, origins, severities, failureModes] = await Promise.all([
    supabase.rpc("can_manage_supplier", { p_supplier_id: nc.supplier_id }),
    supabase.from("nc_overview").select("next_due_at, pending_with").eq("id", id).maybeSingle(),
    getNumericSetting("deadline_warning_ratio", 0.25),
    getLookup("nc_origins"),
    getLookup("nc_severities"),
    getLookup("failure_modes"),
  ]);
  const canManage = !!canManageRaw && nc.status !== "closed" && !nc.cancelled_at;
  const isOwnSupplier = profile.supplierId === nc.supplier_id;
  const is8d = nc.type === "8d";
  const visibleTabs = TABS.filter((tab) => is8d || (tab !== "eightD" && tab !== "closure"));
  const requested = param(sp.tab) as Tab | undefined;
  const tab: Tab = requested && visibleTabs.includes(requested) ? requested : is8d ? "eightD" : "overview";
  const path = `/ncs/${id}`;
  const deadline = deadlineState(overview?.next_due_at ?? null, nc.opened_at, {
    ratio, withSqe: overview?.pending_with === "sqe", done: nc.status === "closed",
  });
  const opts = (items: { code: string; label_pt: string; label_en: string }[]) =>
    items.map((i) => ({ value: i.code, label: lookupLabel(i, locale) }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CreatedToast show={param(sp.created) === "1"} message={t("ncs.addPhotosHint")} />
      <PageHeader
        title={<><span className="font-mono">{nc.number}</span> · {nc.title}</>}
        description={
          <span>
            {internal ? <Link href={`/suppliers/${nc.supplier_id}`} className="hover:underline">{nc.suppliers?.legal_name}</Link> : nc.suppliers?.legal_name}
            {nc.components && <> · <span className="font-mono">{nc.components.gw_code}</span> {nc.components.description}</>}
          </span>
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><FileDownIcon />{t("ncs.downloadPdf")}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("ncs.pdfLanguage")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["pt-BR", "en", "both"] as const).map((l) => (
                  <DropdownMenuItem key={l} asChild>
                    <a href={`${path}/pdf?lang=${l}`} target="_blank" rel="noreferrer">
                      {l === "both" ? t("ncs.pdfBoth") : t(`languages.${l}`)}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {canManage && (
              <RecordDialog
                trigger={<Button variant="outline"><PencilIcon />{t("ncs.editData")}</Button>}
                title={t("ncs.editData")}
                hidden={{ id }}
                action={updateNc}
                fields={[
                  { name: "title", label: t("ncs.ncTitle"), required: true, defaultValue: nc.title },
                  { name: "description", label: t("ncs.description"), type: "textarea", required: true, defaultValue: nc.description },
                  { name: "origin_code", label: t("ncs.origin"), type: "select", required: true, span: 1, options: opts(origins), defaultValue: nc.origin_code },
                  { name: "severity_code", label: t("ncs.severity"), type: "select", required: true, span: 1, options: opts(severities), defaultValue: nc.severity_code },
                  { name: "failure_mode_code", label: t("ncs.failureMode"), type: "select", span: 1, options: opts(failureModes), defaultValue: nc.failure_mode_code },
                  { name: "detected_on", label: t("ncs.detectedOn"), type: "date", required: true, span: 1, defaultValue: nc.detected_on },
                  { name: "detected_location", label: t("ncs.detectedLocation"), span: 1, defaultValue: nc.detected_location },
                  { name: "quantity_affected", label: t("ncs.quantityAffected"), type: "number", span: 1, defaultValue: nc.quantity_affected },
                  { name: "customer_affected", label: t("ncs.customerAffected"), type: "checkbox", defaultValue: nc.customer_affected },
                ]}
              />
            )}
            {canManage && nc.type === "simple" && nc.status === "open" && <ConvertButton ncId={id} />}
            {canManage && <CancelRecordButton table="ncs" id={id} path={path} compact={false} />}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="outline">{t(`ncs.types.${nc.type as "8d"}`)}</Badge>
          <SeverityBadge code={nc.severity_code} />
          <NcStatusBadge status={nc.status} cancelled={!!nc.cancelled_at} />
          {!nc.cancelled_at && <DeadlineBadge state={deadline} />}
          {nc.suggested_8d && nc.type === "simple" && <ToneBadge tone="warning">{t("ncs.suggestedBadge")}</ToneBadge>}
        </div>
      </PageHeader>

      <TabNav active={tab} tabs={visibleTabs.map((key) => ({ key, label: t(`ncs.tabs.${key}`), href: `${path}?tab=${key}` }))} />

      {tab === "overview" && <OverviewTab nc={nc} canManage={canManage} isOwnSupplier={isOwnSupplier} />}
      {tab === "eightD" && (
        <EightDTab nc={nc} selected={param(sp.d)} canManage={canManage} isOwnSupplier={isOwnSupplier} ratio={ratio} />
      )}
      {/* Custos seguem depois do fechamento do 8D (cobrança/contestação/débito). */}
      {tab === "costs" && <CostsTab nc={nc} canManage={!!canManageRaw && !nc.cancelled_at} isOwnSupplier={isOwnSupplier && !nc.cancelled_at} />}
      {tab === "comments" && <CommentsTab ncId={id} internal={internal} />}
      {tab === "attachments" && (
        <AttachmentsPanel
          target={{ entityTable: "ncs", entityId: id, supplierId: nc.supplier_id, path: `${path}?tab=attachments` }}
          canUpload={(canManage || isOwnSupplier) && nc.status !== "closed" && !nc.cancelled_at}
          canManage={canManage}
          allowInternal={internal}
        />
      )}
      {tab === "closure" && <ClosureTab nc={nc} canManage={canManage} />}
    </div>
  );
}
