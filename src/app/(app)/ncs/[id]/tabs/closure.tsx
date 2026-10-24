import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { RecordDialog } from "@/components/shared/record-dialog";
import { createClient } from "@/lib/supabase/server";
import { d7Complete, type StepContent } from "@/lib/eight-d";
import { close8d, saveEffectiveness } from "@/lib/actions/ncs";
import { cn } from "@/lib/utils";
import type { NcRow } from "./types";

// Regra 7: checklist de fechamento + eficácia + lição aprendida.
export async function ClosureTab({ nc, canManage }: { nc: NcRow; canManage: boolean }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data: steps }, { data: lesson }, { data: verifier }] = await Promise.all([
    supabase.from("eight_d_steps").select("discipline, status, content").eq("nc_id", nc.id),
    supabase.from("lessons_learned").select("*").eq("nc_id", nc.id).maybeSingle(),
    nc.effectiveness_verified_by
      ? supabase.from("users").select("full_name").eq("id", nc.effectiveness_verified_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const byD = new Map((steps ?? []).map((s) => [s.discipline, s]));
  const allApproved = (steps ?? []).length === 9 && (steps ?? []).every((s) => s.status === "approved");
  const d7 = (byD.get("D7")?.content ?? {}) as StepContent;
  const d4 = (byD.get("D4")?.content ?? {}) as StepContent;
  const d5 = (byD.get("D5")?.content ?? {}) as StepContent;
  const firstAction = Array.isArray(d5.actions) ? String((d5.actions as Record<string, string>[])[0]?.action ?? "") : "";
  const date = (v: string | null) => (v ? format.dateTime(new Date(v), { dateStyle: "short" }) : "—");

  const checks: [string, boolean][] = [
    [t("closure.reqDisciplines"), allApproved],
    [t("closure.reqD7"), byD.get("D7")?.status === "approved" && d7Complete(d7)],
    [t("closure.reqEffectiveness"), nc.effectiveness_verified],
    [t("closure.reqLesson"), !!lesson],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{t("closure.requirements")}</h2>
        <ul className="space-y-2">
          {checks.map(([label, ok]) => (
            <li key={label} className={cn("flex items-center gap-2 text-sm", !ok && "text-muted-foreground")}>
              {ok ? <CheckCircle2Icon className="size-4 text-emerald-600" /> : <CircleIcon className="size-4" />}
              {label}
            </li>
          ))}
        </ul>
        {nc.status === "closed" && (
          <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
            {t("closure.closedOn", { date: date(nc.closed_at) })}{nc.closure_comment && ` — ${nc.closure_comment}`}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">{t("closure.effectiveness")}</h2>
          {canManage && allApproved && (
            <RecordDialog trigger={<Button variant="outline" size="sm">{t("closure.saveEffectiveness")}</Button>}
              title={t("closure.effectiveness")} hidden={{ id: nc.id }} action={saveEffectiveness}
              fields={[
                { name: "effectiveness_method", label: t("closure.method"), type: "select", required: true,
                  options: (["time", "quantity"] as const).map((m) => ({ value: m, label: t(`closure.methods.${m}`) })),
                  defaultValue: nc.effectiveness_method },
                { name: "effectiveness_target", label: t("closure.target"), required: true, defaultValue: nc.effectiveness_target },
                { name: "effectiveness_result", label: t("closure.result"), type: "textarea", required: true, defaultValue: nc.effectiveness_result },
                { name: "effectiveness_verified", label: t("closure.verified"), type: "checkbox", defaultValue: nc.effectiveness_verified },
              ]} />
          )}
        </div>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-muted-foreground uppercase">{t("closure.method")}</dt>
            <dd>{nc.effectiveness_method ? t(`closure.methods.${nc.effectiveness_method as "time"}`) : "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground uppercase">{t("closure.target")}</dt><dd>{nc.effectiveness_target ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground uppercase">{t("closure.result")}</dt><dd className="whitespace-pre-line">{nc.effectiveness_result ?? "—"}</dd></div>
        </dl>
        {nc.effectiveness_verified && (
          <p className="text-xs text-muted-foreground">
            {t("closure.verifiedBy", { name: verifier?.full_name ?? "—", date: date(nc.effectiveness_verified_at) })}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">{t("closure.lesson")}</h2>
          {canManage && allApproved && nc.status !== "closed" && (
            <RecordDialog trigger={<Button>{t("closure.close")}</Button>} title={t("closure.close")} hidden={{ id: nc.id }}
              action={close8d} submitLabel={t("closure.close")}
              fields={[
                { name: "failure", label: t("closure.failure"), type: "textarea", required: true, defaultValue: nc.title },
                { name: "root_cause", label: t("closure.rootCause"), type: "textarea", required: true,
                  defaultValue: typeof d4.occurrence_root_cause === "string" ? d4.occurrence_root_cause : "" },
                { name: "action", label: t("closure.action"), type: "textarea", required: true, defaultValue: firstAction },
                { name: "keywords", label: t("closure.keywords"), hint: t("closure.keywordsHint") },
                { name: "comment", label: t("closure.comment"), type: "textarea" },
              ]} />
          )}
        </div>
        {!allApproved && <p className="text-sm text-muted-foreground">{t("closure.notReady")}</p>}
        {lesson && (
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground uppercase">{t("closure.failure")}</dt><dd>{lesson.failure}</dd></div>
            <div><dt className="text-xs text-muted-foreground uppercase">{t("closure.rootCause")}</dt><dd>{lesson.root_cause}</dd></div>
            <div><dt className="text-xs text-muted-foreground uppercase">{t("closure.action")}</dt><dd>{lesson.action}</dd></div>
            {lesson.keywords.length > 0 && <div className="sm:col-span-3 text-xs text-muted-foreground">{lesson.keywords.join(" · ")}</div>}
          </dl>
        )}
      </section>
    </div>
  );
}
