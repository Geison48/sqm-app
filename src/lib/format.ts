// Utilitários de formatação/validação usados no cliente e no servidor.
// A validação definitiva fica no banco (public.is_valid_cnpj).

export function normalizeCnpj(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

// CNPJ numérico ou alfanumérico (Receita Federal, a partir de 07/2026).
export function isValidCnpj(value: string) {
  const v = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(v) || /^(.)\1{13}$/.test(v)) return false;
  const val = (c: string) => c.charCodeAt(0) - 48;
  const dv = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + val(v[i]!) * w, 0);
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return dv(12) === val(v[12]!) && dv(13) === val(v[13]!);
}

export function formatTaxId(country: string, taxId: string | null) {
  if (!taxId) return "—";
  if (country !== "BR" || taxId.length !== 14) return taxId;
  return `${taxId.slice(0, 2)}.${taxId.slice(2, 5)}.${taxId.slice(5, 8)}/${taxId.slice(8, 12)}-${taxId.slice(12)}`;
}

// Códigos ISO 3166-1 alfa-2; os nomes vêm do Intl no idioma do usuário.
export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO " +
  "JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR " +
  "MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO " +
  "RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV " +
  "TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

export function countryName(code: string | null | undefined, locale: string) {
  if (!code) return "—";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryOptions(locale: string) {
  return COUNTRY_CODES.map((code) => ({ value: code, label: countryName(code, locale) })).sort((a, b) =>
    a.label.localeCompare(b.label, locale),
  );
}

export function daysUntil(date: string) {
  const today = new Date();
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = date.split("-").map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - utcToday) / 86_400_000);
}

export function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
