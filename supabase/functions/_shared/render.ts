// Monta o e-mail (assunto, HTML e texto) no idioma do destinatário, a partir
// das mesmas traduções da interface (messages/*.json → _shared/messages.json).
import { formatMessage, type Params } from "./icu.ts";

export type Messages = {
  notifications: { events: Record<string, string> };
  pending: { groups: Record<string, string>; kinds: Record<string, string> };
  emails: Record<string, string>;
};

export type OutboxRow = {
  recipient_name: string | null;
  recipient_user_id: string | null;
  locale: string;
  event_code: string;
  params: Params;
  link_path: string | null;
};

type DigestItem = { grp: string; kind: string; ref: string; detail: string; supplier: string; due: string | null; link: string };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmail(row: OutboxRow, m: Messages, siteUrl: string) {
  const locale = row.locale === "en" ? "en" : "pt-BR";
  const t = (template: string | undefined, params: Params = {}) => formatMessage(template ?? "", params, locale);
  const link = row.link_path ? new URL(row.link_path, siteUrl).toString() : siteUrl;
  const greeting = t(m.emails.greeting, { name: row.recipient_name?.split(" ")[0] ?? "" });
  const footer = row.recipient_user_id
    ? t(m.emails.footerUser)
    : t(m.emails.footerContact, { supplier: String(row.params.supplier ?? "") });

  let subject: string;
  let bodyHtml: string;
  let bodyText: string;

  if (row.event_code === "daily_digest") {
    const items = (row.params.items ?? []) as DigestItem[];
    subject = t(m.emails.digestSubject, { count: items.length, date: String(row.params.date ?? "") });
    const groups = [...new Set(items.map((i) => i.grp))];
    const line = (i: DigestItem) => {
      const when = i.due ? t(i.grp === "review" ? m.emails.since : m.emails.due, { date: i.due }) : "";
      return { kind: m.pending.kinds[i.kind] ?? i.kind, main: [i.ref, i.detail].filter(Boolean).join(" · "), supplier: i.supplier, when };
    };
    bodyHtml = `<p>${escapeHtml(t(m.emails.digestIntro, { date: String(row.params.date ?? "") }))}</p>` + groups.map((g) => {
      const rows = items.filter((i) => i.grp === g).map((i) => {
        const l = line(i);
        const href = new URL(i.link, siteUrl).toString();
        return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#555;white-space:nowrap">${escapeHtml(l.kind)}</td>`
          + `<td style="padding:6px 8px;border-bottom:1px solid #eee"><a href="${escapeHtml(href)}" style="color:#111">${escapeHtml(l.main)}</a>`
          + `<br><span style="color:#777;font-size:12px">${escapeHtml(l.supplier)}${l.when ? ` · ${escapeHtml(l.when)}` : ""}</span></td></tr>`;
      }).join("");
      return `<h3 style="font-size:15px;margin:20px 0 6px">${escapeHtml(m.pending.groups[g] ?? g)}</h3>`
        + `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>`;
    }).join("");
    bodyText = t(m.emails.digestIntro, { date: String(row.params.date ?? "") }) + "\n" + groups.map((g) =>
      `\n${m.pending.groups[g] ?? g}\n` + items.filter((i) => i.grp === g).map((i) => {
        const l = line(i);
        return `- ${l.kind}: ${l.main} (${l.supplier}${l.when ? ` · ${l.when}` : ""}) ${new URL(i.link, siteUrl)}`;
      }).join("\n")).join("\n");
  } else {
    const text = t(m.notifications.events[row.event_code], row.params);
    subject = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    const extra = row.params.asContact ? `<p>${escapeHtml(t(m.emails.escalationContact))}</p>` : "";
    bodyHtml = `<p style="font-size:15px">${escapeHtml(text)}</p>${extra}`;
    bodyText = text + (row.params.asContact ? `\n\n${t(m.emails.escalationContact)}` : "");
  }

  const button = `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px">${escapeHtml(t(m.emails.open))}</a></p>`;
  const html = `<!doctype html><html lang="${locale}"><body style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px">`
    + `<p style="font-size:13px;color:#777;margin:0 0 16px">${escapeHtml(t(m.emails.brand))}</p>`
    + `<p>${escapeHtml(greeting)}</p>${bodyHtml}${button}`
    + `<hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="font-size:12px;color:#777">${escapeHtml(footer)}</p>`
    + `</body></html>`;
  const text = `${greeting}\n\n${bodyText}\n\n${t(m.emails.open)}: ${link}\n\n--\n${footer}`;
  return { subject: `${t(m.emails.brand)} · ${subject}`, html, text, locale };
}

