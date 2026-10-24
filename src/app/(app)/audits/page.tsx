import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { CalendarRangeIcon, ListChecksIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListFilters } from "@/components/shared/list-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog } from "@/components/shared/record-dialog";
import { AuditStatusBadge, ClassificationBadge } from "@/components/audit/audit-badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { isAll, param } from "@/lib/filters";
import { createAudit } from "@/lib/actions/audits";
import { auditFields } from "./audit-form";

export async function generateMetadata() {
  const t = await getTranslations("audits");
  return { title: t("title") };
}

const STATUSES = ["planned", "scheduled", "in_progress", "completed", "closed"] as const;

export default async function AuditsPage({ searchParams }: PageProps<"/audits">) {
  const profile = await requireProfile();
  const internal = profile.role !== "supplier";
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const sp = await searchParams;
  const q = param(sp.q)?.trim();
  const status = param(sp.status);
  const type = param(sp.type);
  const year = param(sp.year);

  const supabase = await createClient();
  let query = supabase.from("audits")
    .select("id, number, type_code, planned_start, planned_end, status, score_percent, classification, suppliers(legal_name), cancelled_at")
    .is("cancelled_at", null).order("planned_start", { ascending: false });
  if (!isAll(status)) query = query.eq("status", status!);
  if (!isAll(type)) query = query.eq("type_code", type!);
  if (!isAll(year)) query = query.gte("planned_start", `${year}-01-01`).lte("planned_start", `${year}-12-31`);
  const [{ data }, types] = await Promise.all([query, getLookup("audit_types")]);
  let rows = data ?? [];
  if (q) {
    const term = q.toLowerCase();
    rows = rows.filter((a) => a.number.toLowerCase().includes(term) || a.suppliers?.legal_name.toLowerCase().includes(term));
  }
  const currentYear = new Date().getFullYear();
  const newAudit = internal ? await auditFields(profile) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t("audits.title")}
        description={t("audits.subtitle")}
        actions={internal ? (
          <>
            <Button variant="outline" asChild><Link href="/audits/plan"><CalendarRangeIcon />{t("audits.plan")}</Link></Button>
            <Button variant="outline" asChild><Link href="/audits/templates"><ListChecksIcon />{t("audits.templates")}</Link></Button>
            <RecordDialog trigger={<Button><PlusIcon />{t("audits.new")}</Button>} title={t("audits.new")}
              description={t("audits.newDescription")} fields={newAudit!.fields} action={createAudit}
              hidden={{ scopes_present: "1", auditors_present: "1" }} />
          </>
        ) : undefined}
      />
      <ListFilters basePath="/audits" q={q} placeholder={t("audits.searchPlaceholder")} filters={[
        { name: "status", label: t("audits.status"), value: status, options: STATUSES.map((s) => ({ value: s, label: t(`audits.statuses.${s}`) })) },
        { name: "type", label: t("audits.type"), value: type, options: types.map((x) => ({ value: x.code, label: lookupLabel(x, locale) })) },
        { name: "year", label: t("audits.year"), value: year,
          options: [currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => ({ value: String(y), label: String(y) })) },
      ]} />
      <p className="text-sm text-muted-foreground">{t("common.results", { count: rows.length })}</p>
      {rows.length === 0 ? <EmptyState>{t("audits.empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("audits.number")}</TableHead>
                {internal && <TableHead>{t("audits.supplier")}</TableHead>}
                <TableHead className="hidden md:table-cell">{t("audits.type")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("audits.plannedStart")}</TableHead>
                <TableHead>{t("audits.status")}</TableHead>
                <TableHead>{t("audits.classification")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} className="relative">
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/audits/${a.id}`} className="font-mono text-xs font-medium after:absolute after:inset-0 hover:underline">{a.number}</Link>
                  </TableCell>
                  {internal && <TableCell className="max-w-56 whitespace-normal">{a.suppliers?.legal_name}</TableCell>}
                  <TableCell className="hidden md:table-cell">{lookupLabel(types.find((x) => x.code === a.type_code), locale)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{format.dateTime(new Date(`${a.planned_start}T12:00:00`), { dateStyle: "short" })}</TableCell>
                  <TableCell><AuditStatusBadge status={a.status} /></TableCell>
                  <TableCell><ClassificationBadge value={a.classification} percent={a.score_percent} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
