import { getFormatter, getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/server";

const HIDDEN_FIELDS = new Set(["id", "created_at", "updated_at", "created_by", "updated_by", "supplier_id"]);

function show(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Regra 16: tudo aparece no log (quem, quando, antes e depois). Só internos.
export async function LogTab({ supplierId }: { supplierId: string }) {
  const t = await getTranslations("log");
  const format = await getFormatter();
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, table_name, action, changed_fields, before, after, actor_id, at")
    .eq("supplier_id", supplierId)
    .order("at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: users } = ids.length
    ? await supabase.from("users").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  if (rows.length === 0) return <EmptyState>{t("empty")}</EmptyState>;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("when")}</TableHead>
            <TableHead>{t("what")}</TableHead>
            <TableHead>{t("fields")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("who")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const before = (r.before ?? {}) as Record<string, unknown>;
            const after = (r.after ?? {}) as Record<string, unknown>;
            const fields = r.changed_fields.filter((f) => !HIDDEN_FIELDS.has(f));
            return (
              <TableRow key={r.id} className="align-top">
                <TableCell className="whitespace-nowrap">
                  {format.dateTime(new Date(r.at), { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="font-medium">{t(`actions.${r.action as "insert"}`)}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.has(`tables.${r.table_name}` as never) ? t(`tables.${r.table_name}` as never) : r.table_name}
                  </div>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal">
                  {r.action === "insert" ? (
                    <span className="text-xs text-muted-foreground">
                      {show(after.legal_name ?? after.name ?? after.full_name ?? after.standard_name ?? after.file_name)}
                    </span>
                  ) : (
                    <ul className="space-y-0.5 text-xs">
                      {fields.map((f) => (
                        <li key={f}>
                          <span className="font-mono">{f}</span>: <span className="text-muted-foreground line-through">{show(before[f])}</span>{" "}
                          → <span>{show(after[f])}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">{(r.actor_id && nameById.get(r.actor_id)) ?? t("system")}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
