// Edge Function "notifications" — chamada pelo pg_cron:
//   { task: "daily" } → escalonamento, prazos chegando e resumo diário; depois envia a fila
//   { task: "send" }  → só envia a fila (email_outbox)
// Envio: Resend (RESEND_API_KEY) em produção; Mailpit no ambiente local.
import messages from "../_shared/messages.json" with { type: "json" };
import { renderEmail, type Messages, type OutboxRow } from "../_shared/render.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:3000";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "SQM App <noreply@sqm.local>";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Local: o Mailpit do Supabase CLI responde em http://inbucket:8025 dentro da rede Docker.
const MAILPIT_URL = Deno.env.get("MAILPIT_URL") ?? (SUPABASE_URL.startsWith("http://kong") ? "http://inbucket:8025" : undefined);

// A chave que chega no Authorization (a do Vault, enviada pelo pg_cron) é usada
// para falar com o banco: as funções da rotina só aceitam a chave de serviço, então
// é o próprio banco que barra chamadas de fora. Vale a service_role (JWT) ou a
// secret key nova (sb_secret_...), que vai só no cabeçalho apikey.
class Unauthorized extends Error {}

function rpcFor(key: string) {
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  return async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.status === 401 || res.status === 403) throw new Unauthorized(`${name}: ${res.status} ${await res.text()}`);
    if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  };
}
type Rpc = ReturnType<typeof rpcFor>;

function parseFrom(from: string) {
  const m = from.match(/^(.*)<(.+)>$/);
  return m ? { Name: m[1]!.trim(), Email: m[2]!.trim() } : { Email: from };
}

async function deliver(to: { email: string; name: string | null }, mail: { subject: string; html: string; text: string }) {
  if (RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to.email], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
    return;
  }
  if (MAILPIT_URL) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: parseFrom(EMAIL_FROM), To: [{ Email: to.email, Name: to.name ?? "" }],
        Subject: mail.subject, HTML: mail.html, Text: mail.text,
      }),
    });
    if (!res.ok) throw new Error(`mailpit ${res.status}: ${await res.text()}`);
    return;
  }
  throw new Error("no_email_transport: configure RESEND_API_KEY");
}

type Row = OutboxRow & { id: string; recipient_email: string };

async function drain(rpc: Rpc) {
  // Sem forma de envio (Resend ainda não configurado): os e-mails esperam na fila,
  // sem gastar tentativas, e saem quando a chave for cadastrada.
  if (!RESEND_API_KEY && !MAILPIT_URL) return { sent: 0, failed: 0, waiting: "no_email_transport" };
  let sent = 0;
  let failed = 0;
  for (let round = 0; round < 20; round++) {
    const batch = await rpc<Row[]>("claim_email_batch", { p_limit: 50 });
    if (!batch.length) break;
    for (const row of batch) {
      try {
        const m = (messages as Record<string, Messages>)[row.locale === "en" ? "en" : "pt-BR"]!;
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
