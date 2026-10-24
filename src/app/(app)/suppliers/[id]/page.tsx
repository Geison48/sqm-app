import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { TabNav } from "@/components/shared/tab-nav";
import { CriticalityBadge, ToneBadge } from "@/components/shared/badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getInternalUsers, getSupplierStatuses, lookupLabel } from "@/lib/lookups";
import { param } from "@/lib/filters";
import { SupplierFormDialog } from "../supplier-form-dialog";
import { ChangeStatusDialog } from "./change-status-dialog";
import { OverviewTab } from "./tabs/overview";
import { PlantsTab } from "./tabs/plants";
import { ContactsTab } from "./tabs/contacts";
import { CertificationsTab } from "./tabs/certifications";
import { ComponentsTab } from "./tabs/components";
import { SubSuppliersTab } from "./tabs/sub-suppliers";
import { HistoryTab } from "./tabs/history";
import { QualificationTab } from "./tabs/qualification";
import { LogTab } from "./tabs/log";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";

const TABS = [
  "overview", "qualification", "plants", "contacts", "certifications", "components", "subSuppliers", "history",
  "attachments", "log",
] as const;
type Tab = (typeof TABS)[number];
const INTERNAL_TABS: Tab[] = ["qualification", "log"];

export async function generateMetadata({ params }: PageProps<"/suppliers/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("legal_name").eq("id", id).maybeSingle();
  return { title: data?.legal_name };
}

export default async function SupplierPage({ params, searchParams }: PageProps<"/suppliers/[id]">) {
  const profile = await requireProfile();
  const { id } = await params;
  const sp = await searchParams;
  const internal = profile.role !== "supplier";
  const t = await getTranslations();
  const locale = await getLocale();

  const supabase = await createClient();
  // A RLS devolve vazio para fornecedor de outra empresa: 404, nem "existe" vaza.
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*, users!suppliers_responsible_sqe_fkey(full_name, email)")
    .eq("id", id)
    .maybeSingle();
  if (!supplier) notFound();

  const visibleTabs = TABS.filter((tab) => internal || !INTERNAL_TABS.includes(tab));
  const requested = param(sp.tab) as Tab | undefined;
  const tab: Tab = requested && visibleTabs.includes(requested) ? requested : "overview";

  const [{ data: canManage }, statuses, internalUsers, { data: lastQualification }] = await Promise.all([
    supabase.rpc("can_manage_supplier", { p_supplier_id: id }),
    getSupplierStatuses(true),
    internal ? getInternalUsers() : Promise.resolve([]),
    internal
      ? supabase.from("qualifications").select("status").eq("supplier_id", id).is("cancelled_at", null)
          .order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const status = statuses.find((s) => s.code === supplier.status_code);
  const isOwnSupplier = profile.supplierId === id;
  const canEditContactsAndCerts = !!canManage || isOwnSupplier;
  const path = `/suppliers/${id}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={supplier.legal_name}
        description={supplier.trade_name}
        actions={
          canManage ? (
            <>
              <SupplierFormDialog
                mode="edit"
                isSqm={profile.role === "sqm"}
                currentUserId={profile.id}
                statuses={[]}
                internalUsers={internalUsers.map((u) => ({ value: u.id, label: u.full_name }))}
                values={supplier}
                trigger={
                  <Button variant="outline">
                    <PencilIcon />
                    {t("suppliers.editData")}
                  </Button>
                }
              />
              <ChangeStatusDialog
                supplierId={id}
                currentStatus={supplier.status_code}
                statuses={statuses
                  .filter((s) => !s.cancelled_at)
                  .map((s) => ({ value: s.code, label: lookupLabel(s, locale) }))}
                qualificationApproved={
                  lastQualification?.status === "approved" || lastQualification?.status === "approved_conditional"
                }
              />
            </>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ToneBadge tone={status?.tone ?? "neutral"}>{lookupLabel(status, locale)}</ToneBadge>
          <CriticalityBadge value={supplier.criticality} />
          {supplier.users && (
            <span className="text-sm text-muted-foreground">
              {t("suppliers.sqeContact", { name: supplier.users.full_name })}
            </span>
          )}
        </div>
      </PageHeader>

      {!internal && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t("suppliers.supplierPortalNote")}</p>
      )}

      <TabNav
        active={tab}
        tabs={visibleTabs.map((key) => ({ key, label: t(`suppliers.tabs.${key}`), href: `${path}?tab=${key}` }))}
      />

      {tab === "overview" && <OverviewTab supplier={supplier} />}
      {tab === "qualification" && <QualificationTab supplierId={id} canManage={!!canManage} />}
      {tab === "plants" && <PlantsTab supplierId={id} canManage={!!canManage} />}
      {tab === "contacts" && <ContactsTab supplierId={id} canEdit={canEditContactsAndCerts} />}
      {tab === "certifications" && (
        <CertificationsTab supplierId={id} canEdit={canEditContactsAndCerts} internal={internal} />
      )}
      {tab === "components" && <ComponentsTab supplierId={id} canManage={!!canManage} internal={internal} />}
      {tab === "subSuppliers" && <SubSuppliersTab supplierId={id} canManage={!!canManage} />}
      {tab === "history" && <HistoryTab supplierId={id} />}
      {tab === "attachments" && (
        <AttachmentsPanel
          target={{ entityTable: "suppliers", entityId: id, supplierId: id, path: `${path}?tab=attachments` }}
          canUpload={canEditContactsAndCerts}
          canManage={!!canManage}
          allowInternal={internal}
        />
      )}
      {tab === "log" && <LogTab supplierId={id} />}
    </div>
  );
}
