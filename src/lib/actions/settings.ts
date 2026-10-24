"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { dbErrorKey } from "@/lib/db-errors";
import { formValues, type ActionState } from "@/lib/action-state";

const LOOKUPS = [
  "supplier_statuses", "contact_roles", "qualification_step_types", "nc_origins", "nc_severities", "failure_modes",
  "dispositions", "containment_locations", "cost_types", "eight_d_disciplines",
] as const;
const WITH_TONE = new Set(["supplier_statuses", "nc_severities"]);

const lookupSchema = z.object({
  table: z.enum(LOOKUPS),
  code: z.string().regex(/^[a-z][a-z0-9_]*$/).nullish(),
  label_pt: z.string().min(1),
  label_en: z.string().min(1),
  sort_order: z.coerce.number().int(),
  tone: z.enum(["neutral", "success", "warning", "danger", "info"]).nullish(),
  deadline_hours: z.coerce.number().int().positive().nullish(),
});

export async function saveLookupItem(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireProfile(["sqe", "sqm"]);
  const raw = formValues(formData);
  const parsed = lookupSchema.safeParse({ ...raw, sort_order: raw.sort_order ?? 0 });
  if (!parsed.success) return { error: "common.genericError" };
  const { table, code, tone, deadline_hours, ...labels } = parsed.data;
  const values = {
    ...labels,
    ...(WITH_TONE.has(table) && tone ? { tone } : {}),
    ...(table === "eight_d_disciplines" && deadline_hours ? { deadline_hours } : {}),
  };

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

  const ratio = Number(raw.deadline_warning_ratio) / 100;
  const simpleDays = Number(raw.simple_nc_response_days);
  const recurrence = Number(raw.recurrence_window_days);
  if (!(ratio > 0 && ratio < 1) || !(simpleDays > 0) || !(recurrence > 0)) return { error: "settings.invalidNumber" };

  const supabase = await createClient();
  const set = (key: string, value: unknown) => supabase.from("app_settings").update({ value: value as never }).eq("key", key);
  const updates = [
    set("certificate_alert_days", [...new Set(days)].sort((a, b) => b - a)),
    set("timezone", timezone),
    set("deadline_warning_ratio", ratio),
    set("simple_nc_response_days", Math.round(simpleDays)),
    set("recurrence_window_days", Math.round(recurrence)),
  ];
  for (const result of await Promise.all(updates)) {
    if (result.error) return { error: dbErrorKey(result.error) };
  }
  revalidatePath("/settings");
  return { success: "common.saved" };
}
