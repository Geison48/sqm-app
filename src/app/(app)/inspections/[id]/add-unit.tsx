"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addInspectionUnit } from "@/lib/actions/inspections";

export function AddUnit({ inspectionId, units, hint }: { inspectionId: string; units: { id: string; identifier: string }[]; hint: string }) {
  const t = useTranslations();
  const [unitId, setUnitId] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
      <select value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label={t("inspections.addUnit")}
        className="h-9 min-w-48 rounded-md border border-input bg-transparent px-2 text-sm">
        <option value="">{units.length ? t("inspections.addUnit") : t("inspections.noEligible")}</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.identifier}</option>)}
      </select>
      <Button size="sm" disabled={!unitId || pending} onClick={() => start(async () => {
        const r = await addInspectionUnit(inspectionId, unitId);
        if (r?.error) return void toast.error(t(r.error as never));
        setUnitId("");
      })}><PlusIcon />{t("inspections.addUnit")}</Button>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}
