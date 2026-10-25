// SQM App — Edge Function "notifications" (arquivo único, gerado por `npm run build:deploy`).
// Cole no editor de Edge Functions do Supabase com o nome: notifications
// supabase/functions/_shared/messages.json
var messages_default = {
  "pt-BR": {
    notifications: {
      events: {
        certificate_expiring: "O certificado {certificate} de {supplier} vence em {days, plural, one {# dia} other {# dias}} ({validUntil}).",
        certificate_expired: "O certificado {certificate} de {supplier} venceu em {validUntil}.",
        certificate_updated_by_supplier: "{supplier} atualizou o certificado {certificate} (validade: {validUntil}).",
        nc_opened: "Nova NC {number} aberta para {supplier}: {title}.",
        nc_converted_8d: "A NC {number} foi convertida em 8D.",
        eight_d_submitted: "{supplier} enviou a {discipline} da NC {number}.",
        eight_d_approved: "A {discipline} da NC {number} foi aprovada.",
        eight_d_rejected: "A {discipline} da NC {number} foi reprovada. Veja o coment\xE1rio do SQE.",
        simple_nc_responded: "{supplier} respondeu a NC {number}.",
        simple_nc_returned: "A resposta da NC {number} foi devolvida pelo SQE.",
        nc_closed: "A NC {number} foi fechada.",
        nc_cost_launched: "Custo lan\xE7ado na NC {number}: {description}.",
        nc_cost_accepted: "{supplier} aceitou o custo da NC {number}: {description}.",
        nc_cost_contested: "{supplier} contestou o custo da NC {number}: {description}.",
        audit_plan_submitted: "O plano de auditorias {year} aguarda sua aprova\xE7\xE3o.",
        audit_scheduled: "Auditoria {number} agendada para {date}.",
        audit_report_available: "Relat\xF3rio da auditoria {number} dispon\xEDvel (classifica\xE7\xE3o {classification}).",
        finding_responded: "{supplier} respondeu um achado da auditoria {number}.",
        finding_action_accepted: "Plano de a\xE7\xE3o aceito na auditoria {number}.",
        finding_returned: "Plano de a\xE7\xE3o devolvido na auditoria {number}.",
        waiver_requested: "{supplier} solicitou a concess\xE3o {number}.",
        waiver_approved: "A concess\xE3o {number} foi aprovada.",
        waiver_rejected: "A concess\xE3o {number} foi reprovada.",
        inspection_rejected: "Inspe\xE7\xE3o {number}: {count} pe\xE7a(s) reprovada(s).",
        deadline_overdue: "{daysLate, plural, =0 {Vence hoje} one {Atrasado h\xE1 # dia} other {Atrasado h\xE1 # dias}}: {kind, select, eight_d_step {{detail} da NC {ref}} simple_nc {resposta da NC {ref}} finding {plano de a\xE7\xE3o da auditoria {ref}} nc_cost {resposta ao custo da NC {ref}} other {{ref}}} \u2014 {supplier} (prazo {due}).",
        deadline_soon: "{days, plural, one {Falta # dia} other {Faltam # dias}} para o prazo: {kind, select, eight_d_step {{detail} da NC {ref}} simple_nc {resposta da NC {ref}} finding {plano de a\xE7\xE3o da auditoria {ref}} nc_cost {resposta ao custo da NC {ref}} other {{ref}}} \u2014 {supplier} (prazo {due}).",
        daily_digest: "Resumo di\xE1rio de {date}: {count} pend\xEAncias."
      }
    },
    pending: {
      groups: {
        review: "Aguardando sua an\xE1lise",
        overdue: "Atrasados",
        due: "A entregar",
        week: "Agenda",
        expiring: "Vencimentos"
      },
      kinds: {
        eight_d_step: "Disciplina do 8D",
        simple_nc: "Resposta de NC simples",
        finding: "Plano de a\xE7\xE3o de achado",
        nc_cost: "Resposta a custo de NC",
        eight_d_review: "D enviada para an\xE1lise",
        simple_nc_review: "NC simples respondida",
        effectiveness_check: "Verifica\xE7\xE3o de efic\xE1cia do 8D",
        finding_review: "Plano de a\xE7\xE3o para analisar",
        finding_verify: "Achado para verificar efic\xE1cia",
        waiver_review: "Concess\xE3o para decidir",
        cost_contested: "Custo contestado",
        audit: "Auditoria",
        inspection: "Inspe\xE7\xE3o em andamento",
        certificate: "Certificado",
        waiver: "Concess\xE3o vencendo"
      }
    },
    emails: {
      brand: "SQM App",
      greeting: "Ol\xE1, {name}!",
      open: "Abrir no SQM App",
      footerUser: "Voc\xEA recebe estes e-mails porque tem acesso ao SQM App. Para parar, desligue os e-mails na tela Notifica\xE7\xF5es.",
      footerContact: "Voc\xEA recebeu este aviso como contato de {supplier} cadastrado no SQM App.",
      escalationContact: "Pedimos seu apoio para regularizar esta pend\xEAncia com o time respons\xE1vel.",
      digestSubject: "Resumo di\xE1rio: {count, plural, one {# pend\xEAncia} other {# pend\xEAncias}}",
      digestIntro: "Suas pend\xEAncias em {date}:",
      due: "prazo {date}",
      since: "desde {date}"
    }
  },
  en: {
    notifications: {
      events: {
        certificate_expiring: "Certificate {certificate} of {supplier} expires in {days, plural, one {# day} other {# days}} ({validUntil}).",
        certificate_expired: "Certificate {certificate} of {supplier} expired on {validUntil}.",
        certificate_updated_by_supplier: "{supplier} updated certificate {certificate} (valid until: {validUntil}).",
        nc_opened: "New NC {number} opened for {supplier}: {title}.",
        nc_converted_8d: "NC {number} was converted to 8D.",
        eight_d_submitted: "{supplier} submitted {discipline} of NC {number}.",
        eight_d_approved: "{discipline} of NC {number} was approved.",
        eight_d_rejected: "{discipline} of NC {number} was rejected. See the SQE comment.",
        simple_nc_responded: "{supplier} answered NC {number}.",
        simple_nc_returned: "The response to NC {number} was returned by the SQE.",
        nc_closed: "NC {number} was closed.",
        nc_cost_launched: "Cost recorded on NC {number}: {description}.",
        nc_cost_accepted: "{supplier} accepted the cost of NC {number}: {description}.",
        nc_cost_contested: "{supplier} disputed the cost of NC {number}: {description}.",
        audit_plan_submitted: "The {year} audit plan awaits your approval.",
        audit_scheduled: "Audit {number} scheduled for {date}.",
        audit_report_available: "Report of audit {number} available (classification {classification}).",
        finding_responded: "{supplier} answered a finding of audit {number}.",
        finding_action_accepted: "Action plan accepted in audit {number}.",
        finding_returned: "Action plan returned in audit {number}.",
        waiver_requested: "{supplier} requested waiver {number}.",
        waiver_approved: "Waiver {number} was approved.",
        waiver_rejected: "Waiver {number} was rejected.",
        inspection_rejected: "Inspection {number}: {count} part(s) rejected.",
        deadline_overdue: "{daysLate, plural, =0 {Due today} one {# day overdue} other {# days overdue}}: {kind, select, eight_d_step {{detail} of NC {ref}} simple_nc {answer to NC {ref}} finding {action plan for audit {ref}} nc_cost {answer to the cost on NC {ref}} other {{ref}}} \u2014 {supplier} (due {due}).",
        deadline_soon: "{days, plural, one {# day left} other {# days left}} until the deadline: {kind, select, eight_d_step {{detail} of NC {ref}} simple_nc {answer to NC {ref}} finding {action plan for audit {ref}} nc_cost {answer to the cost on NC {ref}} other {{ref}}} \u2014 {supplier} (due {due}).",
        daily_digest: "Daily digest for {date}: {count} pending items."
      }
    },
    pending: {
      groups: {
        review: "Waiting for your review",
        overdue: "Overdue",
        due: "To deliver",
        week: "Schedule",
        expiring: "Expirations"
      },
      kinds: {
        eight_d_step: "8D discipline",
        simple_nc: "Simple NC answer",
        finding: "Finding action plan",
        nc_cost: "NC cost answer",
        eight_d_review: "D submitted for review",
        simple_nc_review: "Simple NC answered",
        effectiveness_check: "8D effectiveness check",
        finding_review: "Action plan to review",
        finding_verify: "Finding to verify",
        waiver_review: "Waiver to decide",
        cost_contested: "Contested cost",
        audit: "Audit",
        inspection: "Inspection in progress",
        certificate: "Certificate",
        waiver: "Waiver expiring"
      }
    },
    emails: {
      brand: "SQM App",
      greeting: "Hello, {name}!",
      open: "Open in SQM App",
      footerUser: "You receive these e-mails because you have access to SQM App. To stop, turn e-mails off on the Notifications page.",
      footerContact: "You received this notice as a contact of {supplier} registered in SQM App.",
      escalationContact: "We kindly ask for your support to resolve this pending item with the responsible team.",
      digestSubject: "Daily digest: {count, plural, one {# pending item} other {# pending items}}",
      digestIntro: "Your pending items on {date}:",
      due: "due {date}",
      since: "since {date}"
    }
  }
};

// supabase/functions/_shared/icu.ts
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function formatValue(value, locale) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  const text = String(value);
  if (DATE_RE.test(text)) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" }).format(/* @__PURE__ */ new Date(`${text}T00:00:00Z`));
  }
  return text;
}
function matchBrace(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return i;
  }
  throw new Error(`ICU: chave sem fechamento em "${src}"`);
}
function parseOptions(body) {
  const options = /* @__PURE__ */ new Map();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length) break;
    const keyStart = i;
    while (i < body.length && body[i] !== "{" && !/\s/.test(body[i])) i++;
    const key = body.slice(keyStart, i);
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] !== "{") throw new Error(`ICU: op\xE7\xE3o "${key}" sem bloco`);
    const end = matchBrace(body, i);
    options.set(key, body.slice(i + 1, end));
    i = end + 1;
  }
  return options;
}
function pluralKey(n, options, locale) {
  if (options.has(`=${n}`)) return `=${n}`;
  const category = new Intl.PluralRules(locale).select(n);
  return options.has(category) ? category : "other";
}
function formatMessage(template, params, locale, hash) {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === "#" && hash !== void 0) {
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

// supabase/functions/_shared/render.ts
var escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function renderEmail(row, m, siteUrl) {
  const locale = row.locale === "en" ? "en" : "pt-BR";
  const t = (template, params = {}) => formatMessage(template ?? "", params, locale);
  const link = row.link_path ? new URL(row.link_path, siteUrl).toString() : siteUrl;
  const greeting = t(m.emails.greeting, { name: row.recipient_name?.split(" ")[0] ?? "" });
  const footer = row.recipient_user_id ? t(m.emails.footerUser) : t(m.emails.footerContact, { supplier: String(row.params.supplier ?? "") });
  let subject;
  let bodyHtml;
  let bodyText;
  if (row.event_code === "daily_digest") {
    const items = row.params.items ?? [];
    subject = t(m.emails.digestSubject, { count: items.length, date: String(row.params.date ?? "") });
    const groups = [...new Set(items.map((i) => i.grp))];
    const line = (i) => {
      const when = i.due ? t(i.grp === "review" ? m.emails.since : m.emails.due, { date: i.due }) : "";
      return { kind: m.pending.kinds[i.kind] ?? i.kind, main: [i.ref, i.detail].filter(Boolean).join(" \xB7 "), supplier: i.supplier, when };
    };
    bodyHtml = `<p>${escapeHtml(t(m.emails.digestIntro, { date: String(row.params.date ?? "") }))}</p>` + groups.map((g) => {
      const rows = items.filter((i) => i.grp === g).map((i) => {
        const l = line(i);
        const href = new URL(i.link, siteUrl).toString();
        return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#555;white-space:nowrap">${escapeHtml(l.kind)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee"><a href="${escapeHtml(href)}" style="color:#111">${escapeHtml(l.main)}</a><br><span style="color:#777;font-size:12px">${escapeHtml(l.supplier)}${l.when ? ` \xB7 ${escapeHtml(l.when)}` : ""}</span></td></tr>`;
      }).join("");
      return `<h3 style="font-size:15px;margin:20px 0 6px">${escapeHtml(m.pending.groups[g] ?? g)}</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>`;
    }).join("");
    bodyText = t(m.emails.digestIntro, { date: String(row.params.date ?? "") }) + "\n" + groups.map((g) => `
${m.pending.groups[g] ?? g}
` + items.filter((i) => i.grp === g).map((i) => {
      const l = line(i);
      return `- ${l.kind}: ${l.main} (${l.supplier}${l.when ? ` \xB7 ${l.when}` : ""}) ${new URL(i.link, siteUrl)}`;
    }).join("\n")).join("\n");
  } else {
    const text2 = t(m.notifications.events[row.event_code], row.params);
    subject = text2.length > 120 ? `${text2.slice(0, 117)}\u2026` : text2;
    const extra = row.params.asContact ? `<p>${escapeHtml(t(m.emails.escalationContact))}</p>` : "";
    bodyHtml = `<p style="font-size:15px">${escapeHtml(text2)}</p>${extra}`;
    bodyText = text2 + (row.params.asContact ? `

${t(m.emails.escalationContact)}` : "");
  }
  const button = `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px">${escapeHtml(t(m.emails.open))}</a></p>`;
  const html = `<!doctype html><html lang="${locale}"><body style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px"><p style="font-size:13px;color:#777;margin:0 0 16px">${escapeHtml(t(m.emails.brand))}</p><p>${escapeHtml(greeting)}</p>${bodyHtml}${button}<hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="font-size:12px;color:#777">${escapeHtml(footer)}</p></body></html>`;
  const text = `${greeting}

${bodyText}

${t(m.emails.open)}: ${link}

--
${footer}`;
  return { subject: `${t(m.emails.brand)} \xB7 ${subject}`, html, text, locale };
}

// supabase/functions/notifications/index.ts
var SUPABASE_URL = Deno.env.get("SUPABASE_URL");
var SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:3000";
var EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "SQM App <noreply@sqm.local>";
var RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
var MAILPIT_URL = Deno.env.get("MAILPIT_URL") ?? (SUPABASE_URL.startsWith("http://kong") ? "http://inbucket:8025" : void 0);
var Unauthorized = class extends Error {
};
function rpcFor(key) {
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  return async function rpc(name, body = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.status === 401 || res.status === 403) throw new Unauthorized(`${name}: ${res.status} ${await res.text()}`);
    if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
}
function parseFrom(from) {
  const m = from.match(/^(.*)<(.+)>$/);
  return m ? { Name: m[1].trim(), Email: m[2].trim() } : { Email: from };
}
async function deliver(to, mail) {
  if (RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to.email], subject: mail.subject, html: mail.html, text: mail.text })
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
    return;
  }
  if (MAILPIT_URL) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: parseFrom(EMAIL_FROM),
        To: [{ Email: to.email, Name: to.name ?? "" }],
        Subject: mail.subject,
        HTML: mail.html,
        Text: mail.text
      })
    });
    if (!res.ok) throw new Error(`mailpit ${res.status}: ${await res.text()}`);
    return;
  }
  throw new Error("no_email_transport: configure RESEND_API_KEY");
}
async function drain(rpc) {
  if (!RESEND_API_KEY && !MAILPIT_URL) return { sent: 0, failed: 0, waiting: "no_email_transport" };
  let sent = 0;
  let failed = 0;
  for (let round = 0; round < 20; round++) {
    const batch = await rpc("claim_email_batch", { p_limit: 50 });
    if (!batch.length) break;
    for (const row of batch) {
      try {
        const m = messages_default[row.locale === "en" ? "en" : "pt-BR"];
        await deliver({ email: row.recipient_email, name: row.recipient_name }, renderEmail(row, m, SITE_URL));
        await rpc("mark_email_result", { p_id: row.id, p_ok: true });
        sent++;
      } catch (e) {
        await rpc("mark_email_result", { p_id: row.id, p_ok: false, p_error: String(e) });
        failed++;
      }
    }
  }
  return { sent, failed };
}
Deno.serve(async (req) => {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const rpc = rpcFor(token);
  const { task } = await req.json().catch(() => ({ task: "send" }));
  try {
    const daily = task === "daily" ? await rpc("run_daily_jobs") : null;
    const result = await drain(rpc);
    return Response.json({ daily, ...result });
  } catch (e) {
    if (e instanceof Unauthorized) return Response.json({ error: "unauthorized", detail: e.message }, { status: 401 });
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
