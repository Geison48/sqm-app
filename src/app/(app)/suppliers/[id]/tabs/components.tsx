import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordDialog } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton } from "@/components/shared/icon-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { CriticalityBadge } from "@/components/shared/badges";
import { createClient } from "@/lib/supabase/server";
import { linkSupplierComponent } from "@/lib/actions/suppliers";

export async function ComponentsTab({
  supplierId,
  canManage,
  internal,
}: {
  supplierId: string;
  canManage: boolean;
  internal: boolean;
}) {
  const t = await getTranslations();
  const supabase = await createClient();
  const [{ data: links }, { data: allComponents }] = await Promise.all([
    supabase
      .from("supplier_components")
      .select("id, supplier_part_number, components(id, gw_code, description, drawing_revision, criticality)")
      .eq("supplier_id", supplierId)
      .is("cancelled_at", null),
    canManage
      ? supabase.from("components").select("id, gw_code, description").is("cancelled_at", null).order("gw_code")
      : Promise.resolve({ data: [] as { id: string; gw_code: string; description: string }[] }),
  ]);
  const rows = (links ?? []).filter((l) => l.components).sort((a, b) => a.components!.gw_code.localeCompare(b.components!.gw_code));
  const linked = new Set(rows.map((r) => r.components!.id));
  const path = `/suppliers/${supplierId}?tab=components`;

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <RecordDialog
            trigger={<AddButton link label={t("components.linkComponent")} />}
            title={t("components.linkComponent")}
            hidden={{ supplier_id: supplierId }}
            action={linkSupplierComponent}
            fields={[
              { name: "component_id", label: t("components.component"), type: "select", required: true,
                options: (allComponents ?? []).filter((c) => !linked.has(c.id))
                  .map((c) => ({ value: c.id, label: `${c.gw_code} — ${c.description}` })) },
              { name: "supplier_part_number", label: t("components.supplierPartNumber") },
            ]}
          />
        </div>
      )}
      {rows.length === 0 ? <EmptyState>{t("components.empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("components.gwCode")}</TableHead>
                <TableHead>{t("components.description")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("components.drawingRevision")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("components.supplierPartNumber")}</TableHead>
                <TableHead>{t("components.criticality")}</TableHead>
                {canManage && <TableHead className="w-0" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => {
                const c = l.components!;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">
                      {internal ? <Link href={`/components/${c.id}`} className="hover:underline">{c.gw_code}</Link> : c.gw_code}
                    </TableCell>
                    <TableCell>{c.description}</TableCell>
                    <TableCell className="hidden md:table-cell">{c.drawing_revision ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{l.supplier_part_number ?? "—"}</TableCell>
                    <TableCell><CriticalityBadge value={c.criticality} /></TableCell>
                    {canManage && (
                      <TableCell>
                        <CancelRecordButton table="supplier_components" id={l.id} path={path} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
