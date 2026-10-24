import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { TabNav } from "@/components/shared/tab-nav";
import { CriticalityBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton } from "@/components/shared/icon-buttons";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { linkComponentStandard } from "@/lib/actions/catalog";
import { linkSupplierComponent } from "@/lib/actions/suppliers";
import { param } from "@/lib/filters";
import { ComponentFormDialog } from "../component-form-dialog";

const TABS = ["overview", "suppliers", "standards", "subSuppliers", "attachments"] as const;
type Tab = (typeof TABS)[number];

export default async function ComponentPage({ params, searchParams }: PageProps<"/components/[id]">) {
  const profile = await requireProfile(["sqe", "sqm"]);
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const requested = param(sp.tab) as Tab | undefined;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "overview";
  const path = `/components/${id}`;

  const supabase = await createClient();
  const { data: component } = await supabase.from("components").select("*").eq("id", id).maybeSingle();
  if (!component) notFound();
  const { data: canManage } = await supabase.rpc("can_manage_component", { p_component_id: id });

  const header = (
    <PageHeader
      title={<span className="font-mono">{component.gw_code}</span>}
      description={component.description}
      actions={canManage ? (
        <ComponentFormDialog values={component} trigger={<Button variant="outline"><PencilIcon />{t("components.editData")}</Button>} />
      ) : undefined}
    >
      <div className="flex items-center gap-2 pt-1"><CriticalityBadge value={component.criticality} /></div>
    </PageHeader>
  );

  let body: React.ReactNode = null;

  if (tab === "overview") {
    const items: [string, string][] = [
      [t("components.gwCode"), component.gw_code],
      [t("components.description"), component.description],
      [t("components.drawingRevision"), component.drawing_revision ?? "—"],
      [t("criticality.label"), t(`criticality.${component.criticality as "A"}`)],
      [t("components.controlPlan"), component.control_plan_ref ?? "—"],
      [t("components.notes"), component.notes ?? "—"],
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

  if (tab === "suppliers") {
    const [{ data: links }, { data: suppliers }] = await Promise.all([
      supabase.from("supplier_components").select("id, supplier_id, supplier_part_number, suppliers(legal_name)")
        .eq("component_id", id).is("cancelled_at", null),
      supabase.from("suppliers").select("id, legal_name, responsible_sqe_id").is("cancelled_at", null).order("legal_name"),
    ]);
    const linked = new Set((links ?? []).map((l) => l.supplier_id));
    // Só oferece fornecedores que o usuário pode editar (a RLS confere de novo).
    const linkable = (suppliers ?? []).filter(
      (s) => !linked.has(s.id) && (profile.role === "sqm" || s.responsible_sqe_id === profile.id),
    );
    body = (
      <div className="space-y-3">
        {linkable.length > 0 && (
          <div className="flex justify-end">
            <RecordDialog
              trigger={<AddButton link label={t("components.linkSupplier")} />}
              title={t("components.linkSupplier")}
              hidden={{ component_id: id }}
              action={linkSupplierComponent}
              fields={[
                { name: "supplier_id", label: t("suppliers.legalName"), type: "select", required: true,
                  options: linkable.map((s) => ({ value: s.id, label: s.legal_name })) },
                { name: "supplier_part_number", label: t("components.supplierPartNumber") },
              ]}
            />
          </div>
        )}
        {(links ?? []).length === 0 ? <EmptyState>{t("components.noSuppliers")}</EmptyState> : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("suppliers.legalName")}</TableHead>
                  <TableHead>{t("components.supplierPartNumber")}</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(links ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell><Link href={`/suppliers/${l.supplier_id}?tab=components`} className="hover:underline">{l.suppliers?.legal_name}</Link></TableCell>
                    <TableCell>{l.supplier_part_number ?? "—"}</TableCell>
                    <TableCell><CancelRecordButton table="supplier_components" id={l.id} path={`${path}?tab=suppliers`} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  if (tab === "standards") {
    const [{ data: links }, { data: standards }] = await Promise.all([
      supabase.from("component_standards").select("id, standards(id, code, revision, title_pt, title_en, application)")
        .eq("component_id", id).is("cancelled_at", null),
      supabase.from("standards").select("id, code, revision").is("cancelled_at", null).order("code"),
    ]);
    const linked = new Set((links ?? []).map((l) => l.standards?.id));
    body = (
      <div className="space-y-3">
        {canManage && (
          <div className="flex justify-end">
            <RecordDialog
              trigger={<AddButton link label={t("components.linkStandard")} />}
              title={t("components.linkStandard")}
              hidden={{ component_id: id }}
              action={linkComponentStandard}
              fields={[{ name: "standard_id", label: t("standards.code"), type: "select", required: true,
                options: (standards ?? []).filter((s) => !linked.has(s.id))
                  .map((s) => ({ value: s.id, label: [s.code, s.revision].filter(Boolean).join(":") })) }]}
            />
          </div>
        )}
        {(links ?? []).length === 0 ? <EmptyState>{t("components.noStandards")}</EmptyState> : (
          <ul className="divide-y rounded-lg border">
            {(links ?? []).map((l) => l.standards && (
              <li key={l.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <Link href={`/standards/${l.standards.id}`} className="min-w-0 hover:underline">
                  <span className="font-medium">{[l.standards.code, l.standards.revision].filter(Boolean).join(":")}</span>{" "}
                  <span className="text-sm text-muted-foreground">{locale === "en" ? l.standards.title_en : l.standards.title_pt}</span>
                </Link>
                {canManage && <CancelRecordButton table="component_standards" id={l.id} path={`${path}?tab=standards`} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (tab === "subSuppliers") {
    const { data: links } = await supabase.from("sub_supplier_components")
      .select("id, supplier_id, sub_suppliers(name, material), suppliers(legal_name)")
      .eq("component_id", id).is("cancelled_at", null);
    body = (links ?? []).length === 0 ? <EmptyState>{t("components.subSuppliersNone")}</EmptyState> : (
      <ul className="divide-y rounded-lg border">
        {(links ?? []).map((l) => (
          <li key={l.id} className="px-4 py-3">
            <div className="font-medium">{l.sub_suppliers?.name}</div>
            <div className="text-sm text-muted-foreground">
              {[l.sub_suppliers?.material, l.suppliers?.legal_name].filter(Boolean).join(" · ")}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (tab === "attachments") {
    body = (
      <AttachmentsPanel
        target={{ entityTable: "components", entityId: id, supplierId: null, path: `${path}?tab=attachments` }}
        canUpload={!!canManage}
        canManage={!!canManage}
        allowInternal={false}
        forceInternal
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {header}
      <TabNav active={tab} tabs={TABS.map((key) => ({ key, label: t(`components.tabs.${key}`), href: `${path}?tab=${key}` }))} />
      {body}
    </div>
  );
}
