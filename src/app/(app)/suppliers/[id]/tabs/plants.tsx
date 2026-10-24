import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/server";
import { savePlant } from "@/lib/actions/suppliers";
import { countryName, countryOptions } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Plant = Database["public"]["Tables"]["plants"]["Row"];

export async function PlantsTab({ supplierId, canManage }: { supplierId: string; canManage: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.from("plants").select("*").eq("supplier_id", supplierId).is("cancelled_at", null)
    .order("is_main", { ascending: false }).order("name");
  const plants = data ?? [];
  const path = `/suppliers/${supplierId}?tab=plants`;

  const fields = (p?: Plant): FieldDef[] => [
    { name: "name", label: t("plants.name"), required: true, defaultValue: p?.name },
    { name: "address_line", label: t("plants.address"), defaultValue: p?.address_line },
    { name: "city", label: t("plants.city"), span: 1, defaultValue: p?.city },
    { name: "state", label: t("plants.state"), span: 1, defaultValue: p?.state },
    { name: "postal_code", label: t("plants.postalCode"), span: 1, defaultValue: p?.postal_code },
    { name: "country_code", label: t("plants.country"), type: "select", required: true, span: 1,
      options: countryOptions(locale), defaultValue: p?.country_code ?? "BR" },
    { name: "is_main", label: t("plants.main"), type: "checkbox", defaultValue: p?.is_main },
    { name: "notes", label: t("plants.notes"), type: "textarea", defaultValue: p?.notes },
  ];

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <RecordDialog trigger={<AddButton label={t("plants.add")} />} title={t("plants.add")} fields={fields()}
            hidden={{ supplier_id: supplierId }} action={savePlant} />
        </div>
      )}
      {plants.length === 0 ? <EmptyState>{t("plants.empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("plants.name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("plants.address")}</TableHead>
                <TableHead>{t("plants.city")}</TableHead>
                {canManage && <TableHead className="w-0" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-medium">{p.name}</span>{" "}
                    {p.is_main && <Badge variant="secondary">{t("plants.main")}</Badge>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{p.address_line ?? "—"}</TableCell>
                  <TableCell>
                    {[p.city, p.state].filter(Boolean).join(" / ") || "—"}
                    <div className="text-xs text-muted-foreground">{countryName(p.country_code, locale)}</div>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex flex-wrap justify-end">
                        <RecordDialog trigger={<EditButton label={t("plants.edit")} />} title={t("plants.edit")}
                          fields={fields(p)} hidden={{ id: p.id, supplier_id: supplierId }} action={savePlant} />
                        <CancelRecordButton table="plants" id={p.id} path={path} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
