-- =============================================================================
-- SQM App — segredos que o agendador (pg_cron) usa para chamar a função de e-mail.
-- 1. Troque os dois textos entre < > pelos valores do SEU projeto:
--    - URL do projeto: Project Settings → Data API → Project URL (ex.: https://abcd1234.supabase.co)
--    - chave service_role: Project Settings → API Keys → aba "Legacy API Keys" → service_role → Reveal
-- 2. Cole no SQL Editor e clique em Run (uma vez só).
-- A chave fica guardada criptografada no Vault; não salve este arquivo preenchido em lugar nenhum.
-- =============================================================================
select vault.create_secret('<URL DO PROJETO>', 'project_url');
select vault.create_secret('<CHAVE SERVICE_ROLE>', 'service_role_key');

select 'Segredos gravados: ' || count(*) as resultado
  from vault.secrets where name in ('project_url', 'service_role_key');
