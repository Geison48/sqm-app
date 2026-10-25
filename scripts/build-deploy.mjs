// Gera os arquivos de deploy sem linha de comando (painel do Supabase):
//   deploy/1-banco.sql            todas as migrations, em ordem (cole no SQL Editor)
//   deploy/2-funcao-notifications.ts  a Edge Function num arquivo só (cole no editor de funções)
//   deploy/atualizacoes/<migration>.sql  cada migration sozinha, para um banco que JÁ existe
// Rode depois de mudar migrations ou a função:  npm run build:deploy
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const migDir = new URL("supabase/migrations/", root);
const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();

const parts = [
  "-- =============================================================================",
  "-- SQM App — banco de dados completo para o Supabase de PRODUÇÃO.",
  "-- Gerado por `npm run build:deploy` a partir de supabase/migrations (não edite aqui).",
  "-- Cole TUDO no SQL Editor de um projeto NOVO e clique em Run (uma vez só).",
  "-- Não contém dados de exemplo (o seed.sql é só para o ambiente local).",
  "-- =============================================================================",
  "",
];
for (const f of files) {
  parts.push(`-- >>>>>>>>>> ${f}`, readFileSync(new URL(f, migDir), "utf8").trim(), "");
}
// Registra as migrations como aplicadas, para um futuro `supabase db push` não repeti-las.
parts.push(
  "-- >>>>>>>>>> registro das migrations aplicadas",
  "create schema if not exists supabase_migrations;",
  "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);",
  `insert into supabase_migrations.schema_migrations (version, name) values\n${files
    .map((f) => `  ('${f.split("_")[0]}', '${f.replace(/^\d+_/, "").replace(/\.sql$/, "")}')`)
    .join(",\n")}\non conflict (version) do nothing;`,
  "",
  "select 'SQM App: banco criado com sucesso' as resultado;",
  "",
);
writeFileSync(new URL("deploy/1-banco.sql", root), parts.join("\n"));

// Atualizações: cada migration num arquivo, para colar no SQL Editor de um banco
// já criado. Rodar de novo uma que já foi aplicada é bloqueado pelo registro.
mkdirSync(new URL("deploy/atualizacoes/", root), { recursive: true });
for (const f of files) {
  const version = f.split("_")[0];
  const name = f.replace(/^\d+_/, "").replace(/\.sql$/, "");
  writeFileSync(new URL(`deploy/atualizacoes/${f}`, root), [
    `-- SQM App — atualização ${version} (${name}). Gerado por \`npm run build:deploy\`.`,
    "-- Cole tudo no SQL Editor e clique em Run. Se já foi aplicada, para com aviso e não muda nada.",
    "do $$ begin",
    "  if exists (select 1 from pg_namespace where nspname = 'supabase_migrations')",
    `     and exists (select 1 from supabase_migrations.schema_migrations where version = '${version}') then`,
    `    raise exception 'Atualização ${version} já aplicada: nada a fazer.';`,
    "  end if;",
    "end $$;",
    "",
    readFileSync(new URL(f, migDir), "utf8").trim(),
    "",
    "create schema if not exists supabase_migrations;",
    "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);",
    `insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}') on conflict (version) do nothing;`,
    `select 'Atualização ${version} aplicada com sucesso' as resultado;`,
    "",
  ].join("\n"));
}

const result = await build({
  entryPoints: [new URL("supabase/functions/notifications/index.ts", root).pathname],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  loader: { ".json": "json" },
  legalComments: "none",
});
writeFileSync(
  new URL("deploy/2-funcao-notifications.ts", root),
  "// SQM App — Edge Function \"notifications\" (arquivo único, gerado por `npm run build:deploy`).\n" +
    "// Cole no editor de Edge Functions do Supabase com o nome: notifications\n" +
    result.outputFiles[0].text,
);
console.log(`deploy/1-banco.sql (${files.length} migrations) e deploy/2-funcao-notifications.ts gerados`);
