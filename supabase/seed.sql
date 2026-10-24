-- =============================================================================
-- SQM App — dados FICTÍCIOS para desenvolvimento local e testes.
-- Nunca rodar em produção. Senha de todos os usuários: Senha12345
-- =============================================================================

-- Usuários de autenticação (equivalente a ter aceitado o convite).
create or replace function pg_temp.seed_auth_user(p_id uuid, p_email text, p_name text, p_lang text)
returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('Senha12345', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_name, 'language', p_lang),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text,
          jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
end $$;

select pg_temp.seed_auth_user('00000000-0000-4000-8000-000000000001', 'sqm@sqm.local',        'Marina SQM',        'pt-BR');
select pg_temp.seed_auth_user('00000000-0000-4000-8000-000000000002', 'sqe@sqm.local',        'Sérgio SQE',        'pt-BR');
select pg_temp.seed_auth_user('00000000-0000-4000-8000-000000000003', 'sqe2@sqm.local',       'Eva SQE',           'en');
select pg_temp.seed_auth_user('00000000-0000-4000-8000-0000000000a1', 'qualidade@fornecedor-a.local', 'Ana Fornecedor A', 'pt-BR');
select pg_temp.seed_auth_user('00000000-0000-4000-8000-0000000000b1', 'quality@supplier-b.local',     'Bob Supplier B',  'en');

-- Perfis internos (precisam existir antes de serem SQE responsáveis).
insert into public.users (id, full_name, email, role, language, created_by) values
  ('00000000-0000-4000-8000-000000000001', 'Marina SQM', 'sqm@sqm.local',  'sqm', 'pt-BR', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002', 'Sérgio SQE', 'sqe@sqm.local',  'sqe', 'pt-BR', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000003', 'Eva SQE',    'sqe2@sqm.local', 'sqe', 'en',    '00000000-0000-4000-8000-000000000001');

-- Fornecedores fictícios A e B.
insert into public.suppliers (id, legal_name, country_code, tax_id, responsible_sqe_id, created_by) values
  ('10000000-0000-4000-8000-00000000000a', 'Fornecedor A Compósitos Ltda', 'BR', '11.222.333/0001-81',
   '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-00000000000b', 'Supplier B Castings Co.',      'CN', '91310000MA1FL0000X',
   '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001');

-- Usuários dos fornecedores.
insert into public.users (id, full_name, email, role, language, supplier_id, created_by) values
  ('00000000-0000-4000-8000-0000000000a1', 'Ana Fornecedor A', 'qualidade@fornecedor-a.local', 'supplier', 'pt-BR',
   '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000b1', 'Bob Supplier B',   'quality@supplier-b.local',     'supplier', 'en',
   '10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-000000000003');

-- Um anexo de cada fornecedor e um anexo interno, para os testes de isolamento.
insert into public.attachments (entity_table, entity_id, supplier_id, storage_path, file_name, mime_type, internal_only, created_by) values
  ('suppliers', '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a',
   '10000000-0000-4000-8000-00000000000a/seed/certificado-iso9001.pdf', 'certificado-iso9001.pdf', 'application/pdf', false,
   '00000000-0000-4000-8000-000000000002'),
  ('suppliers', '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a',
   'internal/seed/avaliacao-interna-a.pdf', 'avaliacao-interna-a.pdf', 'application/pdf', true,
   '00000000-0000-4000-8000-000000000002'),
  ('suppliers', '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b',
   '10000000-0000-4000-8000-00000000000b/seed/iso9001-certificate.pdf', 'iso9001-certificate.pdf', 'application/pdf', false,
   '00000000-0000-4000-8000-000000000003');
