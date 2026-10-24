import { getLocale, getTranslations } from "next-intl/server";
import { ToneBadge } from "@/components/shared/badges";
import { DEADLINE_TONE, type DeadlineState } from "@/lib/eight-d";
import { getLookup, lookupLabel } from "@/lib/lookups";

export async function SeverityBadge({ code }: { code: string }) {
  const locale = await getLocale();
  const item = (await getLookup("nc_severities", true)).find((s) => s.code === code);
  return <ToneBadge tone={item?.tone ?? "neutral"}>{lookupLabel(item, locale)}</ToneBadge>;
}

const STATUS_TONE: Record<string, string> = { open: "info", awaiting_sqe: "warning", effectiveness_check: "warning", closed: "success" };

export async function NcStatusBadge({ status, cancelled }: { status: string; cancelled?: boolean }) {
  const t = await getTranslations("ncs.statuses");
  if (cancelled) return <ToneBadge tone="neutral">{t("cancelled")}</ToneBadge>;
  return <ToneBadge tone={STATUS_TONE[status] ?? "neutral"}>{t(status as "open")}</ToneBadge>;
}

export async function DeadlineBadge({ state, dueAt }: { state: DeadlineState | null; dueAt?: string | null }) {
  if (!state) return <span className="text-muted-foreground">—</span>;
  const t = await getTranslations("ncs.deadline");
  const locale = await getLocale();
  return (
    <span className="inline-flex flex-col gap-0.5">
      <ToneBadge tone={DEADLINE_TONE[state]}>{t(state)}</ToneBadge>
      {dueAt && state !== "done" && (
        <span className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(dueAt))}
        </span>
      )}
    </span>
  );
}
