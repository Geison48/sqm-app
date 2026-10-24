import { createTranslator } from "next-intl";
import ptBR from "../../../messages/pt-BR.json";
import en from "../../../messages/en.json";

export type PdfLanguage = "pt-BR" | "en" | "both";

type Lookup = { label_pt: string; label_en: string } | undefined | null;

// Rótulos do PDF: um idioma ou "PT / EN" (bilíngue). Os textos digitados
// pelos usuários saem como foram escritos.
export function pdfTranslator(lang: PdfLanguage) {
  const tPt = createTranslator({ locale: "pt-BR", messages: ptBR });
  const tEn = createTranslator({ locale: "en", messages: en });
  const t = (key: string, values?: Record<string, string | number>) => {
    const pt = tPt(key as never, values as never) as string;
    const english = tEn(key as never, values as never) as string;
    if (lang === "pt-BR") return pt;
    if (lang === "en") return english;
    return pt === english ? pt : `${pt} / ${english}`;
  };
  const lookup = (item: Lookup) => {
    if (!item) return "—";
    if (lang === "pt-BR") return item.label_pt;
    if (lang === "en") return item.label_en;
    return item.label_pt === item.label_en ? item.label_pt : `${item.label_pt} / ${item.label_en}`;
  };
  const locale = lang === "en" ? "en" : "pt-BR";
  const date = (v: string | null | undefined, withTime = false) =>
    v
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "short",
          ...(withTime ? { timeStyle: "short" } : {}),
          timeZone: "America/Sao_Paulo",
        }).format(new Date(v.length === 10 ? `${v}T12:00:00` : v))
      : "—";
  const money = (v: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
  return { t, lookup, date, money, locale };
}
