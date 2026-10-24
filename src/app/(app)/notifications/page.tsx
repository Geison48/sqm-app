import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BellIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { MarkAllReadButton, MarkReadButton } from "./notification-buttons";

export async function generateMetadata() {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, event_code, params, link_path, read_at, created_at")
    .eq("recipient_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const unread = rows.filter((r) => !r.read_at).length;

  function message(code: string, params: Record<string, unknown>) {
    const key = `events.${code}` as "events.certificate_expired";
    if (!t.has(key)) return code;
    const validUntil = typeof params.validUntil === "string"
      ? format.dateTime(new Date(`${params.validUntil}T12:00:00`), { dateStyle: "short" })
      : "—";
    // Repassa todos os parâmetros do evento (texto) + os que precisam de formatação.
    const values: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) values[k] = typeof v === "number" ? v : String(v ?? "");
    return t(key, { ...values, days: Number(params.days ?? 0), validUntil } as never);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t("title")}
        description={t("unreadCount", { count: unread })}
        actions={unread > 0 ? <MarkAllReadButton /> : undefined}
      />
      {rows.length === 0 ? <EmptyState>{t("empty")}</EmptyState> : (
        <ul className="divide-y rounded-lg border">
          {rows.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.read_at && "bg-muted/50")}>
              <BellIcon className={cn("mt-0.5 size-4 shrink-0", n.read_at ? "text-muted-foreground" : "text-primary")} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className={cn("text-sm", !n.read_at && "font-medium")}>
                  {n.link_path ? (
                    <Link href={n.link_path} className="hover:underline">{message(n.event_code, n.params as Record<string, unknown>)}</Link>
                  ) : message(n.event_code, n.params as Record<string, unknown>)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(n.created_at), { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              {!n.read_at && <MarkReadButton id={n.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
