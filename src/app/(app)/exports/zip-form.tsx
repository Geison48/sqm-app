"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Option = { value: string; label: string };
const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm";

// Escolha em cascata: fornecedor → componente (opcional) → SN (opcional).
export function ZipForm({ suppliers, components, units, defaultLang }: {
  suppliers: Option[];
  components: (Option & { supplierId: string })[];
  units: (Option & { supplierId: string; componentId: string })[];
  defaultLang: string;
}) {
  const t = useTranslations("exports");
  const [supplier, setSupplier] = useState(suppliers[0]?.value ?? "");
  const [component, setComponent] = useState("");
  const [unit, setUnit] = useState("");
  const [lang, setLang] = useState(defaultLang);
  const [preparing, setPreparing] = useState(false);
  const tl = useTranslations("languages");

  const params = new URLSearchParams({ supplier, lang });
  if (component) params.set("component", component);
  if (unit) params.set("unit", unit);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="x-supplier">{t("supplier")}</Label>
        <select id="x-supplier" className={selectClass} value={supplier}
          onChange={(e) => { setSupplier(e.target.value); setComponent(""); setUnit(""); }}>
          {suppliers.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="x-component">{t("component")}</Label>
        <select id="x-component" className={selectClass} value={component} onChange={(e) => { setComponent(e.target.value); setUnit(""); }}>
          <option value="">{t("allComponents")}</option>
          {components.filter((c) => c.supplierId === supplier).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="x-unit">{t("unit")}</Label>
        <select id="x-unit" className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!component}>
          <option value="">{t("allUnits")}</option>
          {units.filter((u) => u.supplierId === supplier && u.componentId === component).map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="x-lang">{t("language")}</Label>
        <select id="x-lang" className={selectClass} value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="pt-BR">{tl("pt-BR")}</option>
          <option value="en">{tl("en")}</option>
        </select>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Button asChild disabled={!supplier} onClick={() => { setPreparing(true); setTimeout(() => setPreparing(false), 8000); }}>
          <a href={`/exports/zip?${params.toString()}`}><DownloadIcon />{t("download")}</a>
        </Button>
        {preparing && <span className="text-xs text-muted-foreground">{t("preparing")}</span>}
      </div>
    </div>
  );
}
