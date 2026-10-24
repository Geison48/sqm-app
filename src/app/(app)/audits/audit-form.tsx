import { getLocale, getTranslations } from "next-intl/server";
import type { FieldDef } from "@/components/shared/record-dialog";
import { createClient } from "@/lib/supabase/server";
import { getInternalUsers, getLookup, lookupLabel } from "@/lib/lookups";
import type { Profile } from "@/lib/auth";

type AuditValues = {
  supplier_id?: string; type_code?: string; template_id?: string | null; title?: string | null; planned_start?: string;
  planned_end?: string; lead_auditor_id?: string | null; plant_id?: string | null; scope_codes?: string[]; auditor_ids?: string[];
  summary?: string | null; status?: string;
};

// Campos do formulário de auditoria (criação e edição), com listas do banco.
export async function auditFields(profile: Profile, values?: AuditValues, opts: { supplierFixed?: boolean } = {}) {
  const t = await getTranslations("audits");
  const locale = await getLocale();
  const supabase = await createClient();
  const [types, scopes, users, { data: suppliers }, { data: templates }, { data: plants }] = await Promise.all([
    getLookup("audit_types"),
    getLookup("audit_scopes"),
    getInternalUsers(),
    supabase.from("suppliers").select("id, legal_name, responsible_sqe_id").is("cancelled_at", null).order("legal_name"),
    supabase.from("audit_templates").select("id, code, name_pt, name_en, version").eq("status", "active").is("cancelled_at", null).order("code"),
    values?.supplier_id
      ? supabase.from("plants").select("id, name").eq("supplier_id", values.supplier_id).is("cancelled_at", null)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const manageable = (suppliers ?? []).filter((s) => profile.role === "sqm" || s.responsible_sqe_id === profile.id);
  const started = values?.status && !["planned", "scheduled"].includes(values.status);
  const fields: FieldDef[] = [];
  if (!opts.supplierFixed) {
    fields.push({ name: "supplier_id", label: t("supplier"), type: "select", required: true,
      options: manageable.map((s) => ({ value: s.id, label: s.legal_name })), defaultValue: values?.supplier_id });
  }
  fields.push(
    { name: "type_code", label: t("type"), type: "select", required: true, span: 1,
      options: types.map((x) => ({ value: x.code, label: lookupLabel(x, locale) })), defaultValue: values?.type_code ?? "process" },
    { name: "title", label: t("auditTitle"), span: 1, defaultValue: values?.title },
    { name: "planned_start", label: t("plannedStart"), type: "date", required: true, span: 1, defaultValue: values?.planned_start },
    { name: "planned_end", label: t("plannedEnd"), type: "date", required: true, span: 1, defaultValue: values?.planned_end },
    { name: "lead_auditor_id", label: t("leadAuditor"), type: "select", span: 1,
      options: users.map((u) => ({ value: u.id, label: u.full_name })), defaultValue: values?.lead_auditor_id ?? profile.id },
  );
  if (plants && plants.length) {
    fields.push({ name: "plant_id", label: t("plant"), type: "select", span: 1,
      options: plants.map((p) => ({ value: p.id, label: p.name })), defaultValue: values?.plant_id });
  }
  if (!started) {
    fields.push(
      { name: "template_id", label: t("template"), type: "select",
        options: (templates ?? []).map((x) => ({ value: x.id, label: `${x.code} v${x.version} — ${locale === "en" ? x.name_en : x.name_pt}` })),
        defaultValue: values?.template_id },
      { name: "scope_codes", label: t("scopes"), type: "multicheck", hint: t("scopesHint"),
        options: scopes.map((x) => ({ value: x.code, label: lookupLabel(x, locale) })), defaultValue: values?.scope_codes ?? [] },
    );
  }
  fields.push({ name: "auditor_ids", label: t("auditors"), type: "multicheck",
    options: users.map((u) => ({ value: u.id, label: u.full_name })), defaultValue: values?.auditor_ids ?? [] });
  return { fields, hasScopes: !started };
}
