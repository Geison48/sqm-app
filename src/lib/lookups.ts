import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type LookupItem = {
  id: string;
  code: string;
  label_pt: string;
  label_en: string;
  sort_order: number;
  is_system: boolean;
  cancelled_at: string | null;
};
export type StatusItem = LookupItem & { tone: string };

export function lookupLabel(item: { label_pt: string; label_en: string } | undefined | null, locale: string) {
  if (!item) return "—";
  return locale === "en" ? item.label_en : item.label_pt;
}

export const getSupplierStatuses = cache(async (includeCancelled = false): Promise<StatusItem[]> => {
  const supabase = await createClient();
  let q = supabase.from("supplier_statuses").select("*").order("sort_order");
  if (!includeCancelled) q = q.is("cancelled_at", null);
  return ((await q).data ?? []) as StatusItem[];
});

export const getContactRoles = cache(async (includeCancelled = false): Promise<LookupItem[]> => {
  const supabase = await createClient();
  let q = supabase.from("contact_roles").select("*").order("sort_order");
  if (!includeCancelled) q = q.is("cancelled_at", null);
  return ((await q).data ?? []) as LookupItem[];
});

export const getQualificationStepTypes = cache(async (includeCancelled = false): Promise<LookupItem[]> => {
  const supabase = await createClient();
  let q = supabase.from("qualification_step_types").select("*").order("sort_order");
  if (!includeCancelled) q = q.is("cancelled_at", null);
  return ((await q).data ?? []) as LookupItem[];
});

export const getInternalUsers = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("role", ["sqe", "sqm"])
    .is("cancelled_at", null)
    .order("full_name");
  return data ?? [];
});

// Listas da etapa 3 (mesmo formato; status de severidade tem cor).
type LookupTable =
  | "nc_origins" | "nc_severities" | "failure_modes" | "dispositions" | "containment_locations" | "cost_types"
  | "eight_d_disciplines" | "audit_types" | "audit_scopes";

export const getLookup = cache(async (table: LookupTable, includeCancelled = false) => {
  const supabase = await createClient();
  let q = supabase.from(table).select("*").order("sort_order");
  if (!includeCancelled) q = q.is("cancelled_at", null);
  return ((await q).data ?? []) as (StatusItem & { deadline_hours?: number })[];
});

export const getNumericSetting = cache(async (key: string, fallback: number) => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) ? n : fallback;
});
