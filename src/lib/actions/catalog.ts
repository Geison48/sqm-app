"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { dbErrorKey } from "@/lib/db-errors";
import { formValues, type ActionState } from "@/lib/action-state";

const uuid = z.uuid();

function firstError(error: z.ZodError) {
  const msg = error.issues[0]?.message;
  return msg?.startsWith("errors.") ? msg : "common.genericError";
}

// -------------------------------------------------------------------- componentes
const componentSchema = z.object({
  gw_code: z.string().min(1).transform((v) => v.toUpperCase()),
  description: z.string().min(1),
  drawing_revision: z.string().nullish(),
  criticality: z.enum(["A", "B", "C"]),
  control_plan_ref: z.string().nullish(),
  notes: z.string().nullish(),
});

export async function saveComponent(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = componentSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();

  if (raw.id) {
    const { data, error } = await supabase.from("components").update(parsed.data).eq("id", raw.id).select("id");
    if (error) return { error: dbErrorKey(error) };
    if (!data?.length) return { error: "errors.forbidden" };
    revalidatePath(`/components/${raw.id}`);
    return { success: "common.saved" };
  }
  const { data, error } = await supabase.from("components").insert(parsed.data).select("id").single();
  if (error) return { error: dbErrorKey(error) };
  revalidatePath("/components");
  redirect(`/components/${data.id}`);
}

export async function linkComponentStandard(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const parsed = z.object({ component_id: uuid, standard_id: uuid }).safeParse(formValues(formData));
  if (!parsed.success) return { error: "common.genericError" };
  const supabase = await createClient();
  const { error } = await supabase.from("component_standards").insert(parsed.data);
  if (error) return { error: dbErrorKey(error) };
  revalidatePath(`/components/${parsed.data.component_id}`);
  return { success: "common.created" };
}

// -------------------------------------------------------------------- normas
const standardSchema = z.object({
  code: z.string().min(1),
  title_pt: z.string().min(1),
  title_en: z.string().min(1),
  revision: z.string().nullish(),
  application: z.enum(["product", "process", "system"]),
  issuer: z.string().nullish(),
  notes: z.string().nullish(),
});

export async function saveStandard(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = standardSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();

  if (raw.id) {
    const { data, error } = await supabase.from("standards").update(parsed.data).eq("id", raw.id).select("id");
    if (error) return { error: dbErrorKey(error) };
    if (!data?.length) return { error: "errors.forbidden" };
    revalidatePath(`/standards/${raw.id}`);
    return { success: "common.saved" };
  }
  const { data, error } = await supabase.from("standards").insert(parsed.data).select("id").single();
  if (error) return { error: dbErrorKey(error) };
  revalidatePath("/standards");
  redirect(`/standards/${data.id}`);
}

const requirementSchema = z.object({
  standard_id: uuid,
  item_code: z.string().min(1),
  text_pt: z.string().min(1),
  text_en: z.string().min(1),
  kind: z.enum(["audit", "inspection", "both"]),
  sort_order: z.coerce.number().int().default(0),
});

export async function saveRequirement(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = requirementSchema.safeParse({ ...raw, sort_order: raw.sort_order ?? 0 });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { standard_id, ...values } = parsed.data;
  const { data, error } = raw.id
    ? await supabase.from("standard_requirements").update(values).eq("id", raw.id).select("id")
    : await supabase.from("standard_requirements").insert({ standard_id, ...values }).select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath(`/standards/${standard_id}`);
  return { success: raw.id ? "common.saved" : "common.created" };
}
