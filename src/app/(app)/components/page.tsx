import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListFilters } from "@/components/shared/list-filters";
import { CriticalityBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAll, param } from "@/lib/filters";
import { ComponentFormDialog } from "./component-form-dialog";

export async function generateMetadata() {
  const t = await getTranslations("components");
  return { title: t("title") };
}

export default async function ComponentsPage({ searchParams }: PageProps<"/components">) {
  await requireProfile(["sqe", "sqm"]);
  const t = await getTranslations();
  const sp = await searchParams;
  const q = param(sp.q)?.trim();
  const crit = param(sp.criticality);
  const supplier = param(sp.supplier);

  const supabase = await createClient();
  let query = supabase
    .from("components")
    .select("id, gw_code, description, drawing_revision, criticality, supplier_components(supplier_id, cancelled_at, suppliers(legal_name, trade_name))")
    .is("cancelled_at", null)
    .order("gw_code");
  if (q) {
    const term = q.replace(/[%,()]/g, " ");
    query = query.or(`gw_code.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (!isAll(crit)) query = query.eq("criticality", crit!);

  const [{ data }, { data: suppliers }] = await Promise.all([
    query,
    supabase.from("suppliers").select("id, legal_name").is("cancelled_at", null).order("legal_name"),
  ]);
  let rows = (data ?? []).map((c) => ({
    ...c,
    links: (c.supplier_components ?? []).filter((l) => !l.cancelled_at),
  }));
  if (!isAll(supplier)) rows = rows.filter((c) => c.links.some((l) => l.supplier_id === supplier));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t("components.title")}
        description={t("components.subtitle")}
        actions={
          <ComponentFormDialog
            trigger={
              <Button>
                <PlusIcon />
                {t("components.new")}
              </Button>
            }
          />
        }
      />
      <ListFilters
        basePath="/components"
        q={q}
        placeholder={t("components.searchPlaceholder")}
        filters={[
          { name: "criticality", label: t("criticality.label"), value: crit,
            options: ["A", "B", "C"].map((c) => ({ value: c, label: t(`criticality.${c as "A"}`) })) },
          { name: "supplier", label: t("components.suppliers"), value: supplier,
            options: (suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name })) },
        ]}
      />
      <p className="text-sm text-muted-foreground">{t("common.results", { count: rows.length })}</p>
      {rows.length === 0 ? <EmptyState>{t("components.empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("components.gwCode")}</TableHead>
                <TableHead>{t("components.description")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("components.drawingRevision")}</TableHead>
                <TableHead>{t("components.criticality")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("components.suppliers")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className="relative">
                  <TableCell className="font-mono text-xs">
                    <Link href={`/components/${c.id}`} className="after:absolute after:inset-0 hover:underline">{c.gw_code}</Link>
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">{c.description}</TableCell>
                  <TableCell className="hidden md:table-cell">{c.drawing_revision ?? "—"}</TableCell>
                  <TableCell><CriticalityBadge value={c.criticality} /></TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.links.length === 0 && "—"}
                      {c.links.map((l) => (
                        <Badge key={l.supplier_id} variant="outline">{l.suppliers?.trade_name ?? l.suppliers?.legal_name}</Badge>
                      ))}
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
