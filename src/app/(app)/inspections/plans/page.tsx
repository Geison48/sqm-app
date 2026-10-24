import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog } from "@/components/shared/record-dialog";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createPlan } from "@/lib/actions/inspections";

export default async function PlansPage() {
  const profile = await requireProfile();
  const internal = profile.role !== "supplier";
  const t = await getTranslations();
  const supabase = await createClient();
  const [{ data: components }, { data: plans }] = await Promise.all([
    supabase.from("components").select("id, gw_code, description").is("cancelled_at", null).order("gw_code"),
    supabase.from("inspection_plans").select("id, component_id, revision, inspection_characteristics(count)")
      .eq("active", true).is("cancelled_at", null).is("inspection_characteristics.cancelled_at", null),
  ]);
  const planByComponent = new Map((plans ?? []).map((p) => [p.component_id, p]));
  const rows = components ?? [];

  return (
    <>
      <PageHeader title={t("inspPlans.title")} />
      {rows.length === 0 ? <EmptyState>—</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("inspPlans.component")}</TableHead>
                <TableHead>{t("inspPlans.revision")}</TableHead>
                <TableHead>{t("inspPlans.characteristics")}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const plan = planByComponent.get(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-80 whitespace-normal"><span className="font-mono text-xs">{c.gw_code}</span> {c.description}</TableCell>
                    <TableCell>{plan ? plan.revision : <span className="text-muted-foreground">{t("inspPlans.noPlan")}</span>}</TableCell>
                    <TableCell>{plan ? plan.inspection_characteristics?.[0]?.count ?? 0 : "—"}</TableCell>
                    <TableCell>
                      {plan ? (
                        <Button size="sm" variant="outline" asChild><Link href={`/inspections/plans/${plan.id}`}>{t("common.open")}</Link></Button>
                      ) : internal ? (
                        <RecordDialog trigger={<Button size="sm">{t("inspPlans.create")}</Button>} title={`${t("inspPlans.create")} — ${c.gw_code}`}
                          hidden={{ component_id: c.id }} action={createPlan} fields={[
                            { name: "revision", label: t("inspPlans.revision"), required: true, span: 1, defaultValue: "A" },
                            { name: "notes", label: t("inspPlans.notes"), type: "textarea" },
                          ]} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
