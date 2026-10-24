import { getTranslations } from "next-intl/server";
import { DatabaseIcon, DownloadIcon, PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ZipForm } from "./zip-form";

export async function generateMetadata() {
  const t = await getTranslations("exports");
  return { title: t("title") };
}

export default async function ExportsPage() {
  const profile = await requireProfile(["sqe", "sqm"]);
  const t = await getTranslations("exports");
  const supabase = await createClient();
  const [{ data: suppliers }, { data: links }, { data: units }] = await Promise.all([
    supabase.from("suppliers").select("id, legal_name").is("cancelled_at", null).order("legal_name"),
    supabase.from("supplier_components").select("supplier_id, components(id, gw_code, description)").is("cancelled_at", null),
    supabase.from("serial_units").select("id, identifier, supplier_id, component_id").is("cancelled_at", null).order("identifier"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex gap-3">
          <PackageIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="font-medium">{t("zipTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("zipHint")}</p>
          </div>
        </div>
        <ZipForm
          suppliers={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name }))}
          components={(links ?? []).filter((l) => l.components).map((l) => ({
            supplierId: l.supplier_id, value: l.components!.id, label: `${l.components!.gw_code} — ${l.components!.description}` }))}
          units={(units ?? []).map((u) => ({ value: u.id, label: u.identifier, supplierId: u.supplier_id, componentId: u.component_id }))}
          defaultLang={profile.language}
        />
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex gap-3">
          <DatabaseIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="font-medium">{t("dbTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("dbHint")}</p>
          </div>
        </div>
        {profile.role === "sqm" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><a href="/exports/database?format=json"><DownloadIcon />{t("json")}</a></Button>
            <Button variant="outline" asChild><a href="/exports/database?format=csv"><DownloadIcon />{t("csv")}</a></Button>
          </div>
        ) : <p className="text-sm text-muted-foreground">{t("sqmOnly")}</p>}
      </section>
    </div>
  );
}
