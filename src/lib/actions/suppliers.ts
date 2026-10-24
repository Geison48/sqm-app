"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { dbErrorKey } from "@/lib/db-errors";
import { checkbox, formValues, type ActionState } from "@/lib/action-state";
import { isValidCnpj } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
type Writable = "suppliers" | "plants" | "contacts" | "certifications" | "sub_suppliers" | "supplier_components"
  | "sub_supplier_components" | "qualifications" | "qualification_steps";

const supplierPath = (id: string, tab?: string) => `/suppliers/${id}${tab ? `?tab=${tab}` : ""}`;

// Insere ou atualiza sob RLS; 0 linhas afetadas = sem permissão.
async function save<T extends Writable>(
  table: T,
  id: string | null,
  values: Tables[T]["Update"],
): Promise<{ id?: string; error?: string }> {
  // Cliente sem tipagem por tabela: os valores já foram validados pelo zod.
  const db = (await createClient()) as unknown as SupabaseClient;
  const query = id
    ? db.from(table).update(values).eq("id", id).select("id")
    : db.from(table).insert(values).select("id");
  const { data, error } = await query;
  if (error) return { error: dbErrorKey(error) };
  const row = (data as { id: string }[] | null)?.[0];
  if (!row) return { error: "errors.forbidden" };
  return { id: row.id };
}

const criticality = z.enum(["A", "B", "C"]);
const country = z.string().length(2).transform((v) => v.toUpperCase());
const uuid = z.uuid();
const optionalDate = z.iso.date().nullish();

// -------------------------------------------------------------------- fornecedor
const supplierSchema = z
  .object({
    legal_name: z.string().min(1),
    trade_name: z.string().nullish(),
    country_code: country,
    tax_id: z.string().nullish(),
    criticality,
    website: z.string().nullish(),
    notes: z.string().nullish(),
    responsible_sqe_id: uuid.nullish(),
    status_code: z.string().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.country_code !== "BR") return;
    if (!v.tax_id) ctx.addIssue({ code: "custom", message: "errors.cnpj_required", path: ["tax_id"] });
    else if (!isValidCnpj(v.tax_id)) ctx.addIssue({ code: "custom", message: "errors.cnpj_invalid", path: ["tax_id"] });
  });

export async function saveSupplier(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = supplierSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return { error: msg?.startsWith("errors.") ? msg : "common.genericError" };
  }
  const { status_code, responsible_sqe_id, ...data } = parsed.data;
  const id = raw.id;

  if (id) {
    const values: Tables["suppliers"]["Update"] = { ...data };
    if (profile.role === "sqm" && responsible_sqe_id) values.responsible_sqe_id = responsible_sqe_id;
    const result = await save("suppliers", id, values);
    if (result.error) return { error: result.error };
    revalidatePath(supplierPath(id));
    return { success: "common.saved" };
  }

  const result = await save("suppliers", null, {
    ...data,
    status_code: status_code ?? "in_qualification",
    responsible_sqe_id: profile.role === "sqm" ? responsible_sqe_id ?? profile.id : profile.id,
  });
  if (result.error) return { error: result.error };
  revalidatePath("/suppliers");
  redirect(supplierPath(result.id!));
}

export async function changeSupplierStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const v = formValues(formData);
  if (!v.supplier_id || !v.status_code) return { error: "common.genericError" };
  if (!v.justification || v.justification.length < 5) return { error: "errors.justification_required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_supplier_status", {
    p_supplier_id: v.supplier_id,
    p_status: v.status_code,
    p_justification: v.justification,
  });
  if (error) return { error: dbErrorKey(error) };
  revalidatePath(supplierPath(v.supplier_id));
  revalidatePath("/suppliers");
  return { success: "suppliers.statusChanged" };
}

// -------------------------------------------------------------------- filhos
async function saveChild<T extends Writable>(
  table: T,
  tab: string,
  formData: FormData,
  schema: z.ZodType<Tables[T]["Update"]>,
  extra?: (raw: Record<string, string | null>) => Partial<Tables[T]["Update"]>,
): Promise<ActionState> {
  await requireProfile();
  const raw = formValues(formData);
  const supplierId = raw.supplier_id;
  if (!supplierId) return { error: "common.genericError" };
  const parsed = schema.safeParse({ ...raw, ...extra?.(raw) });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return { error: msg?.startsWith("errors.") ? msg : "common.genericError" };
  }
  const values = { ...parsed.data } as Tables[T]["Update"] & { supplier_id?: string };
  if (raw.id) delete values.supplier_id;
  const result = await save(table, raw.id ?? null, values);
  if (result.error) return { error: result.error };
  revalidatePath(supplierPath(supplierId, tab));
  return { success: raw.id ? "common.saved" : "common.created" };
}

const plantSchema = z.object({
  supplier_id: uuid,
  name: z.string().min(1),
  address_line: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  postal_code: z.string().nullish(),
  country_code: country,
  is_main: z.boolean(),
  notes: z.string().nullish(),
});
export async function savePlant(_: ActionState, formData: FormData) {
  return saveChild("plants", "plants", formData, plantSchema, () => ({ is_main: checkbox(formData, "is_main") }));
}

const contactSchema = z.object({
  supplier_id: uuid,
  role_code: z.string().min(1),
  full_name: z.string().min(1),
  job_title: z.string().nullish(),
  email: z.email().nullish(),
  phone: z.string().nullish(),
  plant_id: uuid.nullish(),
  is_primary: z.boolean(),
});
export async function saveContact(_: ActionState, formData: FormData) {
  return saveChild("contacts", "contacts", formData, contactSchema, () => ({
    is_primary: checkbox(formData, "is_primary"),
  }));
}

const certificationSchema = z
  .object({
    supplier_id: uuid,
    sub_supplier_id: uuid.nullish(),
    standard_id: uuid.nullish(),
    standard_name: z.string().min(1),
    certificate_number: z.string().nullish(),
    issuer: z.string().nullish(),
    scope: z.string().nullish(),
    issued_on: optionalDate,
    valid_until: optionalDate,
  })
  .refine((v) => !v.issued_on || !v.valid_until || v.valid_until >= v.issued_on, { message: "errors.invalidDates" });
export async function saveCertification(_: ActionState, formData: FormData) {
  return saveChild("certifications", "certifications", formData, certificationSchema);
}

const subSupplierSchema = z.object({
  supplier_id: uuid,
  name: z.string().min(1),
  country_code: z.string().length(2).nullish(),
  material: z.string().nullish(),
  notes: z.string().nullish(),
});
export async function saveSubSupplier(_: ActionState, formData: FormData) {
  return saveChild("sub_suppliers", "subSuppliers", formData, subSupplierSchema);
}

const linkSchema = z.object({ supplier_id: uuid, component_id: uuid, supplier_part_number: z.string().nullish() });
export async function linkSupplierComponent(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await saveChild("supplier_components", "components", formData, linkSchema);
  const componentId = formValues(formData).component_id;
  if (componentId) revalidatePath(`/components/${componentId}`);
  return result;
}

const subLinkSchema = z.object({ supplier_id: uuid, sub_supplier_id: uuid, component_id: uuid });
export async function linkSubSupplierComponent(_: ActionState, formData: FormData) {
  return saveChild("sub_supplier_components", "subSuppliers", formData, subLinkSchema);
}

// -------------------------------------------------------------------- qualificação
const qualificationSchema = z
  .object({
    supplier_id: uuid,
    status: z.enum(["in_progress", "approved", "approved_conditional", "rejected"]),
    purchasing_contact: z.string().nullish(),
    final_opinion: z.string().nullish(),
    concluded_on: optionalDate,
  })
  .refine((v) => v.status === "in_progress" || (!!v.concluded_on && !!v.final_opinion), {
    message: "errors.conclusionRequired",
  });
export async function saveQualification(_: ActionState, formData: FormData) {
  const raw = formValues(formData);
  return saveChild("qualifications", "qualification", formData, qualificationSchema, () => ({
    status: raw.status ?? "in_progress",
  }));
}

const stepSchema = z.object({
  supplier_id: uuid,
  result: z.enum(["pending", "approved", "approved_conditional", "rejected", "not_applicable"]),
  performed_on: optionalDate,
  score: z.coerce.number().min(0).max(100).nullish(),
  comments: z.string().nullish(),
});
export async function saveQualificationStep(_: ActionState, formData: FormData) {
  return saveChild("qualification_steps", "qualification", formData, stepSchema);
}
