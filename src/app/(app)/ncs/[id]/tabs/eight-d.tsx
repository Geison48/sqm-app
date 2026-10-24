import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ToneBadge } from "@/components/shared/badges";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { DeadlineBadge } from "@/components/shared/nc-badges";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StepForm } from "@/components/nc/step-form";
import { ReviewPanel } from "@/components/nc/review-panel";
import { RcaTools } from "@/components/nc/rca-tools";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { DISCIPLINES, STEP_TONE, deadlineState, type Discipline, type StepContent } from "@/lib/eight-d";
import { saveContainment } from "@/lib/actions/ncs";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";
import type { NcRow } from "./types";

type Containment = Database["public"]["Tables"]["containment_actions"]["Row"];

export async function EightDTab({
  nc, selected, canManage, isOwnSupplier, ratio,
}: { nc: NcRow; selected?: string; canManage: boolean; isOwnSupplier: boolean; ratio: number }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data: stepsData }, disciplines] = await Promise.all([
    supabase.from("eight_d_steps").select("*").eq("nc_id", nc.id),
    getLookup("eight_d_disciplines", true),
  ]);
  const steps = (stepsData ?? []).sort((a, b) => a.discipline.localeCompare(b.discipline));
  if (steps.length === 0) return null;

  const firstOpen = steps.find((s) => s.status !== "approved")?.discipline ?? "D8";
  const current = (DISCIPLINES.includes(selected as Discipline) ? selected : firstOpen) as Discipline;
  const step = steps.find((s) => s.discipline === current)!;
  const disciplineLabel = (code: string) => lookupLabel(disciplines.find((d) => d.code === code), locale);
  const ncOpen = nc.status !== "closed" && !nc.cancelled_at;
  const editable = isOwnSupplier && ncOpen && ["not_started", "draft", "rejected"].includes(step.status);
  const contentEditable = (isOwnSupplier || canManage) && ncOpen && !["submitted", "approved"].includes(step.status);
  const previousApproved = steps.filter((s) => s.discipline < current).every((s) => s.status === "approved");
  const base = `/ncs/${nc.id}?tab=eightD`;

  const [{ data: versions }, containmentRes, rcaRes, locations] = await Promise.all([
    supabase.from("eight_d_step_versions").select("*").eq("step_id", step.id).order("version", { ascending: false }),
    current === "D3"
      ? supabase.from("containment_actions").select("*").eq("nc_id", nc.id).is("cancelled_at", null).order("created_at")
      : Promise.resolve({ data: [] as Containment[] }),
    current === "D4"
      ? supabase.from("rca_tools").select("tool_type, content").eq("nc_id", nc.id).is("cancelled_at", null)
      : Promise.resolve({ data: [] as { tool_type: string; content: unknown }[] }),
    current === "D3" ? getLookup("containment_locations") : Promise.resolve([]),
  ]);
  const containment = containmentRes.data ?? [];
  const rca = Object.fromEntries((rcaRes.data ?? []).map((r) => [r.tool_type, r.content as Record<string, unknown>]));
  const dt = (v: string | null) => (v ? format.dateTime(new Date(v), { dateStyle: "short", timeStyle: "short" }) : "—");

  const containmentFields = (c?: Containment): FieldDef[] => [
    { name: "location_code", label: t("eightD.containment.location"), type: "select", required: true, span: 1,
      options: locations.map((l) => ({ value: l.code, label: lookupLabel(l, locale) })), defaultValue: c?.location_code },
    { name: "sn_or_lot", label: t("eightD.containment.snOrLot"), span: 1, defaultValue: c?.sn_or_lot },
    { name: "qty_checked", label: t("eightD.containment.checked"), type: "number", required: true, span: 1, defaultValue: c?.qty_checked ?? 0 },
    { name: "qty_ok", label: t("eightD.containment.ok"), type: "number", required: true, span: 1, defaultValue: c?.qty_ok ?? 0 },
    { name: "qty_nok", label: t("eightD.containment.nok"), type: "number", required: true, span: 1, defaultValue: c?.qty_nok ?? 0 },
    { name: "done_on", label: t("eightD.containment.doneOn"), type: "date", span: 1, defaultValue: c?.done_on },
    { name: "action_taken", label: t("eightD.containment.action"), type: "textarea", defaultValue: c?.action_taken },
    { name: "responsible", label: t("eightD.containment.responsible"), defaultValue: c?.responsible },
  ];
  const sum = (k: "qty_checked" | "qty_ok" | "qty_nok") => containment.reduce((a, c) => a + Number(c[k]), 0);

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <nav aria-label={t("eightD.disciplines")} className="min-w-0">
        <ul className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
          {steps.map((s) => {
            const state = deadlineState(s.due_at, nc.opened_at, {
              ratio, withSqe: s.status === "submitted", done: s.status === "approved",
            });
            return (
              <li key={s.id} className="shrink-0">
                <Link href={`${base}&d=${s.discipline}`} scroll={false}
                  aria-current={s.discipline === current ? "page" : undefined}
                  className={cn("flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm md:border-transparent",
                    s.discipline === current ? "border-primary bg-muted md:border-transparent" : "hover:bg-muted/60")}>
                  <span className="min-w-0">
                    <span className="font-mono font-medium">{s.discipline}</span>
                    <span className="hidden truncate text-xs text-muted-foreground md:block">{disciplineLabel(s.discipline)}</span>
                  </span>
                  <span className={cn("size-2.5 shrink-0 rounded-full", {
                    "bg-emerald-500": s.status === "approved",
                    "bg-sky-500": s.status === "submitted",
                    "bg-red-500": s.status === "rejected" || state === "overdue",
                    "bg-amber-400": s.status !== "rejected" && state === "due_soon",
                    "bg-muted-foreground/30": s.status !== "approved" && s.status !== "submitted" && s.status !== "rejected" && state === "on_time",
                  })} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium"><span className="font-mono">{current}</span> · {disciplineLabel(current)}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ToneBadge tone={STEP_TONE[step.status] ?? "neutral"}>{t(`eightD.stepStatus.${step.status as "draft"}`)}</ToneBadge>
              <span className="text-sm text-muted-foreground">{t("eightD.due")}:</span>
              <DeadlineBadge dueAt={step.due_at} state={deadlineState(step.due_at, nc.opened_at, {
                ratio, withSqe: step.status === "submitted", done: step.status === "approved" })} />
            </div>
          </div>
        </div>

        {step.review_comment && (
          <div className={cn("rounded-md p-3 text-sm", step.status === "rejected" ? "bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-100" : "bg-muted")}>
            <span className="font-medium">{t("eightD.sqeFeedback")}:</span> {step.review_comment}
          </div>
        )}

        {current === "D3" && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{t("eightD.containment.title")}</h3>
              {contentEditable && (
                <RecordDialog trigger={<AddButton label={t("eightD.containment.add")} />} title={t("eightD.containment.add")}
                  hidden={{ nc_id: nc.id }} action={saveContainment} fields={containmentFields()} />
              )}
            </div>
            {containment.length === 0 ? <p className="text-sm text-muted-foreground">{t("eightD.containment.empty")}</p> : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("eightD.containment.location")}</TableHead>
                      <TableHead>{t("eightD.containment.snOrLot")}</TableHead>
                      <TableHead className="text-right">{t("eightD.containment.checked")}</TableHead>
                      <TableHead className="text-right">{t("eightD.containment.ok")}</TableHead>
                      <TableHead className="text-right">{t("eightD.containment.nok")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("eightD.containment.action")}</TableHead>
                      {contentEditable && <TableHead className="w-0" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {containment.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{lookupLabel(locations.find((l) => l.code === c.location_code), locale)}</TableCell>
                        <TableCell className="font-mono text-xs">{c.sn_or_lot ?? "—"}</TableCell>
                        <TableCell className="text-right">{c.qty_checked}</TableCell>
                        <TableCell className="text-right">{c.qty_ok}</TableCell>
                        <TableCell className="text-right">{c.qty_nok}</TableCell>
                        <TableCell className="hidden max-w-64 whitespace-normal md:table-cell">{c.action_taken ?? "—"}</TableCell>
                        {contentEditable && (
                          <TableCell>
                            <div className="flex flex-wrap justify-end">
                              <RecordDialog trigger={<EditButton label={t("eightD.containment.edit")} />} title={t("eightD.containment.edit")}
                                hidden={{ id: c.id, nc_id: nc.id }} action={saveContainment} fields={containmentFields(c)} />
                              <CancelRecordButton table="containment_actions" id={c.id} path={`${base}&d=D3`} />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>{t("eightD.containment.total")}</TableCell>
                      <TableCell className="text-right">{sum("qty_checked")}</TableCell>
                      <TableCell className="text-right">{sum("qty_ok")}</TableCell>
                      <TableCell className="text-right">{sum("qty_nok")}</TableCell>
                      <TableCell colSpan={contentEditable ? 2 : 1} className="hidden md:table-cell" />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </section>
        )}

        {current === "D4" && <RcaTools ncId={nc.id} stepId={step.id} initial={rca} editable={contentEditable} />}

        <StepForm key={`${step.id}-${step.updated_at}`} ncId={nc.id} stepId={step.id} discipline={current}
          initial={step.content as StepContent} editable={editable} />

        {canManage && step.status === "submitted" && (
          <ReviewPanel ncId={nc.id} stepId={step.id} canApprove={previousApproved} />
        )}

        <section className="space-y-2 border-t pt-4">
          <h3 className="font-medium">{t("eightD.versions")}</h3>
          {(versions ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t("eightD.noVersions")}</p> : (
            <ul className="space-y-2">
              {(versions ?? []).map((v) => (
                <li key={v.id} className="rounded-md border">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-medium">{t("eightD.version", { version: v.version })}</span>
                      <span className="text-muted-foreground">{t("eightD.submittedAt")} {dt(v.submitted_at)}</span>
                      <ToneBadge tone={v.decision === "approved" ? "success" : v.decision === "rejected" ? "danger" : "info"}>
                        {t(`eightD.decision.${(v.decision ?? "pending") as "approved"}`)}
                      </ToneBadge>
                      {v.review_comment && <span className="w-full text-muted-foreground sm:w-auto">“{v.review_comment}”</span>}
                    </summary>
                    <div className="border-t p-3">
                      <StepForm ncId={nc.id} stepId={step.id} discipline={current} initial={v.content as StepContent} editable={false} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
