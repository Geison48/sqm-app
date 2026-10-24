import { getLocale, getTranslations } from "next-intl/server";
import { countryName, formatTaxId } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Supplier = Database["public"]["Tables"]["suppliers"]["Row"] & {
  users: { full_name: string; email: string } | null;
};

export async function OverviewTab({ supplier }: { supplier: Supplier }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const items: [string, React.ReactNode][] = [
    [t("suppliers.legalName"), supplier.legal_name],
    [t("suppliers.tradeName"), supplier.trade_name ?? "—"],
    [t("suppliers.country"), countryName(supplier.country_code, locale)],
    [supplier.country_code === "BR" ? t("suppliers.cnpj") : t("suppliers.taxIdForeign"),
      <span key="tax" className="font-mono">{formatTaxId(supplier.country_code, supplier.tax_id)}</span>],
    [t("criticality.label"), t(`criticality.${supplier.criticality as "A"}`)],
    [t("suppliers.responsibleSqe"), supplier.users ? `${supplier.users.full_name} · ${supplier.users.email}` : "—"],
    [t("suppliers.website"), supplier.website ? (
      <a key="w" href={supplier.website} target="_blank" rel="noreferrer" className="underline underline-offset-4">
        {supplier.website}
      </a>
    ) : "—"],
    [t("suppliers.notes"), supplier.notes ?? "—"],
  ];
  return (
    <dl className="grid gap-x-8 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="space-y-1">
          <dt className="text-xs font-medium text-muted-foreground uppercase">{label}</dt>
          <dd className="text-sm break-words whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
