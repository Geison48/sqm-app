// Subconjunto do ICU MessageFormat usado nos arquivos de tradução (o mesmo
// formato do next-intl): {var}, {n, plural, =0 {...} one {...} other {...}}
// com "#", e {v, select, a {...} other {...}}, inclusive aninhados.
// Sem dependências, para rodar na Edge Function (Deno) e no Vitest.

export type Params = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatValue(value: unknown, locale: string): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  const text = String(value);
  // Datas ISO (AAAA-MM-DD) saem no formato curto do idioma de quem lê.
  if (DATE_RE.test(text)) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${text}T00:00:00Z`));
  }
  return text;
}

// Lê um bloco {...} a partir de "start" (que aponta para "{") e devolve o índice do "}" correspondente.
function matchBrace(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return i;
  }
  throw new Error(`ICU: chave sem fechamento em "${src}"`);
}

function parseOptions(body: string): Map<string, string> {
  const options = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i]!)) i++;
    if (i >= body.length) break;
    const keyStart = i;
    while (i < body.length && body[i] !== "{" && !/\s/.test(body[i]!)) i++;
    const key = body.slice(keyStart, i);
    while (i < body.length && /\s/.test(body[i]!)) i++;
    if (body[i] !== "{") throw new Error(`ICU: opção "${key}" sem bloco`);
    const end = matchBrace(body, i);
    options.set(key, body.slice(i + 1, end));
    i = end + 1;
  }
  return options;
}

function pluralKey(n: number, options: Map<string, string>, locale: string): string {
  if (options.has(`=${n}`)) return `=${n}`;
  const category = new Intl.PluralRules(locale).select(n);
  return options.has(category) ? category : "other";
}

export function formatMessage(template: string, params: Params, locale: string, hash?: string): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const ch = template[i]!;
    if (ch === "#" && hash !== undefined) {
      out += hash;
      i++;
      continue;
    }
    if (ch !== "{") {
      out += ch;
      i++;
      continue;
    }
    const end = matchBrace(template, i);
    const inner = template.slice(i + 1, end);
    const firstComma = inner.indexOf(",");
    if (firstComma < 0) {
      out += formatValue(params[inner.trim()], locale);
    } else {
      const name = inner.slice(0, firstComma).trim();
      const rest = inner.slice(firstComma + 1);
      const secondComma = rest.indexOf(",");
      const type = rest.slice(0, secondComma).trim();
      const options = parseOptions(rest.slice(secondComma + 1));
      const value = params[name];
      if (type === "plural") {
        const n = Number(value ?? 0);
        const chosen = options.get(pluralKey(n, options, locale)) ?? "";
        out += formatMessage(chosen, params, locale, new Intl.NumberFormat(locale).format(n));
      } else if (type === "select") {
        const chosen = options.get(String(value)) ?? options.get("other") ?? "";
        out += formatMessage(chosen, params, locale, hash);
      } else {
        out += formatValue(value, locale);
      }
    }
    i = end + 1;
  }
  return out;
}
