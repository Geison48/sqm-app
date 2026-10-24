import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { param } from "@/lib/filters";
import { NewNcForm } from "./new-nc-form";

export async function generateMetadata() {
  const t = await getTranslations("ncs");
  return { title: t("newTitle") };
}

export default async function NewNcPage({ searchParams }: PageProps<"/ncs/new">) {
  const profile = await requireProfile(["sqe", "sqm"]);
  const t = await getTranslations("ncs");
  const locale = await getLocale();
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: suppliers }, { data: links }, origins, severities, failureModes, dispositions] = await Promise.all([
    supabase.from("suppliers").select("id, legal_name, responsible_sqe_id").is("cancelled_at", null).order("legal_name"),
    supabase.from("supplier_components").select("supplier_id, components(id, gw_code, description)").is("cancelled_at", null),
    getLookup("nc_origins"),
    getLookup("nc_severities"),
    getLookup("failure_modes"),
    getLookup("dispositions"),
  ]);
  // Só fornecedores que o usuário pode gerenciar (a RLS confere de novo).
  const manageable = (suppliers ?? []).filter((s) => profile.role === "sqm" || s.responsible_sqe_id === profile.id);
  const componentsBySupplier: Record<string, { value: string; label: string }[]> = {};
  for (const l of links ?? []) {
    if (!l.components) continue;
    (componentsBySupplier[l.supplier_id] ??= []).push({ value: l.components.id, label: `${l.components.gw_code} — ${l.components.description}` });
  }
  const opts = (items: { code: string; label_pt: string; label_en: string }[]) =>
    items.map((i) => ({ value: i.code, label: lookupLabel(i, locale) }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("newTitle")} />
      <NewNcForm
        suppliers={manageable.map((s) => ({ value: s.id, label: s.legal_name }))}
        componentsBySupplier={componentsBySupplier}
        origins={opts(origins)}
        severities={opts(severities)}
        failureModes={opts(failureModes)}
        dispositions={opts(dispositions)}
        defaultSupplier={param(sp.supplier)}
      />
    </div>
  );
}
