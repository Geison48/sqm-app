// Prepara os parâmetros de uma notificação para o next-intl, do mesmo jeito que
// a Edge Function faz nos e-mails (supabase/functions/_shared/icu.ts):
// datas ISO (AAAA-MM-DD) saem formatadas; números só ficam números nos
// argumentos de plural; o resto vira texto (ano 2026 não vira "2.026").
const PLURAL_KEYS = new Set(["days", "count", "daysLate", "level"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function notificationValues(params: Record<string, unknown>, formatDate: (d: Date) => string) {
  const values: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (PLURAL_KEYS.has(k)) values[k] = Number(v ?? 0);
    else if (typeof v === "string" && DATE_RE.test(v)) values[k] = formatDate(new Date(`${v}T12:00:00`));
    else values[k] = typeof v === "object" ? "" : String(v ?? "");
  }
  for (const k of PLURAL_KEYS) values[k] ??= 0;
  return values;
}
