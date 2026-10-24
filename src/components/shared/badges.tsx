import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  neutral: "bg-muted text-foreground border-transparent",
  success: "bg-emerald-100 text-emerald-900 border-transparent dark:bg-emerald-950 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-900 border-transparent dark:bg-amber-950 dark:text-amber-200",
  danger: "bg-red-100 text-red-900 border-transparent dark:bg-red-950 dark:text-red-200",
  info: "bg-sky-100 text-sky-900 border-transparent dark:bg-sky-950 dark:text-sky-200",
};

export function ToneBadge({ tone, children, className }: { tone: string; children: React.ReactNode; className?: string }) {
  return <Badge className={cn(TONES[tone] ?? TONES.neutral, className)}>{children}</Badge>;
}

const CRITICALITY_TONE: Record<string, string> = { A: "danger", B: "warning", C: "neutral" };

export function CriticalityBadge({ value }: { value: string }) {
  return (
    <ToneBadge tone={CRITICALITY_TONE[value] ?? "neutral"} className="w-6 justify-center font-semibold">
      {value}
    </ToneBadge>
  );
}
