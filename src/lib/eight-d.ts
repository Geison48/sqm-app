// Estrutura dos formulários de cada disciplina do 8D. Usada pela tela (render
// genérico), pela validação do envio e pelo PDF. Os rótulos vêm de
// messages: eightD.fields.<key>.

export const DISCIPLINES = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export type ScalarField = {
  key: string;
  type: "text" | "textarea" | "date" | "checkbox" | "select";
  required?: boolean;
  options?: readonly string[]; // chaves em eightD.<optionsNamespace>
  optionsNamespace?: string;
};
export type ListField = { key: string; type: "list"; required?: boolean; columns: ScalarField[] };
export type FieldSpec = ScalarField | ListField;

const ADDRESSES = ["occurrence", "non_detection", "systemic"] as const;

export const DISCIPLINE_FIELDS: Record<Discipline, FieldSpec[]> = {
  D0: [
    { key: "emergency_actions", type: "textarea", required: true },
    { key: "notes", type: "textarea" },
  ],
  D1: [
    { key: "leader", type: "text", required: true },
    { key: "members", type: "list", required: true, columns: [
      { key: "name", type: "text", required: true },
      { key: "function", type: "text" },
      { key: "company", type: "text" },
    ] },
  ],
  D2: [
    { key: "problem_statement", type: "textarea" },
    { key: "what", type: "textarea", required: true },
    { key: "where", type: "text" },
    { key: "when", type: "text" },
    { key: "who", type: "text" },
    { key: "how_many", type: "text" },
    { key: "how_detected", type: "text" },
  ],
  D3: [
    { key: "summary", type: "textarea", required: true },
    { key: "all_stock_covered", type: "checkbox" },
  ],
  D4: [
    { key: "occurrence_root_cause", type: "textarea", required: true },
    { key: "non_detection_root_cause", type: "textarea", required: true },
    { key: "systemic_root_cause", type: "textarea" },
  ],
  D5: [
    { key: "actions", type: "list", required: true, columns: [
      { key: "action", type: "text", required: true },
      { key: "addresses", type: "select", options: ADDRESSES, optionsNamespace: "addresses" },
      { key: "responsible", type: "text" },
      { key: "due_date", type: "date" },
    ] },
    { key: "verification", type: "textarea" },
  ],
  D6: [
    { key: "implementations", type: "list", required: true, columns: [
      { key: "action", type: "text", required: true },
      { key: "implemented_on", type: "date" },
      { key: "evidence", type: "text" },
    ] },
    { key: "validation_result", type: "textarea", required: true },
  ],
  D7: [
    { key: "pfmea_revision", type: "text" },
    { key: "control_plan_revision", type: "text" },
    { key: "no_change_justification", type: "textarea" },
    { key: "other_documents", type: "textarea" },
    { key: "horizontal_deployment", type: "textarea" },
  ],
  D8: [
    { key: "conclusion", type: "textarea", required: true },
    { key: "recognition", type: "textarea" },
  ],
};

export type StepContent = Record<string, unknown>;

const filled = (v: unknown) => (typeof v === "string" ? v.trim() !== "" : v != null && v !== false);

// Campos obrigatórios faltando para o envio (as regras de fluxo ficam no banco).
export function missingFields(discipline: Discipline, content: StepContent): { scalar: string[]; lists: string[] } {
  const scalar: string[] = [];
  const lists: string[] = [];
  for (const f of DISCIPLINE_FIELDS[discipline]) {
    if (!f.required) continue;
    if (f.type === "list") {
      const rows = Array.isArray(content[f.key]) ? (content[f.key] as StepContent[]) : [];
      const valid = rows.filter((r) => f.columns.every((c) => !c.required || filled(r[c.key])));
      if (valid.length === 0) lists.push(f.key);
    } else if (!filled(content[f.key])) {
      scalar.push(f.key);
    }
  }
  return { scalar, lists };
}

// Mesma regra 7 que o banco aplica no envio da D7 e no fechamento.
export function d7Complete(content: StepContent) {
  const s = (k: string) => (typeof content[k] === "string" ? (content[k] as string).trim() : "");
  return (s("pfmea_revision") !== "" && s("control_plan_revision") !== "") || s("no_change_justification").length >= 10;
}

export type DeadlineState = "on_time" | "due_soon" | "overdue" | "with_sqe" | "done";

export function deadlineState(
  dueAt: string | null,
  startAt: string,
  opts: { ratio: number; withSqe?: boolean; done?: boolean; now?: Date },
): DeadlineState | null {
  if (opts.done) return "done";
  if (opts.withSqe) return "with_sqe";
  if (!dueAt) return null;
  const now = (opts.now ?? new Date()).getTime();
  const due = new Date(dueAt).getTime();
  if (now > due) return "overdue";
  const total = due - new Date(startAt).getTime();
  return total > 0 && (due - now) / total <= opts.ratio ? "due_soon" : "on_time";
}

export const DEADLINE_TONE: Record<DeadlineState, string> = {
  on_time: "success",
  due_soon: "warning",
  overdue: "danger",
  with_sqe: "info",
  done: "neutral",
};

export const STEP_TONE: Record<string, string> = {
  not_started: "neutral",
  draft: "neutral",
  submitted: "info",
  approved: "success",
  rejected: "danger",
};
