import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListFilters } from "@/components/shared/list-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAll, param } from "@/lib/filters";
import { StandardFormDialog } from "./standard-form-dialog";

const APPLICATIONS = ["product", "process", "system"] as const;

export async function generateMetadata() {
  const t = await getTranslations("standards");
  return { title: t("title") };
}

export default async function StandardsPage({ searchParams }: PageProps<"/standards">) {
  await requireProfile(["sqe", "sqm"]);
  const t = await getTranslations("standards");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const sp = await searchParams;
  const q = param(sp.q)?.trim();
  const application = param(sp.application);

  const supabase = await createClient();
  let query = supabase
    .from("standards")
    .select("id, code, revision, title_pt, title_en, application, issuer, standard_requirements(count)")
    .is("cancelled_at", null)
    .is("standard_requirements.cancelled_at", null)
    .order("code");
  if (q) {
    const term = q.replace(/[%,()]/g, " ");
    query = query.or(`code.ilike.%${term}%,title_pt.ilike.%${term}%,title_en.ilike.%${term}%`);
  }
  if (!isAll(application)) query = query.eq("application", application!);
  const { data } = await query;
  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<StandardFormDialog trigger={<Button><PlusIcon />{t("new")}</Button>} />}
      />
      <ListFilters
        basePath="/standards"
        q={q}
        placeholder={t("searchPlaceholder")}
        filters={[{ name: "application", label: t("application"), value: application,
          options: APPLICATIONS.map((a) => ({ value: a, label: t(`applications.${a}`) })) }]}
      />
      <p className="text-sm text-muted-foreground">{tc("results", { count: rows.length })}</p>
      {rows.length === 0 ? <EmptyState>{t("empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("code")}</TableHead>
                <TableHead>{t("title_")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("application")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("requirements")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className="relative">
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/standards/${s.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                      {[s.code, s.revision].filter(Boolean).join(":")}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-96 whitespace-normal">
                    {locale === "en" ? s.title_en : s.title_pt}
                    {s.issuer && <div className="text-xs text-muted-foreground">{s.issuer}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline">{t(`applications.${s.application as "product"}`)}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{s.standard_requirements?.[0]?.count ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
