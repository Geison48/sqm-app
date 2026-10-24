"use client";

import { useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL } from "@/lib/filters";

export type FilterDef = { name: string; label: string; value?: string; options: { value: string; label: string }[] };


// Filtros de lista via query string (GET): links compartilháveis e sem estado no cliente.
export function ListFilters({
  basePath,
  q,
  placeholder,
  filters = [],
  checkbox,
}: {
  basePath: string;
  q?: string;
  placeholder: string;
  filters?: FilterDef[];
  checkbox?: { name: string; label: string; checked: boolean };
}) {
  const t = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => setTimeout(() => formRef.current?.requestSubmit(), 0);

  return (
    <form ref={formRef} action={basePath} className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      <div className="relative md:w-72">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder={placeholder} className="pl-8" aria-label={t("search")} />
      </div>
      {filters.map((f) => (
        <Select key={f.name} name={f.name} defaultValue={f.value || ALL} onValueChange={submit}>
          <SelectTrigger className="w-full md:w-48" aria-label={f.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {f.label}: {t("all")}
            </SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {checkbox && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={checkbox.name}
            value="1"
            defaultChecked={checkbox.checked}
            onChange={submit}
            className="size-4 accent-primary"
          />
          {checkbox.label}
        </label>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          {t("search")}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={basePath}>{t("clearFilters")}</Link>
        </Button>
      </div>
    </form>
  );
}
