"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { RecordDialog } from "@/components/shared/record-dialog";
import { saveStandard } from "@/lib/actions/catalog";
import type { Database } from "@/lib/database.types";

type Standard = Database["public"]["Tables"]["standards"]["Row"];
const APPLICATIONS = ["product", "process", "system"] as const;

export function StandardFormDialog({ trigger, values }: { trigger: ReactNode; values?: Standard }) {
  const t = useTranslations("standards");
  return (
    <RecordDialog
      trigger={trigger}
      title={values ? t("editData") : t("new")}
      hidden={values ? { id: values.id } : undefined}
      action={saveStandard}
      fields={[
        { name: "code", label: t("code"), required: true, span: 1, defaultValue: values?.code, placeholder: "ISO 9001" },
        { name: "revision", label: t("revision"), span: 1, defaultValue: values?.revision, placeholder: "2015" },
        { name: "title_pt", label: t("titlePt"), required: true, defaultValue: values?.title_pt },
        { name: "title_en", label: t("titleEn"), required: true, defaultValue: values?.title_en },
        { name: "application", label: t("application"), type: "select", required: true, span: 1,
          options: APPLICATIONS.map((a) => ({ value: a, label: t(`applications.${a}`) })),
          defaultValue: values?.application ?? "system" },
        { name: "issuer", label: t("issuer"), span: 1, defaultValue: values?.issuer },
        { name: "notes", label: t("notes"), type: "textarea", defaultValue: values?.notes },
      ]}
    />
  );
}
