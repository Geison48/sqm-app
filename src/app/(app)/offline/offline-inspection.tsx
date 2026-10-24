"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { offlineDb, type InspectionItemData, type InspectionValues, type Item, type Pack } from "@/lib/offline/db";
import { evaluateLocally, parseMeasured } from "@/lib/offline/evaluate";
import { recordChange } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";
import { OfflinePhotos } from "./photos";

// Resultados da inspeção sem sinal, por peça e característica. A avaliação
// pelos limites aparece como prévia; o banco confirma ao sincronizar.
export function OfflineInspection({ pack }: { pack: Pack }) {
  const t = useTranslations();
  const locale = useLocale();
  const items = useLiveQuery(() => offlineDb().items.where("pack").equals(pack.key).sortBy("order"), [pack.key], [] as Item[]);
  const changes = useLiveQuery(() => offlineDb().changes.where("pack").equals(pack.key).toArray(), [pack.key], []);
  const pending = useMemo(() => new Map(changes.map((c) => [c.key, c])), [changes]);
  const units = [...new Map(items.map((i) => [(i.data as InspectionItemData).unitId, (i.data as InspectionItemData).unitIdentifier])).entries()];

  async function save(item: Item, p: Partial<InspectionValues>) {
    const c = item.data as InspectionItemData;
    const current = item.values as InspectionValues;
    if (p.measured !== undefined && parseMeasured(p.measured) === null) return;
    const next = { ...current, ...p };
    const evaluated = evaluateLocally(c, next);
    await recordChange(offlineDb(), item.key, p, { ...next, ...evaluated });
  }
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{pack.number} · {pack.title}</p>
      {units.map(([unitId, identifier]) => (
        <section key={unitId} className="space-y-2 rounded-lg border p-3">
          <h2 className="font-mono font-medium">{identifier}</h2>
          <div className="divide-y rounded-md border">
            {items.filter((i) => (i.data as InspectionItemData).unitId === unitId).map((item) => {
              const c = item.data as InspectionItemData;
              const v = item.values as InspectionValues;
              const change = pending.get(item.key);
              const name = locale === "en" ? c.name_en : c.name_pt;
              const hasLimits = c.lower != null || c.upper != null;
              return (
                <div key={item.key} className={cn("grid gap-3 p-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]", v.ok === false && !v.waiver && "bg-red-50/60 dark:bg-red-950/20")}>
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span>{c.critical && <span className="text-red-600">◆ </span>}{name}</span>
                      {change && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t("offline.itemPending")}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[c.specification, hasLimits ? `[${c.lower ?? "−∞"} … ${c.upper ?? "+∞"}]${c.unit ? ` ${c.unit}` : ""}` : null,
                        c.sampling === "aql" ? `AQL · ${t("inspections.sampleInfo", { n: c.sampleSize ?? 0, ac: c.accept ?? 0 })}` : "100%"]
                        .filter(Boolean).join(" · ")}
                    </p>
                    {v.waiver && <p className="text-xs text-sky-700 dark:text-sky-400">{t("inspections.underWaiver", { number: v.waiver })}</p>}
                    {change?.error && <p className="text-xs text-red-600">{t("offline.notSent", { error: t(change.error as never) })}</p>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {hasLimits && (
                      <Input defaultValue={v.measured} placeholder={t("inspections.measured")} aria-label={`${name} ${t("inspections.measured")}`}
                        title={t("inspections.measuredHint")} inputMode="decimal"
                        onBlur={(e) => e.target.value !== v.measured && save(item, { measured: e.target.value })} />
                    )}
                    {(c.unitKind === "lot" || c.sampling === "aql") && (
                      <div className="flex gap-2">
                        <Input type="number" min={0} defaultValue={v.qty_inspected ?? ""} placeholder={t("inspections.qtyInspected")} aria-label={`${name} ${t("inspections.qtyInspected")}`}
                          onBlur={(e) => num(e.target.value) !== v.qty_inspected && save(item, { qty_inspected: num(e.target.value) })} />
                        <Input type="number" min={0} defaultValue={v.qty_nok ?? ""} placeholder={t("inspections.qtyNok")} aria-label={`${name} ${t("inspections.qtyNok")}`}
                          onBlur={(e) => num(e.target.value) !== v.qty_nok && save(item, { qty_nok: num(e.target.value) })} />
                      </div>
                    )}
                    <Input defaultValue={v.comment ?? ""} placeholder={t("inspections.comment")} aria-label={`${name} ${t("inspections.comment")}`} className="sm:col-span-2"
                      onBlur={(e) => e.target.value !== (v.comment ?? "") && save(item, { comment: e.target.value || null })} />
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="inline-flex overflow-hidden rounded-md border" role="group" aria-label={name}>
                      {([true, false] as const).map((ok) => (
                        <button key={String(ok)} type="button" disabled={v.auto || !!v.waiver} onClick={() => save(item, { ok })}
                          className={cn("h-9 px-3 text-sm font-medium disabled:cursor-default",
                            v.ok === ok ? (ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "text-muted-foreground")}>
                          {ok ? t("inspections.ok") : t("inspections.nok")}
                        </button>
                      ))}
                    </div>
                    {v.auto && <span className="self-center text-[10px] text-muted-foreground">{t("inspections.auto")}{change ? ` (${t("offline.localPreview")})` : ""}</span>}
                    <OfflinePhotos pack={pack.key} itemId={item.id} size="size-14" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
