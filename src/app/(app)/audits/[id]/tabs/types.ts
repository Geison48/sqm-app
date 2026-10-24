import type { Database } from "@/lib/database.types";

export type AuditRow = Database["public"]["Tables"]["audits"]["Row"] & {
  suppliers: { id: string; legal_name: string } | null;
  audit_templates: { code: string; version: number; name_pt: string; name_en: string; method: string } | null;
};
