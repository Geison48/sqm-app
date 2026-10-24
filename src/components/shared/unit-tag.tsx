import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

const STYLE: Record<string, string> = {
  green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500", none: "bg-transparent border border-muted-foreground",
};

// Etiqueta da peça (verde/amarela/vermelha/pendente), com cor e texto.
export async function UnitTag({ tag, scrapped, long }: { tag: string | null; scrapped?: boolean; long?: boolean }) {
  const t = await getTranslations("units");
  const key = (tag ?? "none") as "green";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("size-3 shrink-0 rounded-full", STYLE[key])} aria-hidden />
      {scrapped ? t("tags.scrapped") : long ? t(`tags.${key}`) : t(`tagShort.${key}`)}
    </span>
  );
}
