import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToneBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getSupplierStatuses, lookupLabel } from "@/lib/lookups";

export async function HistoryTab({ supplierId }: { supplierId: string }) {
  const t = await getTranslations("suppliers");
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data }, statuses] = await Promise.all([
    supabase.from("supplier_status_history").select("id, from_status, to_status, justification, created_at, created_by")
      .eq("supplier_id", supplierId).order("created_at", { ascending: false }),
    getSupplierStatuses(true),
  ]);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const { data: users } = ids.length
    ? await supabase.from("users").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const byCode = new Map(statuses.map((s) => [s.code, s]));
  const badge = (code: string | null) => {
    if (!code) return "—";
    const s = byCode.get(code);
    return <ToneBadge tone={s?.tone ?? "neutral"}>{lookupLabel(s, locale)}</ToneBadge>;
  };

  if (rows.length === 0) return <EmptyState>{t("historyEmpty")}</EmptyState>;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("when")}</TableHead>
            <TableHead>{t("from")}</TableHead>
            <TableHead>{t("to")}</TableHead>
            <TableHead>{t("justification")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("changedBy")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">
                {format.dateTime(new Date(r.created_at), { dateStyle: "short", timeStyle: "short" })}
              </TableCell>
              <TableCell>{badge(r.from_status)}</TableCell>
              <TableCell>{badge(r.to_status)}</TableCell>
              <TableCell className="max-w-80 whitespace-normal">{r.justification ?? t("historyInitial")}</TableCell>
              <TableCell className="hidden md:table-cell">{(r.created_by && nameById.get(r.created_by)) ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
