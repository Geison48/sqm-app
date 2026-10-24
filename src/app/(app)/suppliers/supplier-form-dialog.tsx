"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { saveSupplier } from "@/lib/actions/suppliers";
import { countryOptions } from "@/lib/format";

type Option = { value: string; label: string };
export type SupplierFormValues = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  country_code: string;
  tax_id: string | null;
  criticality: string;
  website: string | null;
  notes: string | null;
  responsible_sqe_id: string | null;
};

export function SupplierFormDialog({
  mode,
  trigger,
  isSqm,
  currentUserId,
  statuses,
  internalUsers,
  values,
}: {
  mode: "create" | "edit";
  trigger: ReactNode;
  isSqm: boolean;
  currentUserId: string;
  statuses: Option[];
  internalUsers: Option[];
  values?: SupplierFormValues;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const fields: FieldDef[] = [
    { name: "legal_name", label: t("suppliers.legalName"), required: true, defaultValue: values?.legal_name },
    { name: "trade_name", label: t("suppliers.tradeName"), defaultValue: values?.trade_name },
    {
      name: "country_code", label: t("suppliers.country"), type: "select", required: true, span: 1,
      options: countryOptions(locale), defaultValue: values?.country_code ?? "BR",
    },
    {
      name: "tax_id", label: t("suppliers.taxId"), span: 1, defaultValue: values?.tax_id,
      hint: t("errors.cnpj_required"),
    },
    {
      name: "criticality", label: t("criticality.label"), type: "select", required: true, span: 1,
      options: ["A", "B", "C"].map((c) => ({ value: c, label: t(`criticality.${c as "A"}`) })),
      defaultValue: values?.criticality ?? "B",
    },
  ];
  if (mode === "create") {
    fields.push({
      name: "status_code", label: t("suppliers.initialStatus"), type: "select", required: true, span: 1,
      options: statuses, defaultValue: "in_qualification",
    });
  }
  if (isSqm) {
    fields.push({
      name: "responsible_sqe_id", label: t("suppliers.responsibleSqe"), type: "select", required: true,
      options: internalUsers, defaultValue: values?.responsible_sqe_id ?? currentUserId,
    });
  }
  fields.push(
    { name: "website", label: t("suppliers.website"), type: "url", defaultValue: values?.website },
    { name: "notes", label: t("suppliers.notes"), type: "textarea", defaultValue: values?.notes },
  );

  return (
    <RecordDialog
      trigger={trigger}
      title={mode === "create" ? t("suppliers.new") : t("suppliers.editData")}
      description={mode === "create" ? t("suppliers.newDescription") : undefined}
      fields={fields}
      hidden={values ? { id: values.id } : undefined}
      action={saveSupplier}
    />
  );
}
