// Valor "todos" dos filtros de lista (compartilhado entre servidor e cliente).
export const ALL = "__all__";
export const isAll = (v: string | string[] | undefined) => !v || v === ALL || Array.isArray(v);
export const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
