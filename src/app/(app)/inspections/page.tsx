import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListFilters } from "@/components/shared/list-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { ToneBadge } from "@/components/shared/badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { isAll, param } from "@/lib/filters";
import { createInspection } from "@/lib/actions/inspections";

const RESULT_TONE: Record<string, string> = { approved: "success", rejected: "danger", partial: "warning" };

export async function generateMetadata() {
  const t = await getTranslations("inspections");
  return { title: t("title") };
}

export default async function InspectionsPage({ searchParams }: PageProps<"/inspections">) {
  const profile = await requireProfile();
  const internal = profile.role !== "supplier";
  const t = await getTranslations("inspections");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const format = await getFormatter();
  const sp = await searchParams;
  const type = param(sp.type);
  const supabase = await createClient();

  let query = supabase.from("inspections")
    .select("id, number, type_code, inspected_on, status, result, location, suppliers(legal_name), components(gw_code)")
    .is("cancelled_at", null).order("inspected_on", { ascending: false }).order("number", { ascending: false });
  if (!isAll(type)) query = query.eq("type_code", type!);
  const [{ data }, types, { data: links }] = await Promise.all([
    query,
    getLookup("inspection_types"),
    supabase.from("supplier_components").select("supplier_id, suppliers(legal_name, responsible_sqe_id), components(id, gw_code, description)")
      .is("cancelled_at", null),
  ]);
  const rows = data ?? [];

  // Combinações fornecedor × componente que o usuário pode inspecionar.
  const options = (links ?? []).filter((l) => l.components && l.suppliers && (
    profile.role === "sqm" || (profile.role === "sqe" && l.suppliers.responsible_sqe_id === profile.id) || l.supplier_id === profile.supplierId
  ));
  const fields: FieldDef[] = [
    { name: "pair", label: `${t("supplier")} · ${t("component")}`, type: "select", required: true,
      options: options.map((l) => ({ value: `${l.supplier_id}|${l.components!.id}`,
        label: `${internal ? `${l.suppliers!.legal_name} · ` : ""}${l.components!.gw_code} — ${l.components!.description}` })) },
  ];
  if (internal) {
    fields.push({ name: "type_code", label: t("type"), type: "select", required: true, span: 1, defaultValue: "final_supplier",
      options: types.filter((x) => x.code !== "self_inspection").map((x) => ({ value: x.code, label: lookupLabel(x, locale) })) });
  }
  fields.push(
    { name: "inspected_on", label: t("date"), type: "date", required: true, span: 1, defaultValue: new Date().toISOString().slice(0, 10) },
    { name: "location", label: t("location") },
    { name: "notes", label: t("notes"), type: "textarea" },
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} actions={
        <RecordDialog trigger={<Button><PlusIcon />{internal ? t("new") : t("newSelf")}</Button>} title={internal ? t("new") : t("newSelf")}
          fields={fields} action={createInspection} />
      } />
      <ListFilters basePath="/inspections" placeholder={tc("search")} filters={[
        { name: "type", label: t("type"), value: type, options: types.map((x) => ({ value: x.code, label: lookupLabel(x, locale) })) },
      ]} />
      {rows.length === 0 ? <EmptyState>{t("empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("number")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                {internal && <TableHead className="hidden md:table-cell">{t("supplier")}</TableHead>}
                <TableHead className="hidden sm:table-cell">{t("component")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("date")}</TableHead>
                <TableHead>{t("result")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="relative">
                  <TableCell><Link href={`/inspections/${r.id}`} className="font-mono text-xs font-medium after:absolute after:inset-0 hover:underline">{r.number}</Link></TableCell>
                  <TableCell>{lookupLabel(types.find((x) => x.code === r.type_code), locale)}</TableCell>
                  {internal && <TableCell className="hidden md:table-cell">{r.suppliers?.legal_name}</TableCell>}
                  <TableCell className="hidden font-mono text-xs sm:table-cell">{r.components?.gw_code}</TableCell>
                  <TableCell className="hidden sm:table-cell">{format.dateTime(new Date(`${r.inspected_on}T12:00:00`), { dateStyle: "short" })}</TableCell>
                  <TableCell>
                    {r.result ? <ToneBadge tone={RESULT_TONE[r.result]!}>{t(`results.${r.result as "approved"}`)}</ToneBadge>
                      : <ToneBadge tone="info">{t(`statuses.${r.status as "in_progress"}`)}</ToneBadge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
