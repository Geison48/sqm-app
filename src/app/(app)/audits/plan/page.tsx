import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { TabNav } from "@/components/shared/tab-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { ToneBadge } from "@/components/shared/badges";
import { AuditStatusBadge, ClassificationBadge } from "@/components/audit/audit-badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getInternalUsers } from "@/lib/lookups";
import { param } from "@/lib/filters";
import { createAudit, reviewPlan, updateAudit } from "@/lib/actions/audits";
import { cn } from "@/lib/utils";
import { PlanActionButton } from "./plan-action-button";

const PLAN_TONE: Record<string, string> = { draft: "neutral", submitted: "warning", approved: "success" };

export async function generateMetadata() {
  const t = await getTranslations("plan");
  return { title: t("title") };
}

export default async function PlanPage({ searchParams }: PageProps<"/audits/plan">) {
  const profile = await requireProfile(["sqe", "sqm"]);
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const sp = await searchParams;
  const year = Number(param(sp.year)) || new Date().getFullYear();
  const view = (["list", "calendar", "gantt"] as const).find((v) => v === param(sp.view)) ?? "list";
  const supabase = await createClient();

  const { data: plan } = await supabase.from("audit_plans").select("*").eq("year", year).is("cancelled_at", null).maybeSingle();
  const [{ data: audits }, users, { data: suppliers }, { data: approver }] = await Promise.all([
    plan
      ? supabase.from("audits").select("id, number, supplier_id, planned_start, planned_end, status, lead_auditor_id, classification, score_percent, suppliers(legal_name, criticality)")
          .eq("plan_id", plan.id).is("cancelled_at", null).order("planned_start")
      : Promise.resolve({ data: [] as never[] }),
    getInternalUsers(),
    supabase.from("suppliers").select("id, legal_name, responsible_sqe_id").is("cancelled_at", null).order("legal_name"),
    plan?.approved_by ? supabase.from("users").select("full_name").eq("id", plan.approved_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const rows = (audits ?? []) as {
    id: string; number: string; supplier_id: string; planned_start: string; planned_end: string; status: string;
    lead_auditor_id: string | null; classification: string | null; score_percent: number | null;
    suppliers: { legal_name: string; criticality: string } | null;
  }[];
  const userName = new Map(users.map((u) => [u.id, u.full_name]));
  const status = plan?.status ?? "none";
  const isDraft = plan?.status === "draft";
  const base = `/audits/plan?year=${year}`;
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(year, i, 15)));
  const inPlan = new Set(rows.map((r) => r.supplier_id));
  const addable = (suppliers ?? []).filter((s) => !inPlan.has(s.id) && (profile.role === "sqm" || s.responsible_sqe_id === profile.id));
  const date = (d: string) => format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "short" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild aria-label={String(year - 1)}><Link href={`/audits/plan?year=${year - 1}&view=${view}`}><ChevronLeftIcon /></Link></Button>
            {t("plan.title")} {year}
            <Button variant="ghost" size="icon" asChild aria-label={String(year + 1)}><Link href={`/audits/plan?year=${year + 1}&view=${view}`}><ChevronRightIcon /></Link></Button>
          </span>
        }
        description={t("plan.rule14")}
        actions={
          <>
            {(!plan || isDraft) && <PlanActionButton kind="generate" year={year} label={t("plan.generate")} />}
            {isDraft && rows.length > 0 && <PlanActionButton kind="submit" planId={plan!.id} label={t("plan.submit")} />}
            {plan?.status === "submitted" && profile.role === "sqm" && (
              <RecordDialog trigger={<Button>{t("plan.approve")}</Button>} title={t("plan.approve")} hidden={{ id: plan.id }}
                action={reviewPlan} fields={[
                  { name: "decision", label: t("plan.status"), type: "select", required: true, defaultValue: "approve",
                    options: [{ value: "approve", label: t("plan.approve") }, { value: "return", label: t("plan.return") }] },
                  { name: "comment", label: t("plan.returnComment"), type: "textarea" },
                ]} />
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
          <ToneBadge tone={PLAN_TONE[status] ?? "neutral"}>{t(`plan.statuses.${status as "draft"}`)}</ToneBadge>
          {plan?.approved_at && <span className="text-muted-foreground">{t("plan.approvedBy", { name: approver?.full_name ?? "—", date: date(plan.approved_at.slice(0, 10)) })}</span>}
          {plan?.return_comment && isDraft && <span className="text-amber-700 dark:text-amber-400">{t("plan.returnComment")}: {plan.return_comment}</span>}
        </div>
      </PageHeader>
      {!plan && <p className="text-sm text-muted-foreground">{t("plan.generateHint")}</p>}

      {plan && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <TabNav active={view} tabs={(["list", "calendar", "gantt"] as const).map((v) => ({ key: v, label: t(`plan.views.${v}`), href: `${base}&view=${v}` }))} />
            {isDraft && addable.length > 0 && (
              <RecordDialog trigger={<AddButton label={t("plan.addAudit")} />} title={t("plan.addAudit")} action={createAudit}
                hidden={{ plan_id: plan.id, type_code: "process" }} fields={[
                  { name: "supplier_id", label: t("audits.supplier"), type: "select", required: true,
                    options: addable.map((s) => ({ value: s.id, label: s.legal_name })) },
                  { name: "planned_start", label: t("audits.plannedStart"), type: "date", required: true, span: 1 },
                  { name: "planned_end", label: t("audits.plannedEnd"), type: "date", required: true, span: 1 },
                  { name: "lead_auditor_id", label: t("audits.leadAuditor"), type: "select",
                    options: users.map((u) => ({ value: u.id, label: u.full_name })), defaultValue: profile.id },
                ]} />
            )}
          </div>

          {rows.length === 0 && <EmptyState>{t("plan.empty")}</EmptyState>}

          {view === "list" && rows.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("audits.supplier")}</TableHead>
                    <TableHead>{t("audits.plannedStart")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("audits.leadAuditor")}</TableHead>
                    <TableHead>{t("audits.status")}</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-64 whitespace-normal">
                        <Link href={`/audits/${a.id}`} className="font-medium hover:underline">{a.suppliers?.legal_name}</Link>
                        <div className="text-xs text-muted-foreground">{a.number} · {t("criticality.label")} {a.suppliers?.criticality}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{date(a.planned_start)} – {date(a.planned_end)}</TableCell>
                      <TableCell className="hidden md:table-cell">{a.lead_auditor_id ? userName.get(a.lead_auditor_id) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <AuditStatusBadge status={a.status} />
                          {a.classification && <ClassificationBadge value={a.classification} percent={a.score_percent} />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {["planned", "scheduled"].includes(a.status) && (
                          <div className="flex flex-wrap justify-end">
                            <RecordDialog trigger={<EditButton label={t("audits.editData")} />} title={`${a.number} — ${a.suppliers?.legal_name}`}
                              hidden={{ id: a.id }} action={updateAudit} fields={[
                                { name: "planned_start", label: t("audits.plannedStart"), type: "date", required: true, span: 1, defaultValue: a.planned_start },
                                { name: "planned_end", label: t("audits.plannedEnd"), type: "date", required: true, span: 1, defaultValue: a.planned_end },
                                { name: "lead_auditor_id", label: t("audits.leadAuditor"), type: "select",
                                  options: users.map((u) => ({ value: u.id, label: u.full_name })), defaultValue: a.lead_auditor_id },
                              ]} />
                            {isDraft && <CancelRecordButton table="audits" id={a.id} path={base} />}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {view === "calendar" && rows.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {months.map((m, i) => {
                const inMonth = rows.filter((a) => new Date(`${a.planned_start}T12:00:00`).getMonth() === i);
                return (
                  <section key={m} className="rounded-lg border p-3">
                    <h3 className="mb-2 text-sm font-medium capitalize">{m}</h3>
                    {inMonth.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : (
                      <ul className="space-y-1.5">
                        {inMonth.map((a) => (
                          <li key={a.id}>
                            <Link href={`/audits/${a.id}`} className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1 text-xs hover:bg-muted">
                              <span className="truncate">{new Date(`${a.planned_start}T12:00:00`).getDate()} · {a.suppliers?.legal_name}</span>
                              <span className="shrink-0 font-semibold">{a.suppliers?.criticality}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {view === "gantt" && rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[200px_repeat(12,1fr)] border-b bg-muted/50 text-xs font-medium">
                  <div className="p-2">{t("audits.supplier")}</div>
                  {months.map((m) => <div key={m} className="border-l p-2 text-center capitalize">{m}</div>)}
                </div>
                {rows.map((a) => {
                  const start = new Date(`${a.planned_start}T12:00:00`);
                  const end = new Date(`${a.planned_end}T12:00:00`);
                  const dayOfYear = (d: Date) => (d.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000;
                  const left = Math.max(0, dayOfYear(start) / 365) * 100;
                  const width = Math.max(0.8, ((dayOfYear(end) - dayOfYear(start) + 1) / 365) * 100);
                  return (
                    <div key={a.id} className="grid grid-cols-[200px_1fr] border-b last:border-b-0">
                      <Link href={`/audits/${a.id}`} className="truncate p-2 text-xs hover:underline">{a.suppliers?.legal_name}</Link>
                      <div className="relative h-9 bg-[repeating-linear-gradient(to_right,transparent,transparent_calc(100%/12_-_1px),var(--border)_calc(100%/12_-_1px),var(--border)_calc(100%/12))]">
                        <div title={`${a.number} ${date(a.planned_start)}–${date(a.planned_end)}`}
                          className={cn("absolute top-2 h-5 min-w-2 rounded",
                            a.status === "closed" ? "bg-emerald-500" : a.status === "planned" ? "bg-muted-foreground/40" : "bg-sky-500")}
                          style={{ left: `${left}%`, width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

