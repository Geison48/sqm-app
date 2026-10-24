import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/badges";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { debitCost, respondCost, saveCost } from "@/lib/actions/ncs";
import type { Database } from "@/lib/database.types";
import type { NcRow } from "./types";

type Cost = Database["public"]["Tables"]["nc_costs"]["Row"];
const TONE: Record<string, string> = { launched: "info", accepted: "success", contested: "warning", debited: "neutral" };

// Regra 12: fornecedor aceita ou contesta; contestação volta ao SQE.
// Regra 1: custos não cobráveis (internos) a RLS nem entrega ao fornecedor.
export async function CostsTab({ nc, canManage, isOwnSupplier }: { nc: NcRow; canManage: boolean; isOwnSupplier: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data }, types] = await Promise.all([
    supabase.from("nc_costs").select("*").eq("nc_id", nc.id).is("cancelled_at", null).order("created_at"),
    getLookup("cost_types", true),
  ]);
  const costs = data ?? [];
  const money = (v: number, currency: string) => format.number(v, { style: "currency", currency });
  const path = `/ncs/${nc.id}?tab=costs`;
  const chargeableTotal = costs.filter((c) => c.chargeable).reduce((a, c) => a + Number(c.amount), 0);
  const currency = costs[0]?.currency ?? "BRL";

  const fields = (c?: Cost): FieldDef[] => [
    { name: "cost_type_code", label: t("costs.type"), type: "select", required: true, span: 1,
      options: types.filter((x) => !x.cancelled_at).map((x) => ({ value: x.code, label: lookupLabel(x, locale) })), defaultValue: c?.cost_type_code },
    { name: "currency", label: t("costs.currency"), required: true, span: 1, defaultValue: c?.currency ?? "BRL" },
    { name: "description", label: t("costs.description"), required: true, defaultValue: c?.description },
    { name: "quantity", label: t("costs.quantity"), type: "number", step: "0.01", required: true, span: 1, defaultValue: c?.quantity ?? 1 },
    { name: "unit_amount", label: t("costs.unitAmount"), type: "number", step: "0.01", required: true, span: 1, defaultValue: c?.unit_amount },
    { name: "chargeable", label: t("costs.chargeable"), type: "checkbox", defaultValue: c?.chargeable ?? true, hint: t("costs.internalHint") },
  ];

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{t("costs.internalHint")}</p>
          <RecordDialog trigger={<AddButton label={t("costs.add")} />} title={t("costs.add")} hidden={{ nc_id: nc.id }}
            action={saveCost} fields={fields()} />
        </div>
      )}
      {costs.length === 0 ? <EmptyState>{t("costs.empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("costs.description")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("costs.type")}</TableHead>
                <TableHead className="text-right">{t("costs.amount")}</TableHead>
                <TableHead>{t("costs.status")}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((c) => (
                <TableRow key={c.id} className="align-top">
                  <TableCell className="max-w-72 whitespace-normal">
                    <div className="font-medium">{c.description}</div>
                    <div className="text-xs text-muted-foreground">{c.quantity} × {money(Number(c.unit_amount), c.currency)}</div>
                    {!c.chargeable && <Badge variant="secondary" className="mt-1">{t("costs.internalBadge")}</Badge>}
                    {c.supplier_response && (
                      <p className="mt-1 text-xs"><span className="font-medium">{t("costs.supplierResponse")}:</span> {c.supplier_response}</p>
                    )}
                    {c.sqe_decision_comment && (
                      <p className="mt-1 text-xs"><span className="font-medium">{t("costs.decisionComment")}:</span> {c.sqe_decision_comment}</p>
                    )}
                    {canManage && c.status === "contested" && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("costs.contestedHint")}</p>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{lookupLabel(types.find((x) => x.code === c.cost_type_code), locale)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{money(Number(c.amount), c.currency)}</TableCell>
                  <TableCell>{c.chargeable ? <ToneBadge tone={TONE[c.status]!}>{t(`costs.statuses.${c.status as "launched"}`)}</ToneBadge> : "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      {isOwnSupplier && c.chargeable && c.status === "launched" && (
                        <>
                          <RecordDialog trigger={<Button size="sm">{t("costs.accept")}</Button>} title={t("costs.accept")}
                            description={`${c.description} — ${money(Number(c.amount), c.currency)}`}
                            hidden={{ id: c.id, nc_id: nc.id, decision: "accept" }} action={respondCost} fields={[]} submitLabel={t("costs.accept")} />
                          <RecordDialog trigger={<Button size="sm" variant="outline">{t("costs.contest")}</Button>} title={t("costs.contestTitle")}
                            description={`${c.description} — ${money(Number(c.amount), c.currency)}`}
                            hidden={{ id: c.id, nc_id: nc.id, decision: "contest" }} action={respondCost} submitLabel={t("costs.contest")}
                            fields={[{ name: "justification", label: t("costs.justification"), type: "textarea", required: true }]} />
                        </>
                      )}
                      {canManage && c.chargeable && (c.status === "accepted" || c.status === "contested") && (
                        <RecordDialog trigger={<Button size="sm" variant="outline">{t("costs.debit")}</Button>} title={t("costs.debitTitle")}
                          hidden={{ id: c.id, nc_id: nc.id }} action={debitCost}
                          fields={[{ name: "sqe_decision_comment", label: t("costs.decisionComment"), type: "textarea",
                            required: c.status === "contested" }]} />
                      )}
                      {canManage && c.status !== "debited" && (
                        <>
                          <RecordDialog trigger={<EditButton label={t("costs.edit")} />} title={t("costs.edit")}
                            hidden={{ id: c.id, nc_id: nc.id }} action={saveCost} fields={fields(c)} />
                          <CancelRecordButton table="nc_costs" id={c.id} path={path} />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>{t("costs.total")}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{money(chargeableTotal, currency)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
