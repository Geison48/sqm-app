import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListFilters } from "@/components/shared/list-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog } from "@/components/shared/record-dialog";
import { UnitTag } from "@/components/shared/unit-tag";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAll, param } from "@/lib/filters";
import { registerUnit } from "@/lib/actions/inspections";

export default async function UnitsPage({ searchParams }: PageProps<"/inspections/units">) {
  const profile = await requireProfile();
  const internal = profile.role !== "supplier";
  const t = await getTranslations();
  const format = await getFormatter();
  const sp = await searchParams;
  const q = param(sp.q)?.trim();
  const tag = param(sp.tag);
  const supabase = await createClient();
  let query = supabase.from("serial_units")
    .select("id, identifier, kind, quantity, tag, scrapped, production_date, suppliers(legal_name), components(gw_code)")
    .is("cancelled_at", null).order("created_at", { ascending: false }).limit(300);
  if (q) query = query.ilike("identifier", `%${q.replace(/[%,]/g, "")}%`);
  if (!isAll(tag)) query = tag === "none" ? query.is("tag", null) : query.eq("tag", tag!);
  const [{ data }, { data: links }] = await Promise.all([
    query,
    supabase.from("supplier_components").select("supplier_id, suppliers(legal_name, responsible_sqe_id), components(id, gw_code, description)").is("cancelled_at", null),
  ]);
  const options = (links ?? []).filter((l) => l.components && l.suppliers && (
    profile.role === "sqm" || (profile.role === "sqe" && l.suppliers.responsible_sqe_id === profile.id) || l.supplier_id === profile.supplierId));
  const rows = data ?? [];

  return (
    <>
      <PageHeader title={t("units.title")} actions={
        <RecordDialog trigger={<Button><PlusIcon />{t("units.register")}</Button>} title={t("units.register")} action={registerUnit}
          fields={[
            { name: "pair", label: `${t("inspections.supplier")} · ${t("inspections.component")}`, type: "select", required: true,
              options: options.map((l) => ({ value: `${l.supplier_id}|${l.components!.id}`,
                label: `${internal ? `${l.suppliers!.legal_name} · ` : ""}${l.components!.gw_code} — ${l.components!.description}` })) },
            { name: "identifier", label: t("units.identifier"), required: true, span: 1 },
            { name: "kind", label: t("units.kind"), type: "select", required: true, span: 1, defaultValue: "serial",
              options: (["serial", "lot"] as const).map((k) => ({ value: k, label: t(`units.kinds.${k}`) })) },
            { name: "quantity", label: t("units.quantity"), type: "number", span: 1, hint: t("units.kinds.lot") },
            { name: "production_date", label: t("units.productionDate"), type: "date", span: 1 },
            { name: "notes", label: t("units.notes"), type: "textarea" },
          ]} />
      } />
      <ListFilters basePath="/inspections/units" q={q} placeholder={t("units.searchPlaceholder")} filters={[
        { name: "tag", label: t("units.tag"), value: tag,
          options: (["green", "yellow", "red", "none"] as const).map((x) => ({ value: x, label: t(`units.tagShort.${x}`) })) },
      ]} />
      {rows.length === 0 ? <EmptyState>{t("units.empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("units.identifier")}</TableHead>
                <TableHead>{t("units.tag")}</TableHead>
                {internal && <TableHead className="hidden md:table-cell">{t("inspections.supplier")}</TableHead>}
                <TableHead className="hidden sm:table-cell">{t("inspections.component")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("units.productionDate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id} className="relative">
                  <TableCell>
                    <Link href={`/inspections/units/${u.id}`} className="font-mono text-xs font-medium after:absolute after:inset-0 hover:underline">{u.identifier}</Link>
                    {u.kind === "lot" && <div className="text-xs text-muted-foreground">{t("units.kinds.lot")} · {u.quantity}</div>}
                  </TableCell>
                  <TableCell><UnitTag tag={u.tag} scrapped={u.scrapped} /></TableCell>
                  {internal && <TableCell className="hidden md:table-cell">{u.suppliers?.legal_name}</TableCell>}
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{u.components?.gw_code}</TableCell>
                  <TableCell className="hidden lg:table-cell">{u.production_date ? format.dateTime(new Date(`${u.production_date}T12:00:00`), { dateStyle: "short" }) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
