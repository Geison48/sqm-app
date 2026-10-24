import { describe, expect, it } from "vitest";
import ptBR from "../messages/pt-BR.json";
import en from "../messages/en.json";

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") Object.assign(acc, flatten(value as Record<string, unknown>, path));
    else acc[path] = String(value);
    return acc;
  }, {});
}

describe("traduções", () => {
  const pt = flatten(ptBR);
  const eng = flatten(en);

  it("pt-BR e en têm exatamente as mesmas chaves", () => {
    expect(Object.keys(eng).sort()).toEqual(Object.keys(pt).sort());
  });

  it("nenhum texto está vazio", () => {
    for (const [key, value] of [...Object.entries(pt), ...Object.entries(eng)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("placeholders ({nome}) são os mesmos nos dois idiomas", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(pt)) expect(vars(eng[key] ?? ""), key).toEqual(vars(pt[key]!));
  });
});
