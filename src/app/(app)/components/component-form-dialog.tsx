"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { RecordDialog } from "@/components/shared/record-dialog";
import { saveComponent } from "@/lib/actions/catalog";
import type { Database } from "@/lib/database.types";

type Component = Database["public"]["Tables"]["components"]["Row"];

export function ComponentFormDialog({ trigger, values }: { trigger: ReactNode; values?: Component }) {
  const t = useTranslations();
  return (
    <RecordDialog
      trigger={trigger}
      title={values ? t("components.editData") : t("components.new")}
      hidden={values ? { id: values.id } : undefined}
      action={saveComponent}
      fields={[
        { name: "gw_code", label: t("components.gwCode"), required: true, span: 1, defaultValue: values?.gw_code },
        { name: "drawing_revision", label: t("components.drawingRevision"), span: 1, defaultValue: values?.drawing_revision },
        { name: "description", label: t("components.description"), required: true, defaultValue: values?.description },
        { name: "criticality", label: t("criticality.label"), type: "select", required: true, span: 1,
          options: ["A", "B", "C"].map((c) => ({ value: c, label: t(`criticality.${c as "A"}`) })),
          defaultValue: values?.criticality ?? "B" },
        { name: "control_plan_ref", label: t("components.controlPlan"), span: 1, defaultValue: values?.control_plan_ref },
        { name: "notes", label: t("components.notes"), type: "textarea", defaultValue: values?.notes },
      ]}
    />
  );
}
