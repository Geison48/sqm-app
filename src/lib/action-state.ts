// Resultado padrão das server actions de formulário: chaves de tradução, nunca texto.
export type ActionState = { error?: string; success?: string; id?: string } | undefined;

// Valor usado nos selects opcionais para "nenhum" (Radix não aceita value="").
export const NONE = "__none__";

// Lê campos de FormData tratando "" como null.
export function formValues(formData: FormData) {
  const out: Record<string, string | null> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const v = value.trim();
    out[key] = v === "" || v === NONE ? null : v;
  }
  return out;
}

export const checkbox = (formData: FormData, name: string) => formData.get(name) === "on";
