// Copia para a Edge Function as traduções usadas nos e-mails (a função não
// enxerga a pasta messages/). Rode depois de mudar messages/*.json:
//   npm run sync:messages   (o teste de traduções acusa se esquecer)
import { readFileSync, writeFileSync } from "node:fs";

export function functionMessages() {
  const out = {};
  for (const locale of ["pt-BR", "en"]) {
    const m = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    out[locale] = { notifications: { events: m.notifications.events }, pending: { groups: m.pending.groups, kinds: m.pending.kinds }, emails: m.emails };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL("../supabase/functions/_shared/messages.json", import.meta.url), JSON.stringify(functionMessages(), null, 2) + "\n");
  console.log("supabase/functions/_shared/messages.json atualizado");
}
