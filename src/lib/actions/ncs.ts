"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { dbErrorKey } from "@/lib/db-errors";
import { checkbox, formValues, type ActionState } from "@/lib/action-state";
import { DISCIPLINES, missingFields, type Discipline, type StepContent } from "@/lib/eight-d";

const uuid = z.uuid();
const ncPath = (id: string, tab?: string, extra = "") => `/ncs/${id}${tab ? `?tab=${tab}${extra}` : ""}`;

function zodError(error: z.ZodError) {
  const msg = error.issues[0]?.message;
  return msg?.startsWith("errors.") ? msg : "common.genericError";
}

// -------------------------------------------------------------------- abertura
export type SuggestionResult = { suggest: boolean; reasons: string[]; previous: { id: string; number: string }[] };

export async function suggest8d(input: {
  severity: string | null;
  customerAffected: boolean;
  componentId: string | null;
  failureMode: string | null;
}): Promise<SuggestionResult | null> {
  if (!input.severity) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("suggest_8d", {
    p_severity: input.severity,
    p_customer_affected: input.customerAffected,
    p_component_id: input.componentId ?? undefined,
    p_failure_mode: input.failureMode ?? undefined,
  } as never);
  return (data as SuggestionResult | null) ?? null;
}

const ncSchema = z.object({
  supplier_id: uuid,
  component_id: uuid.nullish(),
  type: z.enum(["simple", "8d"]),
  origin_code: z.string().min(1),
  severity_code: z.string().min(1),
  failure_mode_code: z.string().nullish(),
  title: z.string().min(1),
  description: z.string().min(1),
  detected_on: z.iso.date(),
  detected_location: z.string().nullish(),
  quantity_affected: z.coerce.number().nonnegative().nullish(),
  customer_affected: z.boolean(),
  disposition_code: z.string().nullish(),
  disposition_notes: z.string().nullish(),
});

export async function createNc(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = ncSchema.safeParse({ ...raw, customer_affected: checkbox(formData, "customer_affected") });
  if (!parsed.success) return { error: zodError(parsed.error) };

  const items = formData.getAll("item_sn").map((sn, i) => ({
    sn_or_lot: String(sn).trim(),
    quantity: Number(formData.getAll("item_qty")[i]) || null,
  })).filter((i) => i.sn_or_lot);

  const supabase = await createClient();
  const { data, error } = await supabase.from("ncs").insert(parsed.data as never).select("id").single();
  if (error) return { error: dbErrorKey(error) };
  if (items.length) {
    const { error: itemsError } = await supabase.from("nc_items").insert(
      items.map((i) => ({ ...i, nc_id: data.id, supplier_id: parsed.data.supplier_id })),
    );
    if (itemsError) return { error: dbErrorKey(itemsError) };
  }
  revalidatePath("/ncs");
  redirect(`${ncPath(data.id, "attachments")}&created=1`);
}

const updateSchema = ncSchema.omit({ supplier_id: true, type: true }).partial();

export async function updateNc(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  if (!raw.id) return { error: "common.genericError" };
  const parsed = updateSchema.safeParse({ ...raw, customer_affected: checkbox(formData, "customer_affected") });
  if (!parsed.success) return { error: zodError(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ncs").update(parsed.data as never).eq("id", raw.id).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(ncPath(raw.id));
  return { success: "common.saved" };
}

export async function setDisposition(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  if (!v.id) return { error: "common.genericError" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ncs")
    .update({ disposition_code: v.disposition_code, disposition_notes: v.disposition_notes })
    .eq("id", v.id).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(ncPath(v.id));
  return { success: "common.saved" };
}

export async function saveNcItem(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  if (!v.nc_id || !v.sn_or_lot) return { error: "common.genericError" };
  const supabase = await createClient();
  const { error } = await supabase.from("nc_items").insert({
    nc_id: v.nc_id, supplier_id: v.supplier_id!, sn_or_lot: v.sn_or_lot,
    quantity: v.quantity ? Number(v.quantity) : null, notes: v.notes,
  });
  if (error) return { error: dbErrorKey(error) };
  revalidatePath(ncPath(v.nc_id));
  return { success: "common.created" };
}

async function rpc(fn: string, args: Record<string, unknown>, path: string, success: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as never, args as never);
  if (error) return { error: dbErrorKey(error) };
  revalidatePath(path);
  return { success };
}

export async function convertTo8d(ncId: string) {
  await requireProfile(["sqe", "sqm"]);
  return rpc("convert_nc_to_8d", { p_nc_id: ncId }, ncPath(ncId), "ncs.converted");
}

// -------------------------------------------------------------------- NC simples
export async function respondSimpleNc(_: ActionState, formData: FormData) {
  await requireProfile(["supplier"]);
  const v = formValues(formData);
  return rpc("respond_simple_nc", { p_nc_id: v.id, p_action: v.supplier_action ?? "" }, ncPath(v.id!), "ncs.responded");
}

export async function reviewSimpleNc(_: ActionState, formData: FormData) {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  const accept = v.decision === "accept";
  return rpc("review_simple_nc", { p_nc_id: v.id, p_accept: accept, p_comment: v.comment ?? "" }, ncPath(v.id!),
    accept ? "ncs.closedMsg" : "ncs.returned");
}

// -------------------------------------------------------------------- 8D
export async function saveStep(input: {
  ncId: string;
  stepId: string;
  discipline: Discipline;
  content: StepContent;
  submit: boolean;
}): Promise<{ error?: string; success?: string; missing?: string[] } | undefined> {
  await requireProfile(["supplier"]);
  if (!DISCIPLINES.includes(input.discipline)) return { error: "common.genericError" };

  if (input.submit) {
    const { scalar, lists } = missingFields(input.discipline, input.content);
    if (scalar.length) return { error: "errors.required_fields", missing: scalar };
    if (lists.length) return { error: "errors.list_required", missing: lists };
    if (input.discipline === "D3") {
      const supabase = await createClient();
      const { count } = await supabase.from("containment_actions").select("id", { count: "exact", head: true })
        .eq("nc_id", input.ncId).is("cancelled_at", null);
      if (!count) return { error: "errors.containment_required" };
    }
  }
  return rpc("save_8d_step", { p_step_id: input.stepId, p_content: input.content, p_submit: input.submit },
    ncPath(input.ncId), input.submit ? "eightD.submitted" : "eightD.draftSaved");
}

export async function reviewStep(input: { ncId: string; stepId: string; approve: boolean; comment: string }) {
  await requireProfile(["sqe", "sqm"]);
  return rpc("review_8d_step", { p_step_id: input.stepId, p_approve: input.approve, p_comment: input.comment },
    ncPath(input.ncId), input.approve ? "eightD.approved" : "eightD.rejected");
}

const containmentSchema = z.object({
  nc_id: uuid,
  location_code: z.string().min(1),
  sn_or_lot: z.string().nullish(),
  qty_checked: z.coerce.number().nonnegative(),
  qty_ok: z.coerce.number().nonnegative(),
  qty_nok: z.coerce.number().nonnegative(),
  action_taken: z.string().nullish(),
  responsible: z.string().nullish(),
  done_on: z.iso.date().nullish(),
});

export async function saveContainment(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile();
  const raw = formValues(formData);
  const parsed = containmentSchema.safeParse({
    ...raw, qty_checked: raw.qty_checked ?? 0, qty_ok: raw.qty_ok ?? 0, qty_nok: raw.qty_nok ?? 0,
  });
  if (!parsed.success) return { error: zodError(parsed.error) };
  const supabase = await createClient();
  const { nc_id, ...values } = parsed.data;
  const { data, error } = raw.id
    ? await supabase.from("containment_actions").update(values).eq("id", raw.id).select("id")
    : await supabase.from("containment_actions").insert({ nc_id, ...values } as never).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(ncPath(nc_id));
  return { success: raw.id ? "common.saved" : "common.created" };
}

export async function saveRcaTool(input: {
  ncId: string;
  stepId: string;
  toolType: "ishikawa" | "5why_3legs" | "is_isnot";
  content: Record<string, unknown>;
}): Promise<ActionState> {
  await requireProfile();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("rca_tools").select("id").eq("nc_id", input.ncId)
    .eq("tool_type", input.toolType).is("cancelled_at", null).maybeSingle();
  const { error } = existing
    ? await supabase.from("rca_tools").update({ content: input.content as never }).eq("id", existing.id)
    : await supabase.from("rca_tools").insert({
        nc_id: input.ncId, eight_d_step_id: input.stepId, tool_type: input.toolType, content: input.content as never,
      } as never);
  if (error) return { error: dbErrorKey(error) };
  revalidatePath(ncPath(input.ncId));
  return { success: "rca.saved" };
}

// -------------------------------------------------------------------- fechamento 8D
export async function saveEffectiveness(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  if (!v.id) return { error: "common.genericError" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ncs").update({
    effectiveness_method: v.effectiveness_method as "time" | "quantity" | null,
    effectiveness_target: v.effectiveness_target,
    effectiveness_result: v.effectiveness_result,
    effectiveness_verified: checkbox(formData, "effectiveness_verified"),
  }).eq("id", v.id).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(ncPath(v.id, "closure"));
  return { success: "common.saved" };
}

export async function close8d(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  const keywords = (v.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return rpc("close_8d", {
    p_nc_id: v.id, p_failure: v.failure ?? "", p_root_cause: v.root_cause ?? "", p_action: v.action ?? "",
    p_keywords: keywords, p_comment: v.comment,
  }, ncPath(v.id!, "closure"), "closure.closed");
}

// -------------------------------------------------------------------- custos
const costSchema = z.object({
  nc_id: uuid,
  cost_type_code: z.string().min(1),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit_amount: z.coerce.number().nonnegative(),
  currency: z.string().length(3),
  chargeable: z.boolean(),
});

export async function saveCost(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = costSchema.safeParse({ ...raw, quantity: raw.quantity ?? 1, chargeable: checkbox(formData, "chargeable") });
  if (!parsed.success) return { error: zodError(parsed.error) };
  const supabase = await createClient();
  const { nc_id, ...values } = parsed.data;
  const { data, error } = raw.id
    ? await supabase.from("nc_costs").update(values).eq("id", raw.id).select("id")
    : await supabase.from("nc_costs").insert({ nc_id, ...values } as never).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(ncPath(nc_id, "costs"));
  return { success: raw.id ? "common.saved" : "common.created" };
}

export async function respondCost(_: ActionState, formData: FormData) {
  await requireProfile(["supplier"]);
  const v = formValues(formData);
  return rpc("respond_nc_cost", { p_cost_id: v.id, p_accept: v.decision === "accept", p_justification: v.justification ?? "" },
    ncPath(v.nc_id!, "costs"), "costs.answered");
}

export async function debitCost(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  if (!v.id || !v.nc_id) return { error: "common.genericError" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("nc_costs")
    .update({ status: "debited", sqe_decision_comment: v.sqe_decision_comment }).eq("id", v.id).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(ncPath(v.nc_id, "costs"));
  return { success: "costs.debited" };
}

// -------------------------------------------------------------------- comentários
export async function addComment(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const v = formValues(formData);
  if (!v.nc_id || !v.body) return { error: "common.genericError" };
  const supabase = await createClient();
  const { error } = await supabase.from("nc_comments").insert({
    nc_id: v.nc_id, body: v.body, internal: profile.role !== "supplier" && checkbox(formData, "internal"),
  } as never);
  if (error) return { error: dbErrorKey(error) };
  revalidatePath(ncPath(v.nc_id, "comments"));
  return { success: "comments.sent" };
}
