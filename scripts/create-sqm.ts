/**
 * Cria o primeiro SQM (bootstrap). Depois disso, todos os outros usuários são
 * convidados pela tela "Usuários".
 *
 * Uso (com as variáveis do ambiente alvo em .env.local ou no shell):
 *   npm run create-sqm -- --email maria@empresa.com --name "Maria Silva" [--lang en]
 *
 * O SQM recebe um e-mail de convite para definir a senha.
 */
import { config } from "dotenv";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, lang: { type: "string", default: "pt-BR" } },
});

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!url || !secret) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");
  if (!values.email || !values.name) throw new Error('Informe --email e --name "Nome Completo".');
  if (values.lang !== "pt-BR" && values.lang !== "en") throw new Error("--lang deve ser pt-BR ou en.");

  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const email = values.email.trim().toLowerCase();

  const { data: existing } = await admin.from("users").select("id").ilike("email", email).maybeSingle();
  if (existing) throw new Error(`Já existe um usuário com o e-mail ${email}.`);

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: values.name, language: values.lang },
    redirectTo: `${site}/login`,  // o link volta com a sessão no fragmento (AuthHashHandler)
  });
  if (error || !data.user) throw error ?? new Error("Falha ao convidar.");

  const { error: insertError } = await admin.from("users").insert({
    id: data.user.id,
    full_name: values.name,
    email,
    role: "sqm",
    language: values.lang,
    invited_at: new Date().toISOString(),
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw insertError;
  }

  console.log(`SQM criado. Convite enviado para ${email}.`);
}

main().catch((e) => {
  console.error("Erro:", e.message ?? e);
  process.exit(1);
});
