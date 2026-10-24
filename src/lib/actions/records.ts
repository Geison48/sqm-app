"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorKey } from "@/lib/db-errors";
import type { ActionState } from "@/lib/action-state";

// Tabelas que podem ser canceladas pela interface (a RLS decide quem pode).
const CANCELLABLE = [
  "suppliers", "plants", "contacts", "certifications", "sub_suppliers", "supplier_components",
  "component_standards", "sub_supplier_components", "components", "standards", "standard_requirements",
  "attachments", "qualifications", "supplier_statuses", "contact_roles", "qualification_step_types",
  "ncs", "nc_items", "containment_actions", "nc_costs", "nc_comments", "nc_origins", "nc_severities", "failure_modes",
  "dispositions", "containment_locations", "cost_types",
] as const;

const schema = z.object({
  table: z.enum(CANCELLABLE),
  id: z.uuid(),
  reason: z.string().trim().min(3),
  path: z.string().startsWith("/"),
});

// Regra 16: nada é apagado; cancelar = cancelled_at + motivo (fica no audit_log).
export async function cancelRecord(input: z.input<typeof schema>): Promise<ActionState> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.path[0] === "reason" ? "errors.cancelReasonShort" : "common.genericError" };
  }
  const { table, id, reason, path } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update({ cancelled_at: new Date().toISOString(), cancel_reason: reason })
    .eq("id", id)
    .select("id");
  if (error) return { error: dbErrorKey(error) };
  if (!data?.length) return { error: "errors.forbidden" };

  revalidatePath(path);
  return { success: "common.recordCancelled" };
}
