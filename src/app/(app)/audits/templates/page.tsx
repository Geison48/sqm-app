import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog } from "@/components/shared/record-dialog";
import { ToneBadge } from "@/components/shared/badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createTemplate } from "@/lib/actions/audits";

const STATUS_TONE: Record<string, string> = { draft: "neutral", active: "success", retired: "neutral" };

export async function generateMetadata() {
  const t = await getTranslations("templates");
  return { title: t("title") };
}

export default async function TemplatesPage() {
  await requireProfile(["sqe", "sqm"]);
  const t = await getTranslations("templates");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.from("audit_templates").select("id, code, name_pt, name_en, method, version, status, audit_template_items(count)")
    .is("cancelled_at", null).is("audit_template_items.cancelled_at", null).order("code").order("version", { ascending: false });
  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={
        <RecordDialog trigger={<Button><PlusIcon />{t("new")}</Button>} title={t("new")} action={createTemplate} fields={[
          { name: "code", label: t("code"), required: true, span: 1, placeholder: "GWI-PROC" },
          { name: "method", label: t("method"), type: "select", required: true, span: 1, defaultValue: "gwi",
            options: (["gwi", "vda63"] as const).map((m) => ({ value: m, label: t(`methods.${m}`) })) },
          { name: "name_pt", label: t("namePt"), required: true },
          { name: "name_en", label: t("nameEn"), required: true },
          { name: "notes", label: t("notes"), type: "textarea" },
        ]} />
      } />
      {rows.length === 0 ? <EmptyState>{t("empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("code")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("method")}</TableHead>
                <TableHead>{t("version")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("items")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="relative">
                  <TableCell><Link href={`/audits/templates/${r.id}`} className="font-mono text-xs font-medium after:absolute after:inset-0 hover:underline">{r.code}</Link></TableCell>
                  <TableCell>{locale === "en" ? r.name_en : r.name_pt}</TableCell>
                  <TableCell className="hidden md:table-cell">{t(`methods.${r.method as "gwi"}`)}</TableCell>
                  <TableCell>v{r.version} <ToneBadge tone={STATUS_TONE[r.status]!}>{t(`statuses.${r.status as "draft"}`)}</ToneBadge></TableCell>
                  <TableCell className="hidden sm:table-cell">{r.audit_template_items?.[0]?.count ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
