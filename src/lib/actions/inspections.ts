"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { dbErrorKey } from "@/lib/db-errors";
import { checkbox, formValues, type ActionState } from "@/lib/action-state";

const uuid = z.uuid();
const multi = (fd: FormData, name: string) => fd.getAll(name).map(String).filter(Boolean);

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

// -------------------------------------------------------------------- inspeções
const inspectionSchema = z.object({
  supplier_id: uuid,
  component_id: uuid,
  type_code: z.string().min(1),
  location: z.string().nullish(),
  inspected_on: z.iso.date(),
  notes: z.string().nullish(),
});

export async function createInspection(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const raw = formValues(formData);
  const [pairSupplier, pairComponent] = (raw.pair ?? "").split("|");
  const parsed = inspectionSchema.safeParse({
    ...raw,
    component_id: raw.component_id ?? pairComponent,
    ...(pairSupplier ? { supplier_id: pairSupplier } : {}),
    ...(profile.role === "supplier" ? { supplier_id: profile.supplierId } : pairSupplier ? {} : { supplier_id: raw.supplier_id }),
    type_code: profile.role === "supplier" ? "self_inspection" : raw.type_code,
  });
  if (!parsed.success) return { error: zodError(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("inspections").insert(parsed.data as never).select("id").single();
  if (error) return { error: dbErrorKey(error) };
  revalidatePath("/inspections");
  redirect(`/inspections/${data.id}`);
}

export async function addInspectionUnit(inspectionId: string, unitId: string) {
  await requireProfile();
  return rpc("add_inspection_unit", { p_inspection_id: inspectionId, p_unit_id: unitId }, [`/inspections/${inspectionId}`], "common.saved");
}

const resultSchema = z.object({
  id: uuid,
  inspectionId: uuid,
  measured: z.string().optional(),
  qty_inspected: z.number().nonnegative().nullable().optional(),
  qty_nok: z.number().nonnegative().nullable().optional(),
  ok: z.boolean().nullable().optional(),
  comment: z.string().nullable().optional(),
});

// Salva uma linha de resultado; o banco reavalia OK/NOK pelos limites.
export async function saveResult(input: z.input<typeof resultSchema>): Promise<{ error?: string; ok?: boolean | null; auto?: boolean }> {
  await requireProfile();
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return { error: "common.genericError" };
  const { id, inspectionId, measured, ...rest } = parsed.data;
  const values: Record<string, unknown> = { ...rest };
  if (measured !== undefined) {
    const parts = measured.split(/[\s;]+/).map((v) => v.replace(",", ".")).filter(Boolean);
    const numbers = parts.map(Number);
    if (numbers.some((n) => !Number.isFinite(n))) return { error: "errors.invalidValues" };
    values.measured_values = numbers;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("inspection_results").update(values as never).eq("id", id)
    .select("ok, auto_evaluated");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  void inspectionId;
  return { ok: data[0]!.ok, auto: data[0]!.auto_evaluated };
}

export async function completeInspection(inspectionId: string) {
  await requireProfile();
  return rpc("complete_inspection", { p_inspection_id: inspectionId }, [`/inspections/${inspectionId}`, "/inspections"],
    "inspections.completed");
}

export async function applyWaiver(_: ActionState, formData: FormData) {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  return rpc("apply_waiver", { p_result_id: v.result_id, p_waiver_id: v.waiver_id }, [`/inspections/${v.inspection_id}`],
    "inspections.waiverApplied");
}

// -------------------------------------------------------------------- peças e reparos
const unitSchema = z.object({
  supplier_id: uuid,
  component_id: uuid,
  identifier: z.string().min(1).transform((v) => v.trim().toUpperCase()),
  kind: z.enum(["serial", "lot"]),
  quantity: z.coerce.number().positive(),
  production_date: z.iso.date().nullish(),
  notes: z.string().nullish(),
});

export async function registerUnit(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const raw = formValues(formData);
  const [pairSupplier, pairComponent] = (raw.pair ?? "").split("|");
  const parsed = unitSchema.safeParse({
    ...raw,
    component_id: raw.component_id ?? pairComponent,
    supplier_id: profile.role === "supplier" ? profile.supplierId : raw.supplier_id ?? pairSupplier,
    quantity: raw.kind === "lot" ? raw.quantity ?? 1 : 1,
  });
  if (!parsed.success) return { error: zodError(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("serial_units").insert(parsed.data as never).select("id").single();
  if (error) return { error: dbErrorKey(error) };
  revalidatePath("/inspections/units");
  redirect(`/inspections/units/${data.id}`);
}

export async function openRepair(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile();
  const v = formValues(formData);
  if (!v.serial_unit_id || !v.description) return { error: "common.genericError" };
  const supabase = await createClient();
  const { error } = await supabase.from("repairs").insert({
    serial_unit_id: v.serial_unit_id, description: v.description, performed_by: v.performed_by,
    started_on: v.started_on ?? undefined,
  } as never);
  if (error) return { error: dbErrorKey(error) };
  revalidatePath(`/inspections/units/${v.serial_unit_id}`);
  return { success: "repairs.opened" };
}

export async function completeRepair(_: ActionState, formData: FormData) {
  await requireProfile();
  const v = formValues(formData);
  return rpc("complete_repair", { p_repair_id: v.id, p_notes: v.completion_notes ?? "" },
    [`/inspections/units/${v.serial_unit_id}`], "repairs.completed");
}

export async function scrapUnit(_: ActionState, formData: FormData) {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  return rpc("scrap_unit", { p_unit_id: v.id, p_reason: v.reason ?? "" }, [`/inspections/units/${v.id}`], "units.scrapped");
}

// -------------------------------------------------------------------- concessões
const waiverSchema = z
  .object({
    supplier_id: uuid,
    component_id: uuid,
    description: z.string().min(1),
    justification: z.string().min(1),
    valid_until: z.iso.date().nullish(),
    max_quantity: z.coerce.number().positive().nullish(),
    characteristic_ids: z.array(uuid),
    serial_unit_ids: z.array(uuid),
  })
  .refine((w) => !!w.valid_until || !!w.max_quantity || w.serial_unit_ids.length > 0, { message: "waivers.limitHint" });

export async function requestWaiver(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const raw = formValues(formData);
  const parsed = waiverSchema.safeParse({
    ...raw,
    supplier_id: profile.role === "supplier" ? profile.supplierId : raw.supplier_id,
    characteristic_ids: multi(formData, "characteristic_ids"),
    serial_unit_ids: multi(formData, "serial_unit_ids"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return { error: msg === "waivers.limitHint" ? msg : zodError(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("waivers").insert(parsed.data as never);
  if (error) return { error: dbErrorKey(error) };
  revalidatePath("/inspections/waivers");
  return { success: "waivers.requested" };
}

export async function reviewWaiver(_: ActionState, formData: FormData) {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  return rpc("review_waiver", { p_waiver_id: v.id, p_approve: v.decision === "approve", p_comment: v.comment ?? "" },
    ["/inspections/waivers"], "waivers.reviewed");
}

// -------------------------------------------------------------------- planos
export async function createPlan(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  if (!v.component_id) return { error: "common.genericError" };
  const supabase = await createClient();
  const { data, error } = v.id
    ? await supabase.from("inspection_plans").update({ revision: v.revision ?? "A", notes: v.notes }).eq("id", v.id).select("id")
    : await supabase.from("inspection_plans").insert({ component_id: v.component_id, revision: v.revision ?? "A", notes: v.notes }).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath("/inspections/plans");
  if (!v.id) redirect(`/inspections/plans/${data[0]!.id}`);
  revalidatePath(`/inspections/plans/${v.id}`);
  return { success: "common.saved" };
}

const characteristicSchema = z.object({
  plan_id: uuid,
  char_type_code: z.string().min(1),
  name_pt: z.string().min(1),
  name_en: z.string().min(1),
  specification: z.string().nullish(),
  nominal: z.coerce.number().nullish(),
  lower_limit: z.coerce.number().nullish(),
  upper_limit: z.coerce.number().nullish(),
  unit: z.string().nullish(),
  method: z.string().nullish(),
  instrument: z.string().nullish(),
  sampling: z.enum(["100", "aql"]),
  aql_level: z.string().nullish(),
  sample_size: z.coerce.number().int().positive().nullish(),
  accept_number: z.coerce.number().int().nonnegative().nullish(),
  is_critical: z.boolean(),
  standard_requirement_id: uuid.nullish(),
  sort_order: z.coerce.number().int(),
});

export async function saveCharacteristic(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = characteristicSchema.safeParse({ ...raw, is_critical: checkbox(formData, "is_critical"), sort_order: raw.sort_order ?? 0 });
  if (!parsed.success) return { error: zodError(parsed.error) };
  const { plan_id, ...values } = parsed.data;
  const supabase = await createClient();
  const { data, error } = raw.id
    ? await supabase.from("inspection_characteristics").update(values as never).eq("id", raw.id).select("id")
    : await supabase.from("inspection_characteristics").insert({ plan_id, ...values } as never).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(`/inspections/plans/${plan_id}`);
  return { success: raw.id ? "common.saved" : "common.created" };
}
