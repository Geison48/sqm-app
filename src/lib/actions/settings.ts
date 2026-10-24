"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { dbErrorKey } from "@/lib/db-errors";
import { formValues, type ActionState } from "@/lib/action-state";

const LOOKUPS = ["supplier_statuses", "contact_roles", "qualification_step_types"] as const;

const lookupSchema = z.object({
  table: z.enum(LOOKUPS),
  code: z.string().regex(/^[a-z][a-z0-9_]*$/).nullish(),
  label_pt: z.string().min(1),
  label_en: z.string().min(1),
  sort_order: z.coerce.number().int(),
  tone: z.enum(["neutral", "success", "warning", "danger", "info"]).nullish(),
});

export async function saveLookupItem(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = lookupSchema.safeParse({ ...raw, sort_order: raw.sort_order ?? 0 });
  if (!parsed.success) return { error: "common.genericError" };
  const { table, code, tone, ...labels } = parsed.data;
  const values = { ...labels, ...(table === "supplier_statuses" && tone ? { tone } : {}) };

  // Três tabelas com o mesmo formato; valores já validados pelo zod.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = raw.id
    ? await supabase.from(table).update(values).eq("id", raw.id).select("id")
    : code
      ? await supabase.from(table).insert({ ...values, code }).select("id")
      : { data: null, error: { code: "", message: "" } };
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };
  revalidatePath("/settings");
  return { success: raw.id ? "common.saved" : "common.created" };
}

export async function saveGeneralSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const days = (raw.certificate_alert_days ?? "").split(/[,\s;]+/).filter(Boolean).map(Number);
  if (days.length === 0 || days.some((d) => !Number.isInteger(d) || d <= 0)) return { error: "settings.invalidDays" };
  const timezone = raw.timezone ?? "";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { error: "common.genericError" };
  }

  const supabase = await createClient();
  const updates = [
    supabase.from("app_settings").update({ value: [...new Set(days)].sort((a, b) => b - a) }).eq("key", "certificate_alert_days"),
    supabase.from("app_settings").update({ value: timezone }).eq("key", "timezone"),
  ];
  for (const result of await Promise.all(updates)) {
    if (result.error) return { error: dbErrorKey(result.error) };
  }
  revalidatePath("/settings");
  return { success: "common.saved" };
}
