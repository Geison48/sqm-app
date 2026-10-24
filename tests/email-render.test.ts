import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import { formatMessage } from "../supabase/functions/_shared/icu";
import { renderEmail, type Messages } from "../supabase/functions/_shared/render";
import { functionMessages } from "../scripts/sync-function-messages.mjs";

const fnMessages = JSON.parse(readFileSync("supabase/functions/_shared/messages.json", "utf8")) as Record<string, Messages>;
const KINDS = ["eight_d_step", "simple_nc", "finding", "nc_cost", "x"];

describe("e-mails (Edge Function)", () => {
  it("as traduções da função estão sincronizadas com messages/ (rode npm run sync:messages)", () => {
    expect(fnMessages).toEqual(functionMessages());
  });

  it("o formatador da função monta o mesmo texto que o next-intl, em PT e EN", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      for (const [code, template] of Object.entries(fnMessages[locale]!.notifications.events)) {
        for (const kind of KINDS) {
          for (const n of [0, 1, 5]) {
            const params = {
              kind, ref: "NC-2026-0003", detail: "D3", supplier: "Fornecedor A", due: "23/10/2026", date: "15/02/2026",
              validUntil: "18/11/2026", number: "AUD-1", title: "Trinca", description: "Custo", discipline: "D2",
              certificate: "ISO 9001", classification: "B", year: "2026", count: n, days: n, daysLate: n,
            };
            const expected = new IntlMessageFormat(template, locale).format(params);
            expect(formatMessage(template, params, locale), `${locale} ${code} ${kind} ${n}`).toBe(expected);
          }
        }
      }
    }
  });

  it("escalonamento para contato sem login: idioma, link e aviso de contato", () => {
    const mail = renderEmail({
      recipient_name: "Diana Diretora", recipient_user_id: null, locale: "pt-BR", event_code: "deadline_overdue",
      params: { kind: "eight_d_step", ref: "NC-2026-0003", detail: "D3", supplier: "Fornecedor <A>", due: "2026-10-23", daysLate: 7, asContact: true },
      link_path: "/ncs/1",
    }, fnMessages["pt-BR"]!, "https://sqm.example.com");
    expect(mail.subject).toBe("SQM App · Atrasado há 7 dias: D3 da NC NC-2026-0003 — Fornecedor <A> (prazo 23/10/2026).");
    expect(mail.html).toContain("Fornecedor &lt;A&gt;");
    expect(mail.html).toContain('href="https://sqm.example.com/ncs/1"');
    expect(mail.text).toContain("como contato de Fornecedor <A>");
  });

  it("resumo diário em inglês, agrupado", () => {
    const mail = renderEmail({
      recipient_name: "Sam SQE", recipient_user_id: "u1", locale: "en", event_code: "daily_digest", link_path: "/",
      params: { date: "2026-10-24", count: 2, items: [
        { grp: "review", kind: "eight_d_review", ref: "NC-1", detail: "D3", supplier: "B", due: "2026-10-22", link: "/ncs/1" },
        { grp: "overdue", kind: "simple_nc", ref: "NC-2", detail: "Porosity", supplier: "B", due: "2026-10-20", link: "/ncs/2" },
      ] },
    }, fnMessages.en!, "https://sqm.example.com");
    expect(mail.subject).toBe("SQM App · Daily digest: 2 pending items");
    expect(mail.html).toContain("Waiting for your review");
    expect(mail.text).toContain("- D submitted for review: NC-1 · D3 (B · since 10/22/26)");
    expect(mail.text).toContain("Overdue");
  });
});
