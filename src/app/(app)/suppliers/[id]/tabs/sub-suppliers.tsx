import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/server";
import { linkSubSupplierComponent, saveSubSupplier } from "@/lib/actions/suppliers";
import { countryName, countryOptions } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Sub = Database["public"]["Tables"]["sub_suppliers"]["Row"];

export async function SubSuppliersTab({ supplierId, canManage }: { supplierId: string; canManage: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const [{ data }, { data: links }, { data: supplierComponents }, { data: certs }] = await Promise.all([
    supabase.from("sub_suppliers").select("*").eq("supplier_id", supplierId).is("cancelled_at", null).order("name"),
    supabase.from("sub_supplier_components").select("id, sub_supplier_id, components(gw_code, description)")
      .eq("supplier_id", supplierId).is("cancelled_at", null),
    supabase.from("supplier_components").select("components(id, gw_code, description)")
      .eq("supplier_id", supplierId).is("cancelled_at", null),
    supabase.from("certifications").select("sub_supplier_id, standard_name, valid_until")
      .eq("supplier_id", supplierId).not("sub_supplier_id", "is", null).is("cancelled_at", null),
  ]);
  const subs = data ?? [];
  const path = `/suppliers/${supplierId}?tab=subSuppliers`;
  const componentOptions = (supplierComponents ?? []).flatMap((sc) =>
    sc.components ? [{ value: sc.components.id, label: `${sc.components.gw_code} — ${sc.components.description}` }] : [],
  );

  const fields = (s?: Sub): FieldDef[] => [
    { name: "name", label: t("subSuppliers.name"), required: true, defaultValue: s?.name },
    { name: "material", label: t("subSuppliers.material"), span: 1, defaultValue: s?.material },
    { name: "country_code", label: t("subSuppliers.country"), type: "select", span: 1,
      options: countryOptions(locale), defaultValue: s?.country_code },
    { name: "notes", label: t("subSuppliers.notes"), type: "textarea", defaultValue: s?.notes },
  ];

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <RecordDialog trigger={<AddButton label={t("subSuppliers.add")} />} title={t("subSuppliers.add")}
            fields={fields()} hidden={{ supplier_id: supplierId }} action={saveSubSupplier} />
        </div>
      )}
      {subs.length === 0 ? <EmptyState>{t("subSuppliers.empty")}</EmptyState> : (
        <div className="grid gap-3 md:grid-cols-2">
          {subs.map((s) => {
            const subLinks = (links ?? []).filter((l) => l.sub_supplier_id === s.id);
            const subCerts = (certs ?? []).filter((c) => c.sub_supplier_id === s.id);
            return (
              <div key={s.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {[s.material, s.country_code ? countryName(s.country_code, locale) : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex">
                      <RecordDialog trigger={<EditButton label={t("subSuppliers.edit")} />} title={t("subSuppliers.edit")}
                        fields={fields(s)} hidden={{ id: s.id, supplier_id: supplierId }} action={saveSubSupplier} />
                      <CancelRecordButton table="sub_suppliers" id={s.id} path={path} />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase">{t("subSuppliers.components")}</div>
                  <div className="flex flex-wrap items-center gap-1">
                    {subLinks.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                    {subLinks.map((l) => (
                      <span key={l.id} className="inline-flex items-center">
                        <Badge variant="outline" title={l.components?.description}>{l.components?.gw_code}</Badge>
                        {canManage && <CancelRecordButton table="sub_supplier_components" id={l.id} path={path} />}
                      </span>
                    ))}
                    {canManage && componentOptions.length > 0 && (
                      <RecordDialog
                        trigger={<AddButton link label={t("components.linkComponent")} />}
                        title={`${t("components.linkComponent")} — ${s.name}`}
                        hidden={{ supplier_id: supplierId, sub_supplier_id: s.id }}
                        action={linkSubSupplierComponent}
                        fields={[{ name: "component_id", label: t("components.component"), type: "select", required: true,
                          options: componentOptions }]}
                      />
                    )}
                  </div>
                </div>
                {subCerts.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase">{t("subSuppliers.certifications")}</div>
                    <div className="flex flex-wrap gap-1">
                      {subCerts.map((c, i) => <Badge key={i} variant="secondary">{c.standard_name}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
