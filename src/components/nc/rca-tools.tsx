"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/form-message";
import { saveRcaTool } from "@/lib/actions/ncs";
import { cn } from "@/lib/utils";

type ToolType = "ishikawa" | "5why_3legs" | "is_isnot";
type Json = Record<string, unknown>;

const SIX_M = ["method", "machine", "material", "manpower", "measurement", "environment"] as const;
const LEGS = ["occurrence", "non_detection", "systemic"] as const;
const DIMENSIONS = ["what", "where", "when", "extent"] as const;

// Ferramentas guiadas da D4: Ishikawa (6M), 5 Porquês em 3 pernas, É/Não é.
export function RcaTools({
  ncId, stepId, initial, editable,
}: { ncId: string; stepId: string; initial: Partial<Record<ToolType, Json>>; editable: boolean }) {
  const t = useTranslations("rca");
  const tr = useTranslations();
  const [tool, setTool] = useState<ToolType>("ishikawa");
  const [data, setData] = useState<Record<ToolType, Json>>({
    ishikawa: initial.ishikawa ?? {}, "5why_3legs": initial["5why_3legs"] ?? {}, is_isnot: initial.is_isnot ?? {},
  });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const current = data[tool];
  const update = (patch: Json) => setData((d) => ({ ...d, [tool]: { ...d[tool], ...patch } }));

  function save() {
    start(async () => {
      const result = await saveRcaTool({ ncId, stepId, toolType: tool, content: data[tool] });
      if (result?.error) return setError(result.error);
      setError(undefined);
      toast.success(tr(result!.success as never));
    });
  }

  const text = (value: unknown) => (typeof value === "string" ? value : "");

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{t("title")}</h3>
        <div className="inline-flex rounded-md border p-0.5">
          {(["ishikawa", "5why_3legs", "is_isnot"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTool(k)}
              className={cn("rounded px-3 py-1 text-sm", tool === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {t(`tools.${k}`)}
            </button>
          ))}
        </div>
      </div>

      {tool === "ishikawa" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("ishikawa.hint")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SIX_M.map((m) => {
              const lines = Array.isArray(current[m]) ? (current[m] as string[]) : [];
              return (
                <div key={m} className="space-y-1">
                  <Label htmlFor={`ish-${m}`}>{t(`ishikawa.${m}`)}</Label>
                  {editable ? (
                    <Textarea id={`ish-${m}`} rows={3} value={lines.join("\n")}
                      onChange={(e) => update({ [m]: e.target.value.split("\n") })} />
                  ) : (
                    <ul className="min-h-12 list-disc rounded-md border bg-muted/30 py-1 pr-2 pl-6 text-sm">
                      {lines.filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tool === "5why_3legs" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {LEGS.map((leg) => {
            const legData = (current[leg] ?? {}) as Json;
            const whys = Array.isArray(legData.whys) ? (legData.whys as string[]) : [];
            const setLeg = (patch: Json) => update({ [leg]: { ...legData, ...patch } });
            return (
              <div key={leg} className="space-y-2 rounded-md border p-3">
                <h4 className="text-sm font-medium">{t(`legs.${leg}`)}</h4>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t("why", { n: i + 1 })}</span>
                    {editable ? (
                      <Input value={whys[i] ?? ""} aria-label={`${t(`legs.${leg}`)} ${t("why", { n: i + 1 })}`}
                        onChange={(e) => { const next = [...whys]; next[i] = e.target.value; setLeg({ whys: next }); }} />
                    ) : <p className="text-sm">{whys[i] || "—"}</p>}
                  </div>
                ))}
                <div className="space-y-1">
                  <span className="text-xs font-medium">{t("rootCause")}</span>
                  {editable ? (
                    <Textarea rows={2} value={text(legData.root_cause)} aria-label={`${t(`legs.${leg}`)} ${t("rootCause")}`}
                      onChange={(e) => setLeg({ root_cause: e.target.value })} />
                  ) : <p className="text-sm font-medium">{text(legData.root_cause) || "—"}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tool === "is_isnot" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="p-1 font-medium">{t("isNot.dimension")}</th>
                <th className="p-1 font-medium">{t("isNot.is")}</th>
                <th className="p-1 font-medium">{t("isNot.isNot")}</th>
                <th className="p-1 font-medium">{t("isNot.distinction")}</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((dim) => {
                const row = (current[dim] ?? {}) as Json;
                return (
                  <tr key={dim} className="align-top">
                    <td className="p-1 font-medium">{t(`isNot.${dim}`)}</td>
                    {(["is", "is_not", "distinction"] as const).map((col) => (
                      <td key={col} className="p-1">
                        {editable ? (
                          <Textarea rows={2} value={text(row[col])} aria-label={`${t(`isNot.${dim}`)} ${col}`}
                            onChange={(e) => update({ [dim]: { ...row, [col]: e.target.value } })} />
                        ) : <p>{text(row[col]) || "—"}</p>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("attachHint")}</p>
          <div className="flex items-center gap-2">
            <FormMessage messageKey={error} />
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={save}>{t("save")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
