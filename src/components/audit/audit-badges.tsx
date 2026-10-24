import { getTranslations } from "next-intl/server";
import { ToneBadge } from "@/components/shared/badges";

const STATUS_TONE: Record<string, string> = {
  planned: "neutral", scheduled: "info", in_progress: "warning", completed: "warning", closed: "success",
};
const CLASS_TONE: Record<string, string> = { A: "success", B: "warning", C: "danger" };

export async function AuditStatusBadge({ status, cancelled }: { status: string; cancelled?: boolean }) {
  const t = await getTranslations("audits.statuses");
  if (cancelled) return <ToneBadge tone="neutral">{t("cancelled")}</ToneBadge>;
  return <ToneBadge tone={STATUS_TONE[status] ?? "neutral"}>{t(status as "planned")}</ToneBadge>;
}

export function ClassificationBadge({ value, percent }: { value: string | null; percent?: number | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <ToneBadge tone={CLASS_TONE[value] ?? "neutral"} className="font-semibold">
      {value}{percent != null && ` · ${percent}%`}
    </ToneBadge>
  );
}
