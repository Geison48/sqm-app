import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListFilters } from "@/components/shared/list-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { DeadlineBadge, NcStatusBadge, SeverityBadge } from "@/components/shared/nc-badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, getNumericSetting, lookupLabel } from "@/lib/lookups";
import { deadlineState } from "@/lib/eight-d";
import { isAll, param } from "@/lib/filters";

export async function generateMetadata() {
  const t = await getTranslations("ncs");
  return { title: t("title") };
}

const STATUSES = ["open", "awaiting_sqe", "effectiveness_check", "closed"] as const;

export default async function NcsPage({ searchParams }: PageProps<"/ncs">) {
  const profile = await requireProfile();
  const internal = profile.role !== "supplier";
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const q = param(sp.q)?.trim();
  const supplier = param(sp.supplier);
  const status = param(sp.status);
  const severity = param(sp.severity);
  const overdueOnly = param(sp.overdue) === "1";

  const supabase = await createClient();
  let query = supabase.from("nc_overview").select("*").is("cancelled_at", null).order("opened_at", { ascending: false });
  if (q) {
    const term = q.replace(/[%,()]/g, " ");
    query = query.or(`number.ilike.%${term}%,title.ilike.%${term}%`);
  }
  if (!isAll(supplier)) query = query.eq("supplier_id", supplier!);
  if (!isAll(status)) query = query.eq("status", status!);
  else query = query.neq("status", "closed");
  if (!isAll(severity)) query = query.eq("severity_code", severity!);

  const [{ data }, severities, ratio, { data: suppliers }] = await Promise.all([
    query,
    getLookup("nc_severities"),
    getNumericSetting("deadline_warning_ratio", 0.25),
    internal
      ? supabase.from("suppliers").select("id, legal_name").is("cancelled_at", null).order("legal_name")
      : Promise.resolve({ data: [] as { id: string; legal_name: string }[] }),
  ]);
  let rows = (data ?? []).map((n) => ({
    ...n,
    deadline: deadlineState(n.next_due_at, n.opened_at!, {
      ratio, withSqe: n.pending_with === "sqe", done: n.status === "closed",
    }),
  }));
  if (overdueOnly) rows = rows.filter((n) => n.deadline === "overdue");

  const filters = [
    ...(internal ? [{ name: "supplier", label: t("ncs.supplier"), value: supplier,
      options: (suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name })) }] : []),
    { name: "status", label: t("ncs.status"), value: status, options: STATUSES.map((s) => ({ value: s, label: t(`ncs.statuses.${s}`) })) },
    { name: "severity", label: t("ncs.severity"), value: severity, options: severities.map((s) => ({ value: s.code, label: lookupLabel(s, locale) })) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t("ncs.title")}
        description={t("ncs.subtitle")}
        actions={internal ? <Button asChild><Link href="/ncs/new"><PlusIcon />{t("ncs.new")}</Link></Button> : undefined}
      />
      <ListFilters basePath="/ncs" q={q} placeholder={t("ncs.searchPlaceholder")} filters={filters}
        checkbox={{ name: "overdue", label: t("ncs.overdueOnly"), checked: overdueOnly }} />
      <p className="text-sm text-muted-foreground">{t("common.results", { count: rows.length })}</p>
      {rows.length === 0 ? <EmptyState>{t("ncs.empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ncs.number")}</TableHead>
                <TableHead>{t("ncs.ncTitle")}</TableHead>
                {internal && <TableHead className="hidden lg:table-cell">{t("ncs.supplier")}</TableHead>}
                <TableHead className="hidden md:table-cell">{t("ncs.severity")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("ncs.status")}</TableHead>
                <TableHead>{t("ncs.nextDeadline")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((n) => (
                <TableRow key={n.id} className="relative">
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/ncs/${n.id}`} className="font-mono text-xs font-medium after:absolute after:inset-0 hover:underline">{n.number}</Link>
                    <div className="text-xs text-muted-foreground">{t(`ncs.types.${n.type as "8d"}`)}</div>
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {n.title}
                    {n.gw_code && <div className="font-mono text-xs text-muted-foreground">{n.gw_code}</div>}
                  </TableCell>
                  {internal && <TableCell className="hidden lg:table-cell">{n.supplier_name}</TableCell>}
                  <TableCell className="hidden md:table-cell"><SeverityBadge code={n.severity_code!} /></TableCell>
                  <TableCell className="hidden md:table-cell"><NcStatusBadge status={n.status!} /></TableCell>
                  <TableCell><DeadlineBadge state={n.deadline} dueAt={n.next_due_at} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
