import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListFilters } from "@/components/shared/list-filters";
import { CriticalityBadge, ToneBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getInternalUsers, getSupplierStatuses, lookupLabel } from "@/lib/lookups";
import { countryName, formatTaxId, normalizeCnpj } from "@/lib/format";
import { isAll, param } from "@/lib/filters";
import { SupplierFormDialog } from "./supplier-form-dialog";

export async function generateMetadata() {
  const t = await getTranslations("suppliers");
  return { title: t("title") };
}

export default async function SuppliersPage({ searchParams }: PageProps<"/suppliers">) {
  const profile = await requireProfile();
  if (profile.role === "supplier") redirect(`/suppliers/${profile.supplierId}`);

  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const q = param(sp.q)?.trim();
  const status = param(sp.status);
  const crit = param(sp.criticality);
  const mine = param(sp.mine) === "1";

  const supabase = await createClient();
  let query = supabase
    .from("suppliers")
    .select("id, legal_name, trade_name, country_code, tax_id, criticality, status_code, users!suppliers_responsible_sqe_fkey(full_name)")
    .is("cancelled_at", null)
    .order("legal_name");
  if (q) {
    const term = q.replace(/[%,()]/g, " ");
    const taxTerm = normalizeCnpj(q);
    query = query.or(
      `legal_name.ilike.%${term}%,trade_name.ilike.%${term}%${taxTerm ? `,tax_id.ilike.%${taxTerm}%` : ""}`,
    );
  }
  if (!isAll(status)) query = query.eq("status_code", status!);
  if (!isAll(crit)) query = query.eq("criticality", crit!);
  if (mine) query = query.eq("responsible_sqe_id", profile.id);

  const [{ data: suppliers }, statuses, internalUsers] = await Promise.all([
    query,
    getSupplierStatuses(),
    getInternalUsers(),
  ]);
  const statusByCode = new Map(statuses.map((s) => [s.code, s]));
  const rows = suppliers ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t("suppliers.title")}
        description={t("suppliers.subtitle")}
        actions={
          <SupplierFormDialog
            mode="create"
            isSqm={profile.role === "sqm"}
            currentUserId={profile.id}
            statuses={statuses.map((s) => ({ value: s.code, label: lookupLabel(s, locale) }))}
            internalUsers={internalUsers.map((u) => ({ value: u.id, label: u.full_name }))}
            trigger={
              <Button>
                <PlusIcon />
                {t("suppliers.new")}
              </Button>
            }
          />
        }
      />

      <ListFilters
        basePath="/suppliers"
        q={q}
        placeholder={t("suppliers.searchPlaceholder")}
        filters={[
          {
            name: "status",
            label: t("suppliers.status"),
            value: status,
            options: statuses.map((s) => ({ value: s.code, label: lookupLabel(s, locale) })),
          },
          {
            name: "criticality",
            label: t("criticality.label"),
            value: crit,
            options: ["A", "B", "C"].map((c) => ({ value: c, label: t(`criticality.${c as "A"}`) })),
          },
        ]}
        checkbox={{ name: "mine", label: t("common.mine"), checked: mine }}
      />

      <p className="text-sm text-muted-foreground">{t("common.results", { count: rows.length })}</p>

      {rows.length === 0 ? (
        <EmptyState>{t("suppliers.empty")}</EmptyState>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("suppliers.legalName")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("suppliers.taxId")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("suppliers.country")}</TableHead>
                <TableHead>{t("criticality.label")}</TableHead>
                <TableHead>{t("suppliers.status")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("suppliers.responsibleSqe")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const st = statusByCode.get(s.status_code);
                return (
                  <TableRow key={s.id} className="relative">
                    <TableCell className="max-w-72">
                      <Link href={`/suppliers/${s.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                        {s.legal_name}
                      </Link>
                      {s.trade_name && <div className="truncate text-xs text-muted-foreground">{s.trade_name}</div>}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {formatTaxId(s.country_code, s.tax_id)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{countryName(s.country_code, locale)}</TableCell>
                    <TableCell>
                      <CriticalityBadge value={s.criticality} />
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={st?.tone ?? "neutral"}>{lookupLabel(st, locale)}</ToneBadge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{s.users?.full_name ?? "—"}</TableCell>
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
