"use client";

import { useTranslations } from "next-intl";
import { ArrowRightLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordDialog } from "@/components/shared/record-dialog";
import { changeSupplierStatus } from "@/lib/actions/suppliers";

export function ChangeStatusDialog({
  supplierId,
  currentStatus,
  statuses,
  qualificationApproved,
}: {
  supplierId: string;
  currentStatus: string;
  statuses: { value: string; label: string }[];
  qualificationApproved: boolean;
}) {
  const t = useTranslations("suppliers");
  const current = statuses.find((s) => s.value === currentStatus)?.label ?? currentStatus;

  return (
    <RecordDialog
      trigger={
        <Button>
          <ArrowRightLeftIcon />
          {t("changeStatus")}
        </Button>
      }
      title={t("changeStatus")}
      description={t("changeStatusDescription")}
      hidden={{ supplier_id: supplierId }}
      action={changeSupplierStatus}
      fields={[
        {
          name: "status_code", label: t("newStatus"), type: "select", required: true,
          options: statuses.filter((s) => s.value !== currentStatus),
          hint: `${t("currentStatus")}: ${current}`,
        },
        { name: "justification", label: t("justification"), type: "textarea", required: true },
      ]}
    >
      <ul className="space-y-1 text-sm text-muted-foreground">
        <li>• {t("controlledShipmentNote")}</li>
        {!qualificationApproved && <li className="text-amber-700 dark:text-amber-400">• {t("approveWithoutQualification")}</li>}
      </ul>
    </RecordDialog>
  );
}
