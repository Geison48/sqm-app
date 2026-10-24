import type { InspectionItemData, InspectionValues } from "./db";

// Prévia local da avaliação automática (mesma regra do gatilho
// app.tg_results_before no banco). O servidor confirma ao sincronizar.
export function parseMeasured(text: string): number[] | null {
  const parts = text.split(/[\s;]+/).map((v) => v.replace(",", ".")).filter(Boolean);
  const numbers = parts.map(Number);
  return numbers.some((n) => !Number.isFinite(n)) ? null : numbers;
}

export function evaluateLocally(c: InspectionItemData, v: InspectionValues): Pick<InspectionValues, "ok" | "auto" | "qty_nok"> {
  if (v.waiver) return { ok: true, auto: v.auto, qty_nok: v.qty_nok };
  const accept = c.sampling === "aql" ? (c.accept ?? 0) : 0;
  const values = parseMeasured(v.measured ?? "") ?? [];
  if (values.length && (c.lower != null || c.upper != null)) {
    const out = values.filter((x) => (c.lower != null && x < c.lower) || (c.upper != null && x > c.upper)).length;
    const qtyNok = Math.max(v.qty_nok ?? 0, out);
    return { ok: qtyNok <= accept, auto: true, qty_nok: qtyNok };
  }
  if (v.qty_nok != null && v.qty_inspected != null) {
    return { ok: v.qty_nok <= accept, auto: true, qty_nok: v.qty_nok };
  }
  return { ok: v.ok, auto: false, qty_nok: v.qty_nok };
}
