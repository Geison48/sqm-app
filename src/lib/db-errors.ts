import type { PostgrestError } from "@supabase/supabase-js";

// Erros levantados pelas regras do banco → chave de tradução em "errors.*".
const KNOWN = [
  "cnpj_invalid", "cnpj_required", "status_requires_justification", "justification_required", "forbidden",
  "only_sqm_can_reassign", "lookup_system_item", "lookup_code_immutable", "record_cancelled", "status_unchanged",
  "responsible_must_be_internal", "invalid_status",
] as const;

export function dbErrorKey(error: Pick<PostgrestError, "code" | "message"> | null | undefined): string {
  if (!error) return "common.genericError";
  const known = KNOWN.find((k) => error.message?.includes(k));
  if (known) return `errors.${known}`;
  if (error.code === "23505") return "errors.duplicate";
  if (error.code === "42501") return "errors.forbidden";
  return "common.genericError";
}
