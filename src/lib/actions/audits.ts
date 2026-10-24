"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { dbErrorKey } from "@/lib/db-errors";
import { formValues, type ActionState } from "@/lib/action-state";

const uuid = z.uuid();
const auditPath = (id: string, tab?: string) => `/audits/${id}${tab ? `?tab=${tab}` : ""}`;

function zodError(error: z.ZodError) {
  const msg = error.issues[0]?.message;
  return msg?.startsWith("errors.") ? msg : "common.genericError";
}

async function rpc(fn: string, args: Record<string, unknown>, paths: string[], success: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as never, args as never);
  if (error) return { error: dbErrorKey(error) };
  for (const p of paths) revalidatePath(p);
  return { success };
}

// -------------------------------------------------------------------- auditoria
const auditSchema = z.object({
  supplier_id: uuid,
  type_code: z.string().min(1),
  template_id: uuid.nullish(),
  title: z.string().nullish(),
  planned_start: z.iso.date(),
  planned_end: z.iso.date(),
  lead_auditor_id: uuid.nullish(),
  plant_id: uuid.nullish(),
});

function multi(formData: FormData, name: string) {
  return formData.getAll(name).map(String).filter(Boolean);
}

export async function createAudit(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = auditSchema.safeParse(raw);
  if (!parsed.success) return { error: zodError(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("audits").insert({
    ...parsed.data,
    scope_codes: multi(formData, "scope_codes"),
    auditor_ids: multi(formData, "auditor_ids"),
    plan_id: raw.plan_id ?? null,
  } as never).select("id").single();
  if (error) return { error: dbErrorKey(error) };
  revalidatePath("/audits");
  if (raw.plan_id) {
    revalidatePath("/audits/plan");
    return { success: "common.created" };
  }
  redirect(auditPath(data.id));
}

export async function updateAudit(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  if (!raw.id) return { error: "common.genericError" };
  const parsed = auditSchema.omit({ supplier_id: true }).partial().safeParse(raw);
  if (!parsed.success) return { error: zodError(parsed.error) };
  const values: Record<string, unknown> = { ...parsed.data, summary: raw.summary };
  if (formData.has("scopes_present")) values.scope_codes = multi(formData, "scope_codes");
  if (formData.has("auditors_present")) values.auditor_ids = multi(formData, "auditor_ids");
  const supabase = await createClient();
  const { data, error } = await supabase.from("audits").update(values as never).eq("id", raw.id).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(auditPath(raw.id));
  revalidatePath("/audits/plan");
  return { success: "common.saved" };
}

export async function startAudit(auditId: string) {
  await requireProfile(["sqe", "sqm"]);
  return rpc("start_audit", { p_audit_id: auditId }, [auditPath(auditId)], "audits.started");
}

export async function completeAudit(_: ActionState, formData: FormData) {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  return rpc("complete_audit", { p_audit_id: v.id, p_summary: v.summary }, [auditPath(v.id!), "/audits"], "audits.completed");
}

export async function resolveSuggestion(_: ActionState, formData: FormData) {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  const apply = v.decision === "apply";
  return rpc("resolve_audit_status_suggestion", { p_audit_id: v.id, p_apply: apply, p_justification: v.justification ?? "" },
    [auditPath(v.id!)], apply ? "audits.suggestionApplied" : "audits.suggestionDismissed");
}

export type ScoreResult = {
  method: "vda63" | "gwi" | null;
  answered: number;
  items: number;
  percent: number | null;
  classification: "A" | "B" | "C" | null;
  elements: Record<string, number>;
  reasons: string[];
};

export async function getAuditScore(auditId: string): Promise<ScoreResult | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("audit_score", { p_audit_id: auditId });
  return (data as ScoreResult | null) ?? null;
}

const answerSchema = z.object({
  id: uuid,
  auditId: uuid,
  score: z.union([z.literal(0), z.literal(4), z.literal(6), z.literal(8), z.literal(10)]).nullable().optional(),
  result: z.enum(["conform", "minor_nc", "major_nc", "observation", "not_applicable"]).nullable().optional(),
  not_applicable: z.boolean().optional(),
  comment: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
});

// Salvamento por pergunta (execução item a item); devolve a nota parcial.
export async function saveAnswer(input: z.input<typeof answerSchema>): Promise<{ error?: string; score?: ScoreResult | null }> {
  await requireProfile(["sqe", "sqm"]);
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { error: "common.genericError" };
  const { id, auditId, ...values } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("audit_answers").update(values).eq("id", id).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  return { score: await getAuditScore(auditId) };
}

// -------------------------------------------------------------------- achados
const findingSchema = z.object({
  audit_id: uuid,
  answer_id: uuid.nullish(),
  classification: z.enum(["major_nc", "minor_nc", "observation", "improvement"]),
  description: z.string().min(1),
  requirement: z.string().nullish(),
});

export async function saveFinding(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = findingSchema.safeParse(raw);
  if (!parsed.success) return { error: zodError(parsed.error) };
  const supabase = await createClient();
  const { audit_id, answer_id, ...values } = parsed.data;
  const { data, error } = raw.id
    ? await supabase.from("findings").update(values).eq("id", raw.id).select("id")
    : await supabase.from("findings").insert({ audit_id, answer_id, ...values } as never).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(auditPath(audit_id));
  return { success: raw.id ? "common.saved" : "common.created" };
}

export async function respondFinding(_: ActionState, formData: FormData) {
  await requireProfile(["supplier"]);
  const v = formValues(formData);
  return rpc("respond_finding", {
    p_finding_id: v.id, p_action_plan: v.action_plan ?? "", p_responsible: v.action_responsible ?? "", p_due: v.action_due_date,
  }, [auditPath(v.audit_id!, "findings")], "findings.responded");
}

export async function reviewFinding(_: ActionState, formData: FormData) {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  return rpc("review_finding", { p_finding_id: v.id, p_accept: v.decision === "accept", p_comment: v.comment ?? "" },
    [auditPath(v.audit_id!, "findings")], "findings.reviewed");
}

export async function verifyFinding(_: ActionState, formData: FormData) {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  return rpc("verify_finding", { p_finding_id: v.id, p_comment: v.comment ?? "" },
    [auditPath(v.audit_id!, "findings"), auditPath(v.audit_id!)], "findings.verified");
}

// -------------------------------------------------------------------- plano anual
export async function generatePlan(year: number) {
  await requireProfile(["sqe", "sqm"]);
  return rpc("generate_audit_plan", { p_year: year }, ["/audits/plan"], "plan.generated");
}

export async function submitPlan(planId: string) {
  await requireProfile(["sqe", "sqm"]);
  return rpc("submit_audit_plan", { p_plan_id: planId }, ["/audits/plan"], "plan.submitted");
}

export async function reviewPlan(_: ActionState, formData: FormData) {
  await requireProfile(["sqm"]);
  const v = formValues(formData);
  const approve = v.decision === "approve";
  return rpc("review_audit_plan", { p_plan_id: v.id, p_approve: approve, p_comment: v.comment ?? "" },
    ["/audits/plan", "/audits"], approve ? "plan.approved" : "plan.returned");
}

// -------------------------------------------------------------------- modelos
const templateSchema = z.object({
  code: z.string().min(1).transform((v) => v.toUpperCase()),
  name_pt: z.string().min(1),
  name_en: z.string().min(1),
  method: z.enum(["vda63", "gwi"]),
  notes: z.string().nullish(),
});

export async function createTemplate(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const supabase = await createClient();
  if (raw.id) {
    const parsed = templateSchema.pick({ name_pt: true, name_en: true, notes: true }).safeParse(raw);
    if (!parsed.success) return { error: zodError(parsed.error) };
    const { data, error } = await supabase.from("audit_templates").update(parsed.data).eq("id", raw.id).select("id");
    if (error) return { error: dbErrorKey(error) };
    if (!data?.length) return { error: "errors.forbidden" };
    revalidatePath(`/audits/templates/${raw.id}`);
    return { success: "common.saved" };
  }
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) return { error: zodError(parsed.error) };
  const { data, error } = await supabase.from("audit_templates").insert(parsed.data).select("id").single();
  if (error) return { error: dbErrorKey(error) };
  redirect(`/audits/templates/${data.id}`);
}

export async function newTemplateVersion(templateId: string): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("new_template_version", { p_template_id: templateId });
  if (error) return { error: dbErrorKey(error) };
  revalidatePath("/audits/templates");
  return { success: "templates.versionCreated", id: data as string };
}

export async function activateTemplate(templateId: string) {
  await requireProfile(["sqe", "sqm"]);
  return rpc("activate_template", { p_template_id: templateId }, ["/audits/templates", `/audits/templates/${templateId}`],
    "templates.activated");
}

const itemSchema = z.object({
  template_id: uuid,
  element_code: z.string().min(1),
  element_title_pt: z.string().nullish(),
  element_title_en: z.string().nullish(),
  item_code: z.string().min(1),
  question_pt: z.string().min(1),
  question_en: z.string().min(1),
  guidance_pt: z.string().nullish(),
  guidance_en: z.string().nullish(),
  is_star: z.boolean().default(false),
  scope_code: z.string().nullish(),
  sort_order: z.coerce.number().int().default(0),
});
export type TemplateItemInput = z.input<typeof itemSchema>;

export async function saveTemplateItem(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = itemSchema.safeParse({ ...raw, is_star: formData.get("is_star") === "on", sort_order: raw.sort_order ?? 0 });
  if (!parsed.success) return { error: zodError(parsed.error) };
  const supabase = await createClient();
  const { template_id, ...values } = parsed.data;
  const { data, error } = raw.id
    ? await supabase.from("audit_template_items").update(values).eq("id", raw.id).select("id")
    : await supabase.from("audit_template_items").insert({ template_id, ...values }).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(`/audits/templates/${template_id}`);
  return { success: raw.id ? "common.saved" : "common.created" };
}

// Colunas aceitas na planilha (cabeçalho em PT ou EN).
const COLUMNS: Record<string, keyof TemplateItemInput> = {
  elemento: "element_code", element: "element_code",
  titulo_elemento_pt: "element_title_pt", element_title_pt: "element_title_pt",
  titulo_elemento_en: "element_title_en", element_title_en: "element_title_en",
  item: "item_code", item_code: "item_code",
  pergunta_pt: "question_pt", question_pt: "question_pt",
  pergunta_en: "question_en", question_en: "question_en",
  orientacao_pt: "guidance_pt", guidance_pt: "guidance_pt",
  orientacao_en: "guidance_en", guidance_en: "guidance_en",
  estrela: "is_star", star: "is_star",
  escopo: "scope_code", scope: "scope_code",
  ordem: "sort_order", order: "sort_order",
};

function normalizeHeader(h: string) {
  return h.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/[\s()-]+/g, "_").replace(/_+$/, "");
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "richText" in value) {
    return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  if (typeof value === "object" && value !== null && "result" in value) return String((value as { result: unknown }).result ?? "");
  return String(value);
}

// Lê .xlsx ou .csv e devolve as perguntas para conferência (nada é gravado aqui).
export async function parseTemplateFile(formData: FormData): Promise<{ rows?: TemplateItemInput[]; error?: string; detail?: string }> {
  await requireProfile(["sqe", "sqm"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "errors.importEmpty" };
  if (file.size > 5 * 1024 * 1024) return { error: "errors.fileTooLarge" };

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  let table: string[][] = [];
  try {
    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = await file.text();
      const sep = (text.split("\n")[0] ?? "").includes(";") ? ";" : ",";
      table = text.split(/\r?\n/).filter((l) => l.trim()).map((line) => parseCsvLine(line, sep));
    } else {
      await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);
      const sheet = workbook.worksheets[0];
      sheet?.eachRow({ includeEmpty: false }, (row) => {
        const values = (row.values as unknown[]).slice(1);
        table.push(values.map(cellText));
      });
    }
  } catch {
    return { error: "errors.importInvalid", detail: file.name };
  }
  if (table.length < 2) return { error: "errors.importEmpty" };

  const header = table[0]!.map((h) => COLUMNS[normalizeHeader(h)]);
  for (const required of ["element_code", "item_code", "question_pt", "question_en"] as const) {
    if (!header.includes(required)) return { error: "errors.importInvalid", detail: required };
  }
  const rows: TemplateItemInput[] = [];
  table.slice(1).forEach((cells, index) => {
    const row: Record<string, unknown> = { template_id: "00000000-0000-4000-8000-000000000000" };
    header.forEach((key, i) => {
      if (!key) return;
      const v = (cells[i] ?? "").trim();
      if (key === "is_star") row[key] = /^(s|sim|y|yes|x|\*|1|true)$/i.test(v);
      else if (key === "sort_order") row[key] = v ? Number(v) : (index + 1) * 10;
      else row[key] = v || null;
    });
    if (row.question_pt || row.question_en) rows.push(row as TemplateItemInput);
  });
  if (!rows.length) return { error: "errors.importEmpty" };
  return { rows };
}

function parseCsvLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export async function importTemplateItems(templateId: string, rows: TemplateItemInput[]): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const parsed = z.array(itemSchema).safeParse(rows.map((r) => ({ ...r, template_id: templateId })));
  if (!parsed.success) return { error: "errors.importInvalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("audit_template_items").insert(parsed.data);
  if (error) return { error: dbErrorKey(error) };
  revalidatePath(`/audits/templates/${templateId}`);
  return { success: "templates.imported" };
}
