import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

// Primeiro acesso sem cookie: usa o idioma do navegador (en* → en, resto → pt-BR).
function fromAcceptLanguage(header: string | null): Locale {
  const first = header?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : defaultLocale;
}

// Sem prefixo de idioma na URL: o idioma vem do cookie, gravado a partir do
// perfil do usuário no login, no link do convite e na troca de idioma.
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : fromAcceptLanguage((await headers()).get("accept-language"));

  return {
    locale,
    timeZone: "America/Sao_Paulo",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
