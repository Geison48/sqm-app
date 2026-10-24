"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PhotoUpload } from "@/components/shared/photo-upload";
import { saveResult } from "@/lib/actions/inspections";
import { cn } from "@/lib/utils";

type Result = {
  id: string; measured: string; qty_inspected: number | null; qty_nok: number | null; ok: boolean | null; auto: boolean;
  comment: string | null; waiver: string | null;
};
type Characteristic = {
  name: string; spec: string | null; lower: number | null; upper: number | null; unit: string | null; sampling: string;
  sampleSize: number | null; accept: number | null; critical: boolean; isLot: boolean;
};

// Uma característica de uma peça: medição, OK/NOK, comentário e fotos.
export function ResultRow({ result, characteristic: c, editable, supplierId, inspectionId, photos, waiverAction }: {
  result: Result; characteristic: Characteristic; editable: boolean; supplierId: string; inspectionId: string;
  photos: { url: string; name: string }[]; waiverAction: ReactNode;
}) {
  const t = useTranslations();
  const [state, setState] = useState(result);
  const [, start] = useTransition();
  const router = useRouter();
  const hasLimits = c.lower != null || c.upper != null;

  function save(patch: Partial<{ measured: string; qty_inspected: number | null; qty_nok: number | null; ok: boolean | null; comment: string | null }>) {
    start(async () => {
      const r = await saveResult({ id: state.id, inspectionId, ...patch });
      if (r.error) return void toast.error(t(r.error as never));
      setState((s) => ({ ...s, ...patch, ok: r.ok ?? null, auto: !!r.auto }));
      // OK/NOK mudou: atualiza o servidor (botão de concessão, link de NC).
      if ((r.ok ?? null) !== state.ok) router.refresh();
    });
  }
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className={cn("grid gap-3 p-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]", state.ok === false && !state.waiver && "bg-red-50/60 dark:bg-red-950/20")}>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{c.critical && <span className="text-red-600">◆ </span>}{c.name}</p>
        <p className="text-xs text-muted-foreground">
          {[c.spec, hasLimits ? `[${c.lower ?? "−∞"} … ${c.upper ?? "+∞"}]${c.unit ? ` ${c.unit}` : ""}` : null,
            c.sampling === "aql" ? `AQL · ${t("inspections.sampleInfo", { n: c.sampleSize ?? 0, ac: c.accept ?? 0 })}` : "100%"]
            .filter(Boolean).join(" · ")}
        </p>
        {state.waiver && <p className="text-xs text-sky-700 dark:text-sky-400">{t("inspections.underWaiver", { number: state.waiver })}</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {hasLimits && (
          <Input defaultValue={state.measured} disabled={!editable} placeholder={t("inspections.measured")} aria-label={`${c.name} ${t("inspections.measured")}`}
            title={t("inspections.measuredHint")} inputMode="decimal"
            onBlur={(e) => e.target.value !== state.measured && save({ measured: e.target.value })} />
        )}
        {(c.isLot || c.sampling === "aql") && (
          <div className="flex gap-2">
            <Input type="number" min={0} defaultValue={state.qty_inspected ?? ""} disabled={!editable} aria-label={`${c.name} ${t("inspections.qtyInspected")}`}
              placeholder={t("inspections.qtyInspected")} onBlur={(e) => num(e.target.value) !== state.qty_inspected && save({ qty_inspected: num(e.target.value) })} />
            <Input type="number" min={0} defaultValue={state.qty_nok ?? ""} disabled={!editable} aria-label={`${c.name} ${t("inspections.qtyNok")}`}
              placeholder={t("inspections.qtyNok")} onBlur={(e) => num(e.target.value) !== state.qty_nok && save({ qty_nok: num(e.target.value) })} />
          </div>
        )}
        <Input defaultValue={state.comment ?? ""} disabled={!editable} placeholder={t("inspections.comment")} aria-label={`${c.name} ${t("inspections.comment")}`}
          className="sm:col-span-2" onBlur={(e) => e.target.value !== (state.comment ?? "") && save({ comment: e.target.value || null })} />
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <div className="inline-flex overflow-hidden rounded-md border" role="group" aria-label={c.name}>
          {([true, false] as const).map((v) => (
            <button key={String(v)} type="button" disabled={!editable || state.auto} onClick={() => save({ ok: v })}
              className={cn("h-9 px-3 text-sm font-medium disabled:cursor-default",
                state.ok === v ? (v ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "text-muted-foreground")}>
              {v ? t("inspections.ok") : t("inspections.nok")}
            </button>
          ))}
        </div>
        {state.auto && <span className="self-center text-[10px] text-muted-foreground">{t("inspections.auto")}</span>}
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={p.url} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.name} className="size-14 rounded-md border object-cover" /></a>
        ))}
        {editable && <PhotoUpload target={{ entityTable: "inspection_results", entityId: state.id, supplierId, path: `/inspections/${inspectionId}` }}
          label={t("inspections.photos")} />}
        {waiverAction}
      </div>
    </div>
  );
}
