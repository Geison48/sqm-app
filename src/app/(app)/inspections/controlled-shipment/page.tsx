import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Períodos de embarque controlado e as inspeções feitas em cada um.
export default async function ControlledShipmentPage() {
  const profile = await requireProfile();
  const t = await getTranslations();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data: periods }, { data: inspections }] = await Promise.all([
    supabase.from("controlled_shipment_periods").select("*, suppliers(legal_name)").is("cancelled_at", null).order("started_at", { ascending: false }),
    supabase.from("inspections").select("id, number, supplier_id, completed_at, result, type_code").eq("status", "completed").is("cancelled_at", null),
  ]);
  const dt = (v: string | null) => (v ? format.dateTime(new Date(v), { dateStyle: "short" }) : "—");

  return (
    <>
      <PageHeader title={t("controlled.title")} description={t("controlled.hint")} />
      {(periods ?? []).length === 0 ? <EmptyState>{t("controlled.empty")}</EmptyState> : (
        <ul className="space-y-3">
          {(periods ?? []).map((p) => {
            // Inspeções concluídas entre a entrada e a saída.
            const start = new Date(p.started_at).getTime();
            const end = p.ended_at ? new Date(p.ended_at).getTime() : Infinity;
            const inPeriod = (inspections ?? []).filter((i) => {
              const at = i.completed_at ? new Date(i.completed_at).getTime() : NaN;
              return i.supplier_id === p.supplier_id && at >= start && at <= end;
            });
            return (
              <li key={p.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {profile.role !== "supplier"
                    ? <Link href={`/suppliers/${p.supplier_id}?tab=history`} className="font-medium hover:underline">{p.suppliers?.legal_name}</Link>
                    : <span className="font-medium">{p.suppliers?.legal_name}</span>}
                  {!p.ended_at && <ToneBadge tone="warning">{t("controlled.open")}</ToneBadge>}
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground uppercase">{t("controlled.startedAt")}</dt><dd>{dt(p.started_at)} — {p.start_reason}</dd></div>
                  <div><dt className="text-xs text-muted-foreground uppercase">{t("controlled.endedAt")}</dt><dd>{p.ended_at ? `${dt(p.ended_at)} — ${p.end_reason}` : "—"}</dd></div>
                </dl>
                <div className="text-sm">
                  <span className="text-xs text-muted-foreground uppercase">{t("controlled.inspections")}: </span>
                  {inPeriod.length === 0 ? "—" : inPeriod.map((i, idx) => (
                    <span key={i.id}>{idx > 0 && ", "}<Link href={`/inspections/${i.id}`} className="font-mono text-xs hover:underline">{i.number}</Link>
                      {i.result && ` (${t(`inspections.results.${i.result as "approved"}`)})`}</span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
