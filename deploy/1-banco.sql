-- =============================================================================
-- SQM App — banco de dados completo para o Supabase de PRODUÇÃO.
-- Gerado por `npm run build:deploy` a partir de supabase/migrations (não edite aqui).
-- Cole TUDO no SQL Editor de um projeto NOVO e clique em Run (uma vez só).
-- Não contém dados de exemplo (o seed.sql é só para o ambiente local).
-- =============================================================================

-- >>>>>>>>>> 20261024000100_foundation.sql
-- =============================================================================
-- SQM App — Etapa 1: fundação
--   * perfis (users) e fornecedores (núcleo mínimo; M1 completo na etapa 2)
--   * helpers de RLS: current_app_role(), current_supplier_id() e afins
--   * audit_log genérico + trigger reutilizável
--   * proibição de DELETE: registros só são cancelados com motivo (regra 16)
--   * attachments genérico + bucket privado no Storage
--   * app_settings (configurações editáveis, nada hardcoded)
--
-- Nota: a função de perfil chama-se current_app_role() e não current_role(),
-- porque CURRENT_ROLE é palavra reservada do PostgreSQL: sem o prefixo de
-- schema, "current_role" devolve o papel do banco ("authenticated") em vez do
-- perfil do usuário, o que tornaria uma política RLS silenciosamente errada.
-- =============================================================================

create schema if not exists app;
comment on schema app is 'Funções internas (triggers e utilitários). Não exposto na API.';

create type public.app_role as enum ('sqe', 'sqm', 'supplier');
create type public.app_language as enum ('pt-BR', 'en');

-- -----------------------------------------------------------------------------
-- Triggers genéricos
-- -----------------------------------------------------------------------------

-- Preenche created_*/updated_*/cancelled_* e congela registros cancelados.
create or replace function app.tg_set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := new.created_by;
    if new.cancelled_at is not null then
      raise exception 'cannot_insert_cancelled' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.cancelled_at is not null then
    raise exception 'record_cancelled' using errcode = 'P0001',
      hint = 'Registro cancelado não pode ser alterado.';
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);

  if new.cancelled_at is not null then
    new.cancelled_at := now();
    new.cancelled_by := coalesce(auth.uid(), new.cancelled_by);
  end if;
  return new;
end;
$$;

-- Regra 16: nada é apagado.
create or replace function app.tg_prevent_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'delete_not_allowed' using errcode = 'P0001',
    hint = format('Registros de %s não podem ser apagados; cancele com motivo.', tg_table_name);
end;
$$;

-- -----------------------------------------------------------------------------
-- audit_log
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id             bigint generated always as identity primary key,
  table_name     text        not null,
  record_id      uuid        not null,
  supplier_id    uuid,
  action         text        not null check (action in ('insert', 'update', 'cancel')),
  changed_fields text[]      not null default '{}',
  before         jsonb,
  after          jsonb,
  actor_id       uuid,
  actor_role     public.app_role,
  at             timestamptz not null default now()
);
comment on table public.audit_log is
  'Log de auditoria: quem, quando, campos alterados, valor antes e depois. Somente inserção via trigger.';

create index audit_log_record_idx   on public.audit_log (table_name, record_id, at desc);
create index audit_log_supplier_idx on public.audit_log (supplier_id, at desc);
create index audit_log_actor_idx    on public.audit_log (actor_id, at desc);

-- Grava uma linha por INSERT/UPDATE com o diff dos campos alterados.
create or replace function app.tg_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_new     jsonb := to_jsonb(new);
  v_ignore  text[] := array['updated_at', 'updated_by'];
  v_fields  text[];
  v_before  jsonb;
  v_after   jsonb;
  v_action  text;
  v_actor   uuid;
  v_role    public.app_role;
  v_supplier uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_after := v_new;
    select coalesce(array_agg(k order by k), '{}') into v_fields from jsonb_object_keys(v_new) k;
  else
    select coalesce(array_agg(n.key order by n.key), '{}'),
           jsonb_object_agg(n.key, v_old -> n.key),
           jsonb_object_agg(n.key, n.value)
      into v_fields, v_before, v_after
      from jsonb_each(v_new) n
     where not (n.key = any (v_ignore))
       and n.value is distinct from v_old -> n.key;

    if coalesce(cardinality(v_fields), 0) = 0 then
      return null;
    end if;

    v_action := case
      when (v_old ->> 'cancelled_at') is null and (v_new ->> 'cancelled_at') is not null then 'cancel'
      else 'update'
    end;
  end if;

  v_actor := coalesce(auth.uid(), (v_new ->> 'updated_by')::uuid, (v_new ->> 'created_by')::uuid);
  select u.role into v_role from public.users u where u.id = v_actor;

  v_supplier := case
    when tg_table_name = 'suppliers' then (v_new ->> 'id')::uuid
    else (v_new ->> 'supplier_id')::uuid
  end;

  insert into public.audit_log
    (table_name, record_id, supplier_id, action, changed_fields, before, after, actor_id, actor_role)
  values
    (tg_table_name, (v_new ->> 'id')::uuid, v_supplier, v_action, v_fields, v_before, v_after, v_actor, v_role);

  return null;
end;
$$;

-- Aplica o "contrato" de tabela de negócio a qualquer tabela:
--   colunas padrão, regra de cancelamento com motivo, triggers e bloqueio de DELETE.
-- Uso: select app.setup_business_table('public.minha_tabela');
create or replace function app.setup_business_table(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_name text := (select c.relname from pg_catalog.pg_class c where c.oid = p_table);
begin
  execute format($f$
    alter table %1$s
      add column if not exists created_at    timestamptz not null default now(),
      add column if not exists updated_at    timestamptz not null default now(),
      add column if not exists created_by    uuid references auth.users (id),
      add column if not exists updated_by    uuid references auth.users (id),
      add column if not exists cancelled_at  timestamptz,
      add column if not exists cancelled_by  uuid references auth.users (id),
      add column if not exists cancel_reason text
  $f$, p_table);

  execute format($f$
    alter table %1$s
      add constraint %2$I check (
        (cancelled_at is null and cancel_reason is null)
        or (cancelled_at is not null and coalesce(length(btrim(cancel_reason)), 0) >= 3)
      )
  $f$, p_table, v_name || '_cancel_reason_chk');

  execute format('create trigger set_audit_fields before insert or update on %s
                    for each row execute function app.tg_set_audit_fields()', p_table);
  execute format('create trigger prevent_delete before delete on %s
                    for each row execute function app.tg_prevent_delete()', p_table);
  execute format('create trigger audit_log after insert or update on %s
                    for each row execute function app.tg_audit_log()', p_table);
  execute format('revoke delete, truncate on %s from anon, authenticated', p_table);
end;
$$;

-- -----------------------------------------------------------------------------
-- suppliers (núcleo; campos completos do M1 entram na etapa 2)
-- -----------------------------------------------------------------------------
create table public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  legal_name         text not null check (length(btrim(legal_name)) > 0),
  country_code       char(2) not null default 'BR',
  tax_id             text,
  responsible_sqe_id uuid
);
comment on table public.suppliers is 'Fornecedores. Cada fornecedor é a fronteira de isolamento da RLS.';
select app.setup_business_table('public.suppliers');

-- -----------------------------------------------------------------------------
-- users (perfil da aplicação; 1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users (id),
  full_name   text not null check (length(btrim(full_name)) > 0),
  email       text not null,
  role        public.app_role not null,
  language    public.app_language not null default 'pt-BR',
  supplier_id uuid references public.suppliers (id),
  invited_by  uuid references auth.users (id),
  invited_at  timestamptz,
  constraint users_supplier_role_chk check ((role = 'supplier') = (supplier_id is not null))
);
comment on table public.users is
  'Perfis: sqe, sqm ou supplier. Usuário de fornecedor sempre tem supplier_id. Desativar = cancelar com motivo.';
create unique index users_email_key on public.users (lower(email));
create index users_supplier_idx on public.users (supplier_id);
select app.setup_business_table('public.users');

alter table public.suppliers
  add constraint suppliers_responsible_sqe_fkey foreign key (responsible_sqe_id) references public.users (id);
create index suppliers_responsible_sqe_idx on public.suppliers (responsible_sqe_id);

-- Mantém users.email igual ao e-mail do auth.users.
create or replace function app.tg_sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end;
$$;
create trigger sync_user_email after update of email on auth.users
  for each row execute function app.tg_sync_user_email();

-- -----------------------------------------------------------------------------
-- Helpers de RLS (security definer: leem public.users sem recursão de política)
-- -----------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role from public.users u where u.id = auth.uid() and u.cancelled_at is null
$$;
comment on function public.current_app_role() is
  'Perfil (sqe/sqm/supplier) do usuário logado; null se não tem perfil ativo.';

create or replace function public.current_supplier_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.supplier_id from public.users u where u.id = auth.uid() and u.cancelled_at is null
$$;
comment on function public.current_supplier_id() is
  'supplier_id do usuário de fornecedor logado; null para SQE/SQM.';

create or replace function public.is_internal()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('sqe', 'sqm'), false)
$$;

create or replace function public.is_sqm()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'sqm', false)
$$;

-- Leitura: interno vê todos os fornecedores; fornecedor só o próprio.
create or replace function public.can_access_supplier(p_supplier_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_internal()
      or (p_supplier_id is not null and p_supplier_id = public.current_supplier_id())
$$;

-- Edição interna: SQM edita tudo; SQE só fornecedores sob sua responsabilidade.
create or replace function public.can_manage_supplier(p_supplier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.current_app_role()
    when 'sqm' then true
    when 'sqe' then exists (
      select 1 from public.suppliers s
       where s.id = p_supplier_id and s.responsible_sqe_id = auth.uid()
    )
    else false
  end
$$;

-- Escrita padrão em linhas de fornecedor: SQE/SQM conforme responsabilidade,
-- usuário de fornecedor somente no próprio supplier_id.
create or replace function public.can_write_supplier_row(p_supplier_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.can_manage_supplier(p_supplier_id)
      or (p_supplier_id is not null and p_supplier_id = public.current_supplier_id())
$$;

-- Quem pode convidar quem: SQM convida qualquer perfil; SQE convida usuários de
-- fornecedor (de qualquer fornecedor ativo).
create or replace function public.can_invite(p_role public.app_role, p_supplier_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_app_role() = 'sqm' then true
    when public.current_app_role() = 'sqe' then
      p_role = 'supplier'
      and exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.cancelled_at is null)
    else false
  end
$$;

-- Política padrão para tabelas com supplier_id. Tabelas com regras próprias
-- (ex.: custos internos) sobrescrevem depois.
-- Uso: select app.apply_default_supplier_policies('public.minha_tabela');
create or replace function app.apply_default_supplier_policies(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table %s enable row level security', p_table);
  execute format($f$create policy default_select on %s for select to authenticated
                    using ((select public.can_access_supplier(supplier_id)))$f$, p_table);
  execute format($f$create policy default_insert on %s for insert to authenticated
                    with check ((select public.can_write_supplier_row(supplier_id)))$f$, p_table);
  execute format($f$create policy default_update on %s for update to authenticated
                    using ((select public.can_write_supplier_row(supplier_id)))
                    with check ((select public.can_write_supplier_row(supplier_id)))$f$, p_table);
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS: suppliers
-- -----------------------------------------------------------------------------
alter table public.suppliers enable row level security;

create policy suppliers_select on public.suppliers for select to authenticated
  using ((select public.can_access_supplier(id)));

create policy suppliers_insert on public.suppliers for insert to authenticated
  with check ((select public.is_internal()));

create policy suppliers_update on public.suppliers for update to authenticated
  using ((select public.can_manage_supplier(id)))
  with check ((select public.can_manage_supplier(id)));

-- -----------------------------------------------------------------------------
-- RLS: users
-- -----------------------------------------------------------------------------
alter table public.users enable row level security;

-- Interno vê todos. Fornecedor vê a si mesmo, colegas do mesmo fornecedor e o
-- time interno (para saber quem é o SQE); nunca usuários de outro fornecedor.
create policy users_select on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_internal())
    or supplier_id = (select public.current_supplier_id())
    or (role in ('sqe', 'sqm') and (select public.current_app_role()) is not null)
  );

-- Inserção só pelo servidor (service role) após checar can_invite().
-- Atualização: o próprio usuário (nome/idioma), SQM em todos, SQE em usuários de fornecedor.
create policy users_update on public.users for update to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_sqm())
    or ((select public.current_app_role()) = 'sqe' and role = 'supplier')
  )
  with check (
    id = (select auth.uid())
    or (select public.is_sqm())
    or ((select public.current_app_role()) = 'sqe' and role = 'supplier')
  );

-- Somente o SQM muda perfil, fornecedor ou e-mail; ninguém desativa a si mesmo.
create or replace function app.tg_guard_users_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new; -- service role / tarefas do servidor
  end if;
  if (new.role is distinct from old.role
      or new.supplier_id is distinct from old.supplier_id
      or new.email is distinct from old.email)
     and not public.is_sqm() then
    raise exception 'only_sqm_can_change_role' using errcode = '42501';
  end if;
  if new.cancelled_at is not null and old.id = auth.uid() then
    raise exception 'cannot_deactivate_self' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_users_update before update on public.users
  for each row execute function app.tg_guard_users_update();

-- -----------------------------------------------------------------------------
-- app_settings: configurações gerais editáveis (fuso, idioma padrão etc.)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  value          jsonb not null,
  description_pt text,
  description_en text
);
select app.setup_business_table('public.app_settings');

alter table public.app_settings enable row level security;
create policy app_settings_select on public.app_settings for select to authenticated
  using ((select public.current_app_role()) is not null);
create policy app_settings_insert on public.app_settings for insert to authenticated
  with check ((select public.is_internal()));
create policy app_settings_update on public.app_settings for update to authenticated
  using ((select public.is_internal())) with check ((select public.is_internal()));

insert into public.app_settings (key, value, description_pt, description_en) values
  ('timezone', '"America/Sao_Paulo"',
   'Fuso horário usado na contagem de prazos (dias corridos).',
   'Time zone used to count deadlines (calendar days).'),
  ('default_language', '"pt-BR"',
   'Idioma padrão para novos usuários.',
   'Default language for new users.');

-- -----------------------------------------------------------------------------
-- audit_log: RLS (somente leitura para internos; escrita só via trigger)
-- -----------------------------------------------------------------------------
alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select public.is_internal()));
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

create or replace function app.tg_audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log_is_append_only' using errcode = 'P0001';
end;
$$;
create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function app.tg_audit_log_immutable();

-- -----------------------------------------------------------------------------
-- attachments genérico (qualquer registro), com versão
-- -----------------------------------------------------------------------------
create table public.attachments (
  id             uuid primary key default gen_random_uuid(),
  entity_table   text not null,
  entity_id      uuid not null,
  supplier_id    uuid references public.suppliers (id),
  storage_bucket text not null default 'attachments',
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text,
  size_bytes     bigint,
  version        integer not null default 1 check (version >= 1),
  supersedes_id  uuid references public.attachments (id),
  internal_only  boolean not null default false,
  description    text
);
comment on column public.attachments.internal_only is
  'Anexo interno (SQE/SQM): nunca visível ao fornecedor.';
create index attachments_entity_idx   on public.attachments (entity_table, entity_id);
create index attachments_supplier_idx on public.attachments (supplier_id);
select app.setup_business_table('public.attachments');

alter table public.attachments enable row level security;

create policy attachments_select on public.attachments for select to authenticated
  using (
    (select public.is_internal())
    or (supplier_id = (select public.current_supplier_id()) and not internal_only)
  );

create policy attachments_insert on public.attachments for insert to authenticated
  with check (
    (select public.is_internal())
    or (supplier_id = (select public.current_supplier_id()) and not internal_only)
  );

create policy attachments_update on public.attachments for update to authenticated
  using (
    (select public.is_internal())
    or (supplier_id = (select public.current_supplier_id()) and not internal_only)
  )
  with check (
    (select public.is_internal())
    or (supplier_id = (select public.current_supplier_id()) and not internal_only)
  );

-- Storage: bucket privado; caminho = <supplier_id | internal>/<uuid>/<arquivo>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do nothing;

create policy attachments_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (
      (select public.is_internal())
      or exists (
        select 1 from public.attachments a
         where a.storage_bucket = 'attachments'
           and a.storage_path = storage.objects.name
           and a.supplier_id = (select public.current_supplier_id())
           and not a.internal_only
           and a.cancelled_at is null
      )
    )
  );

create policy attachments_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (
      (select public.is_internal())
      or (storage.foldername(name))[1] = (select public.current_supplier_id())::text
    )
  );
-- Sem políticas de update/delete no Storage: arquivo nunca é sobrescrito nem
-- apagado; nova versão = novo objeto + nova linha em attachments.

-- Funções internas não são chamáveis pela API.
revoke execute on all functions in schema app from public, anon, authenticated;

-- >>>>>>>>>> 20261024000200_master_data.sql
-- =============================================================================
-- SQM App — Etapa 2: M1 Cadastros
--   * listas configuráveis: status do fornecedor, funções de contato, etapas da
--     qualificação (rótulos PT/EN editáveis; códigos usados pelas regras são fixos)
--   * fornecedor completo (CNPJ validado p/ BR, inclusive alfanumérico), status
--     com histórico e justificativa obrigatória (regra 2)
--   * plantas, contatos, certificações, subfornecedores
--   * componentes (N:N fornecedores e normas), biblioteca de normas e requisitos
--   * qualificação inicial (versão simples)
--   * notificações in-app + alertas de vencimento de certificados (60/30/7 dias)
-- =============================================================================

create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- Listas configuráveis (lookup)
-- -----------------------------------------------------------------------------

-- Código imutável; itens de sistema não podem ser cancelados.
create or replace function app.tg_protect_lookup()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'lookup_code_immutable' using errcode = 'P0001';
  end if;
  if old.is_system and new.cancelled_at is not null then
    raise exception 'lookup_system_item' using errcode = 'P0001',
      hint = 'Itens usados pelas regras do sistema podem ser renomeados, não cancelados.';
  end if;
  return new;
end;
$$;

create or replace function app.setup_lookup_table(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform app.setup_business_table(p_table);
  execute format('create trigger protect_lookup before update on %s
                    for each row execute function app.tg_protect_lookup()', p_table);
  execute format('alter table %s enable row level security', p_table);
  execute format($f$create policy lookup_select on %s for select to authenticated
                    using ((select public.current_app_role()) is not null)$f$, p_table);
  execute format($f$create policy lookup_insert on %s for insert to authenticated
                    with check ((select public.is_internal()) and not is_system)$f$, p_table);
  execute format($f$create policy lookup_update on %s for update to authenticated
                    using ((select public.is_internal())) with check ((select public.is_internal()))$f$, p_table);
end;
$$;

create table public.supplier_statuses (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt   text not null,
  label_en   text not null,
  tone       text not null default 'neutral' check (tone in ('neutral', 'success', 'warning', 'danger', 'info')),
  sort_order integer not null default 0,
  is_system  boolean not null default false
);
select app.setup_lookup_table('public.supplier_statuses');

insert into public.supplier_statuses (code, label_pt, label_en, tone, sort_order, is_system) values
  ('in_qualification',       'Em qualificação',         'In qualification',         'info',    10, true),
  ('approved',               'Homologado',              'Approved',                 'success', 20, true),
  ('conditionally_approved', 'Homologado condicional',  'Conditionally approved',   'warning', 30, true),
  ('controlled_shipment',    'Embarque controlado',     'Controlled shipment',      'warning', 40, true),
  ('blocked',                'Bloqueado',               'Blocked',                  'danger',  50, true),
  ('disqualified',           'Desqualificado',          'Disqualified',             'danger',  60, true);

create table public.contact_roles (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt   text not null,
  label_en   text not null,
  sort_order integer not null default 0,
  is_system  boolean not null default false
);
select app.setup_lookup_table('public.contact_roles');

-- quality e director são usados no escalonamento (M5).
insert into public.contact_roles (code, label_pt, label_en, sort_order, is_system) values
  ('quality',     'Qualidade',   'Quality',     10, true),
  ('commercial',  'Comercial',   'Commercial',  20, true),
  ('director',    'Direção',     'Management',  30, true),
  ('engineering', 'Engenharia',  'Engineering', 40, false),
  ('logistics',   'Logística',   'Logistics',   50, false);

create table public.qualification_step_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt   text not null,
  label_en   text not null,
  sort_order integer not null default 0,
  is_system  boolean not null default false
);
select app.setup_lookup_table('public.qualification_step_types');

insert into public.qualification_step_types (code, label_pt, label_en, sort_order, is_system) values
  ('self_assessment', 'Autoavaliação do fornecedor', 'Supplier self-assessment', 10, true),
  ('potential_audit', 'Auditoria de potencial',      'Potential audit',          20, true),
  ('risk_analysis',   'Análise de risco',            'Risk analysis',            30, true);

insert into public.app_settings (key, value, description_pt, description_en) values
  ('certificate_alert_days', '[60, 30, 7]',
   'Dias antes do vencimento de certificados em que um alerta é gerado.',
   'Days before certificate expiry when an alert is generated.');

-- -----------------------------------------------------------------------------
-- CNPJ (numérico e alfanumérico, Receita Federal a partir de 07/2026)
-- -----------------------------------------------------------------------------
create or replace function public.normalize_tax_id(p_country char(2), p_tax_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tax_id is null or btrim(p_tax_id) = '' then null
    when p_country = 'BR' then upper(regexp_replace(p_tax_id, '[^0-9A-Za-z]', '', 'g'))
    else btrim(p_tax_id)
  end
$$;

create or replace function public.is_valid_cnpj(p_cnpj text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := upper(regexp_replace(coalesce(p_cnpj, ''), '[^0-9A-Za-z]', '', 'g'));
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int;
  d1 int;
  d2 int;
begin
  if v !~ '^[0-9A-Z]{12}[0-9]{2}$' or v ~ '^(.)\1{13}$' then
    return false;
  end if;
  s := 0;
  for i in 1..12 loop s := s + (ascii(substr(v, i, 1)) - 48) * w1[i]; end loop;
  d1 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  s := 0;
  for i in 1..13 loop s := s + (ascii(substr(v, i, 1)) - 48) * w2[i]; end loop;
  d2 := case when s % 11 < 2 then 0 else 11 - s % 11 end;
  return d1 = (ascii(substr(v, 13, 1)) - 48) and d2 = (ascii(substr(v, 14, 1)) - 48);
end;
$$;

-- -----------------------------------------------------------------------------
-- Fornecedor: campos do M1
-- -----------------------------------------------------------------------------
alter table public.suppliers
  add column trade_name  text,
  add column criticality char(1) not null default 'C' check (criticality in ('A', 'B', 'C')),
  add column status_code text not null default 'in_qualification' references public.supplier_statuses (code),
  add column website     text,
  add column notes       text;

create unique index suppliers_tax_id_key on public.suppliers (country_code, tax_id)
  where cancelled_at is null and tax_id is not null;
create index suppliers_status_idx on public.suppliers (status_code);

-- Normaliza/valida o documento e protege campos com fluxo próprio.
create or replace function app.tg_suppliers_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.country_code := upper(new.country_code);
  new.tax_id := public.normalize_tax_id(new.country_code, new.tax_id);
  if new.country_code = 'BR' then
    if new.tax_id is null then
      raise exception 'cnpj_required' using errcode = '23514';
    end if;
    if not public.is_valid_cnpj(new.tax_id) then
      raise exception 'cnpj_invalid' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- Regra 2: status só muda pelo fluxo com justificativa (change_supplier_status).
    if new.status_code is distinct from old.status_code
       and coalesce(current_setting('app.status_change', true), 'off') <> 'on' then
      raise exception 'status_requires_justification' using errcode = 'P0001';
    end if;
    if new.responsible_sqe_id is distinct from old.responsible_sqe_id
       and auth.uid() is not null and not public.is_sqm() then
      raise exception 'only_sqm_can_reassign' using errcode = '42501';
    end if;
  end if;

  if new.responsible_sqe_id is not null
     and (tg_op = 'INSERT' or new.responsible_sqe_id is distinct from old.responsible_sqe_id)
     and not exists (
    select 1 from public.users u
     where u.id = new.responsible_sqe_id and u.role in ('sqe', 'sqm') and u.cancelled_at is null
  ) then
    raise exception 'responsible_must_be_internal' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger suppliers_guard before insert or update on public.suppliers
  for each row execute function app.tg_suppliers_guard();

-- SQE só cria fornecedor sob sua própria responsabilidade; SQM atribui qualquer SQE.
drop policy suppliers_insert on public.suppliers;
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (
    (select public.is_sqm())
    or ((select public.current_app_role()) = 'sqe' and responsible_sqe_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- Histórico de status (regra 2)
-- -----------------------------------------------------------------------------
create table public.supplier_status_history (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references public.suppliers (id),
  from_status   text references public.supplier_statuses (code),
  to_status     text not null references public.supplier_statuses (code),
  justification text,
  constraint status_history_justification_chk check (
    from_status is null or coalesce(length(btrim(justification)), 0) >= 5
  )
);
select app.setup_business_table('public.supplier_status_history');
create index supplier_status_history_supplier_idx on public.supplier_status_history (supplier_id, created_at desc);

alter table public.supplier_status_history enable row level security;
create policy status_history_select on public.supplier_status_history for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
-- Escrita só pelas funções abaixo (histórico é imutável).
revoke insert, update on public.supplier_status_history from anon, authenticated;

create or replace function app.tg_suppliers_initial_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.supplier_status_history (supplier_id, from_status, to_status, created_by)
  values (new.id, null, new.status_code, new.created_by);
  return null;
end;
$$;
create trigger suppliers_initial_status after insert on public.suppliers
  for each row execute function app.tg_suppliers_initial_status();

create or replace function public.change_supplier_status(
  p_supplier_id uuid,
  p_status text,
  p_justification text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.can_manage_supplier(p_supplier_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_justification)), 0) < 5 then
    raise exception 'justification_required' using errcode = '23514';
  end if;
  if not exists (select 1 from public.supplier_statuses where code = p_status and cancelled_at is null) then
    raise exception 'invalid_status' using errcode = '23514';
  end if;

  select status_code into v_old from public.suppliers
   where id = p_supplier_id and cancelled_at is null
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_old = p_status then
    raise exception 'status_unchanged' using errcode = '23514';
  end if;

  perform set_config('app.status_change', 'on', true);
  update public.suppliers set status_code = p_status where id = p_supplier_id;
  perform set_config('app.status_change', 'off', true);

  insert into public.supplier_status_history (supplier_id, from_status, to_status, justification, created_by)
  values (p_supplier_id, v_old, p_status, btrim(p_justification), auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- Plantas
-- -----------------------------------------------------------------------------
create table public.plants (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.suppliers (id),
  name         text not null check (length(btrim(name)) > 0),
  address_line text,
  city         text,
  state        text,
  postal_code  text,
  country_code char(2) not null default 'BR',
  is_main      boolean not null default false,
  notes        text
);
create index plants_supplier_idx on public.plants (supplier_id);
select app.setup_business_table('public.plants');

alter table public.plants enable row level security;
create policy plants_select on public.plants for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
create policy plants_insert on public.plants for insert to authenticated
  with check ((select public.can_manage_supplier(supplier_id)));
create policy plants_update on public.plants for update to authenticated
  using ((select public.can_manage_supplier(supplier_id)))
  with check ((select public.can_manage_supplier(supplier_id)));

-- -----------------------------------------------------------------------------
-- Contatos (fornecedor atualiza os próprios)
-- -----------------------------------------------------------------------------
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id),
  plant_id    uuid references public.plants (id),
  role_code   text not null references public.contact_roles (code),
  full_name   text not null check (length(btrim(full_name)) > 0),
  job_title   text,
  email       text,
  phone       text,
  is_primary  boolean not null default false
);
create index contacts_supplier_idx on public.contacts (supplier_id, role_code);
select app.setup_business_table('public.contacts');
select app.apply_default_supplier_policies('public.contacts');

-- -----------------------------------------------------------------------------
-- Biblioteca de normas
-- -----------------------------------------------------------------------------
create table public.standards (
  id          uuid primary key default gen_random_uuid(),
  code        text not null check (length(btrim(code)) > 0),
  title_pt    text not null,
  title_en    text not null,
  revision    text,
  application text not null check (application in ('product', 'process', 'system')),
  issuer      text,
  notes       text
);
select app.setup_business_table('public.standards');
create unique index standards_code_rev_key on public.standards (lower(code), coalesce(lower(revision), ''))
  where cancelled_at is null;

create table public.standard_requirements (
  id          uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.standards (id),
  item_code   text not null,
  text_pt     text not null,
  text_en     text not null,
  kind        text not null default 'both' check (kind in ('audit', 'inspection', 'both')),
  sort_order  integer not null default 0
);
create index standard_requirements_standard_idx on public.standard_requirements (standard_id, sort_order);
select app.setup_business_table('public.standard_requirements');

-- Normas: configuração interna (SQE e SQM), invisível ao fornecedor.
alter table public.standards enable row level security;
create policy standards_select on public.standards for select to authenticated using ((select public.is_internal()));
create policy standards_insert on public.standards for insert to authenticated with check ((select public.is_internal()));
create policy standards_update on public.standards for update to authenticated
  using ((select public.is_internal())) with check ((select public.is_internal()));

alter table public.standard_requirements enable row level security;
create policy std_req_select on public.standard_requirements for select to authenticated using ((select public.is_internal()));
create policy std_req_insert on public.standard_requirements for insert to authenticated with check ((select public.is_internal()));
create policy std_req_update on public.standard_requirements for update to authenticated
  using ((select public.is_internal())) with check ((select public.is_internal()));

-- -----------------------------------------------------------------------------
-- Certificações (do fornecedor ou de um subfornecedor)
-- -----------------------------------------------------------------------------
create table public.sub_suppliers (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.suppliers (id),
  name         text not null check (length(btrim(name)) > 0),
  country_code char(2),
  material     text,
  notes        text
);
create index sub_suppliers_supplier_idx on public.sub_suppliers (supplier_id);
select app.setup_business_table('public.sub_suppliers');

alter table public.sub_suppliers enable row level security;
create policy sub_suppliers_select on public.sub_suppliers for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
create policy sub_suppliers_insert on public.sub_suppliers for insert to authenticated
  with check ((select public.can_manage_supplier(supplier_id)));
create policy sub_suppliers_update on public.sub_suppliers for update to authenticated
  using ((select public.can_manage_supplier(supplier_id)))
  with check ((select public.can_manage_supplier(supplier_id)));

create table public.certifications (
  id                 uuid primary key default gen_random_uuid(),
  supplier_id        uuid not null references public.suppliers (id),
  sub_supplier_id    uuid references public.sub_suppliers (id),
  standard_id        uuid references public.standards (id),
  standard_name      text not null check (length(btrim(standard_name)) > 0),
  certificate_number text,
  issuer             text,
  scope              text,
  issued_on          date,
  valid_until        date,
  constraint certifications_dates_chk check (issued_on is null or valid_until is null or valid_until >= issued_on)
);
create index certifications_supplier_idx on public.certifications (supplier_id);
select app.setup_business_table('public.certifications');
create index certifications_valid_until_idx on public.certifications (valid_until) where cancelled_at is null;
select app.apply_default_supplier_policies('public.certifications');

-- -----------------------------------------------------------------------------
-- Componentes / part numbers
-- -----------------------------------------------------------------------------
create table public.components (
  id               uuid primary key default gen_random_uuid(),
  gw_code          text not null check (length(btrim(gw_code)) > 0),
  description      text not null,
  drawing_revision text,
  criticality      char(1) not null default 'C' check (criticality in ('A', 'B', 'C')),
  control_plan_ref text,
  notes            text
);
select app.setup_business_table('public.components');
create unique index components_gw_code_key on public.components (upper(gw_code)) where cancelled_at is null;

create table public.supplier_components (
  id                   uuid primary key default gen_random_uuid(),
  supplier_id          uuid not null references public.suppliers (id),
  component_id         uuid not null references public.components (id),
  supplier_part_number text
);
create index supplier_components_component_idx on public.supplier_components (component_id);
select app.setup_business_table('public.supplier_components');
create unique index supplier_components_key on public.supplier_components (supplier_id, component_id)
  where cancelled_at is null;

create table public.component_standards (
  id           uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components (id),
  standard_id  uuid not null references public.standards (id)
);
select app.setup_business_table('public.component_standards');
create unique index component_standards_key on public.component_standards (component_id, standard_id)
  where cancelled_at is null;

create table public.sub_supplier_components (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers (id),
  sub_supplier_id uuid not null references public.sub_suppliers (id),
  component_id    uuid not null references public.components (id)
);
select app.setup_business_table('public.sub_supplier_components');
create unique index sub_supplier_components_key on public.sub_supplier_components (sub_supplier_id, component_id)
  where cancelled_at is null;

-- Componente: edita o SQM ou o SQE responsável por algum fornecedor vinculado.
-- Sem fornecedor vinculado, edita quem criou.
create or replace function public.can_manage_component(p_component_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.current_app_role()
    when 'sqm' then true
    when 'sqe' then
      exists (
        select 1 from public.supplier_components sc
          join public.suppliers s on s.id = sc.supplier_id
         where sc.component_id = p_component_id and sc.cancelled_at is null
           and s.responsible_sqe_id = auth.uid()
      )
      or (
        not exists (select 1 from public.supplier_components sc
                     where sc.component_id = p_component_id and sc.cancelled_at is null)
        and exists (select 1 from public.components c where c.id = p_component_id and c.created_by = auth.uid())
      )
    else false
  end
$$;

-- Fornecedor vê só componentes vinculados a ele.
create or replace function public.can_access_component(p_component_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_internal() or exists (
    select 1 from public.supplier_components sc
     where sc.component_id = p_component_id and sc.cancelled_at is null
       and sc.supplier_id = public.current_supplier_id()
  )
$$;

alter table public.components enable row level security;
create policy components_select on public.components for select to authenticated
  using ((select public.can_access_component(id)));
create policy components_insert on public.components for insert to authenticated
  with check ((select public.is_internal()));
create policy components_update on public.components for update to authenticated
  using ((select public.can_manage_component(id))) with check ((select public.can_manage_component(id)));

alter table public.supplier_components enable row level security;
create policy supplier_components_select on public.supplier_components for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
create policy supplier_components_insert on public.supplier_components for insert to authenticated
  with check ((select public.can_manage_supplier(supplier_id)));
create policy supplier_components_update on public.supplier_components for update to authenticated
  using ((select public.can_manage_supplier(supplier_id)))
  with check ((select public.can_manage_supplier(supplier_id)));

alter table public.component_standards enable row level security;
create policy component_standards_select on public.component_standards for select to authenticated
  using ((select public.is_internal()));
create policy component_standards_insert on public.component_standards for insert to authenticated
  with check ((select public.can_manage_component(component_id)));
create policy component_standards_update on public.component_standards for update to authenticated
  using ((select public.can_manage_component(component_id)))
  with check ((select public.can_manage_component(component_id)));

alter table public.sub_supplier_components enable row level security;
create policy sub_supplier_components_select on public.sub_supplier_components for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
create policy sub_supplier_components_insert on public.sub_supplier_components for insert to authenticated
  with check ((select public.can_manage_supplier(supplier_id)));
create policy sub_supplier_components_update on public.sub_supplier_components for update to authenticated
  using ((select public.can_manage_supplier(supplier_id)))
  with check ((select public.can_manage_supplier(supplier_id)));

-- -----------------------------------------------------------------------------
-- Qualificação inicial (interna)
-- -----------------------------------------------------------------------------
create table public.qualifications (
  id                 uuid primary key default gen_random_uuid(),
  supplier_id        uuid not null references public.suppliers (id),
  status             text not null default 'in_progress'
                       check (status in ('in_progress', 'approved', 'approved_conditional', 'rejected')),
  purchasing_contact text,
  final_opinion      text,
  concluded_on       date,
  constraint qualifications_conclusion_chk check (
    status = 'in_progress' or (concluded_on is not null and coalesce(length(btrim(final_opinion)), 0) > 0)
  )
);
select app.setup_business_table('public.qualifications');
create index qualifications_supplier_idx on public.qualifications (supplier_id, created_at desc);

create table public.qualification_steps (
  id               uuid primary key default gen_random_uuid(),
  qualification_id uuid not null references public.qualifications (id),
  supplier_id      uuid not null references public.suppliers (id),
  step_code        text not null references public.qualification_step_types (code),
  result           text not null default 'pending'
                     check (result in ('pending', 'approved', 'approved_conditional', 'rejected', 'not_applicable')),
  performed_on     date,
  score            numeric(5, 2),
  comments         text,
  unique (qualification_id, step_code)
);
select app.setup_business_table('public.qualification_steps');

create or replace function app.tg_qualification_create_steps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.qualification_steps (qualification_id, supplier_id, step_code, created_by)
  select new.id, new.supplier_id, t.code, new.created_by
    from public.qualification_step_types t
   where t.cancelled_at is null
   order by t.sort_order;
  return null;
end;
$$;
create trigger qualification_create_steps after insert on public.qualifications
  for each row execute function app.tg_qualification_create_steps();

alter table public.qualifications enable row level security;
create policy qualifications_select on public.qualifications for select to authenticated
  using ((select public.is_internal()));
create policy qualifications_insert on public.qualifications for insert to authenticated
  with check ((select public.can_manage_supplier(supplier_id)));
create policy qualifications_update on public.qualifications for update to authenticated
  using ((select public.can_manage_supplier(supplier_id)))
  with check ((select public.can_manage_supplier(supplier_id)));

alter table public.qualification_steps enable row level security;
create policy qualification_steps_select on public.qualification_steps for select to authenticated
  using ((select public.is_internal()));
create policy qualification_steps_update on public.qualification_steps for update to authenticated
  using ((select public.can_manage_supplier(supplier_id)))
  with check ((select public.can_manage_supplier(supplier_id)));

-- -----------------------------------------------------------------------------
-- Notificações in-app (o envio de e-mail vem na etapa 6)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.users (id),
  event_code    text not null,
  entity_table  text,
  entity_id     uuid,
  supplier_id   uuid references public.suppliers (id),
  params        jsonb not null default '{}',
  link_path     text,
  dedupe_key    text unique,
  read_at       timestamptz,
  email_sent_at timestamptz,
  created_at    timestamptz not null default now()
);
comment on table public.notifications is
  'Notificações por destinatário. Texto montado na interface a partir de event_code + params (PT/EN).';
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create trigger prevent_delete before delete on public.notifications
  for each row execute function app.tg_prevent_delete();

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function app.notify(
  p_recipient uuid,
  p_event text,
  p_entity_table text,
  p_entity_id uuid,
  p_supplier_id uuid,
  p_params jsonb,
  p_link text,
  p_dedupe text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications
    (recipient_id, event_code, entity_table, entity_id, supplier_id, params, link_path, dedupe_key)
  values
    (p_recipient, p_event, p_entity_table, p_entity_id, p_supplier_id, coalesce(p_params, '{}'), p_link, p_dedupe)
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Alertas de vencimento de certificados. Para cada certificado gera um alerta
-- por faixa (a mais urgente já atingida) e um alerta de vencido. Destinatários:
-- SQE responsável + usuários ativos do fornecedor. Idempotente (dedupe_key).
create or replace function app.generate_certificate_expiry_alerts(p_certification_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz        text := coalesce((select value #>> '{}' from public.app_settings where key = 'timezone' and cancelled_at is null),
                               'America/Sao_Paulo');
  v_today     date := (now() at time zone v_tz)::date;
  v_days      int[];
  v_max       int;
  v_total     int := 0;
  v_threshold int;
  v_event     text;
  r           record;
  v_recipient uuid;
begin
  select array_agg(d::int order by d::int desc) into v_days
    from public.app_settings s, jsonb_array_elements_text(s.value) d
   where s.key = 'certificate_alert_days' and s.cancelled_at is null;
  v_days := coalesce(v_days, array[60, 30, 7]);
  v_max := v_days[1];

  for r in
    select c.id, c.supplier_id, c.standard_name, c.certificate_number, c.valid_until,
           s.responsible_sqe_id, s.legal_name
      from public.certifications c
      join public.suppliers s on s.id = c.supplier_id
     where c.cancelled_at is null
       and s.cancelled_at is null
       and c.valid_until is not null
       and c.valid_until - v_today <= v_max
       and (p_certification_id is null or c.id = p_certification_id)
  loop
    if r.valid_until < v_today then
      v_event := 'certificate_expired';
      v_threshold := 0;
    else
      v_event := 'certificate_expiring';
      select min(d) into v_threshold from unnest(v_days) d where d >= r.valid_until - v_today;
    end if;

    for v_recipient in
      select r.responsible_sqe_id where r.responsible_sqe_id is not null
      union
      select u.id from public.users u
       where u.supplier_id = r.supplier_id and u.role = 'supplier' and u.cancelled_at is null
    loop
      v_total := v_total + app.notify(
        v_recipient, v_event, 'certifications', r.id, r.supplier_id,
        jsonb_build_object(
          'supplier', r.legal_name,
          'certificate', r.standard_name,
          'number', r.certificate_number,
          'validUntil', r.valid_until,
          'days', greatest(r.valid_until - v_today, 0),
          'threshold', v_threshold
        ),
        '/suppliers/' || r.supplier_id || '?tab=certifications',
        format('%s:%s:%s:%s:%s', v_event, r.id, r.valid_until, v_threshold, v_recipient)
      );
    end loop;
  end loop;
  return v_total;
end;
$$;

-- Ao cadastrar/alterar a validade, o alerta sai na hora; e o SQE é avisado
-- quando o próprio fornecedor atualiza um certificado (decisão: vale na hora).
create or replace function app.tg_certifications_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sqe uuid;
  v_name text;
begin
  if new.cancelled_at is null then
    perform app.generate_certificate_expiry_alerts(new.id);
  end if;

  if public.current_app_role() = 'supplier' then
    select s.responsible_sqe_id, s.legal_name into v_sqe, v_name from public.suppliers s where s.id = new.supplier_id;
    if v_sqe is not null then
      perform app.notify(
        v_sqe, 'certificate_updated_by_supplier', 'certifications', new.id, new.supplier_id,
        jsonb_build_object('supplier', v_name, 'certificate', new.standard_name, 'validUntil', new.valid_until),
        '/suppliers/' || new.supplier_id || '?tab=certifications'
      );
    end if;
  end if;
  return null;
end;
$$;
create trigger certifications_after_change after insert or update on public.certifications
  for each row execute function app.tg_certifications_after_change();

-- Anexos de registros internos são sempre internos, venha de onde vier a gravação.
create or replace function app.tg_attachments_force_internal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entity_table in ('qualifications', 'qualification_steps', 'standards', 'standard_requirements') then
    new.internal_only := true;
  end if;
  return new;
end;
$$;
create trigger attachments_force_internal before insert or update on public.attachments
  for each row execute function app.tg_attachments_force_internal();

-- Rotina diária (06:00 de Brasília = 09:00 UTC).
select cron.schedule('certificate-expiry-alerts', '0 9 * * *', $$select app.generate_certificate_expiry_alerts()$$);

revoke execute on all functions in schema app from public, anon, authenticated;

-- >>>>>>>>>> 20261024000300_nc_8d.sql
-- =============================================================================
-- SQM App — Etapa 3: M4 Não conformidades e 8D
-- Regras: 5 (sugestão de 8D), 6 (aprovação por D, reprovação com comentário e
-- nova versão), 7 (fechamento exige D7 PFMEA/PC, eficácia e lição aprendida),
-- 8 (prazos em dias corridos; "com o SQE" não conta contra o fornecedor),
-- 12 (custos: aceite/contestação), 16 (nada é apagado).
-- Fluxos (status, aprovação, fechamento, resposta de custo) só mudam por funções
-- com regras; UPDATE direto nessas colunas é bloqueado por trigger.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Listas configuráveis
-- -----------------------------------------------------------------------------
create table public.nc_origins (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.nc_origins');
insert into public.nc_origins (code, label_pt, label_en, sort_order, is_system) values
  ('audit',               'Auditoria',                 'Audit',                     10, true),
  ('supplier_inspection', 'Inspeção no fornecedor',    'Inspection at supplier',    20, true),
  ('receiving_plant',     'Recebimento / planta',      'Receiving / plant',         30, true),
  ('field_customer',      'Campo / cliente final',     'Field / end customer',      40, true),
  ('unnotified_change',   'Mudança não notificada',    'Unnotified change',         50, true);

create table public.nc_severities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  tone text not null default 'neutral' check (tone in ('neutral', 'success', 'warning', 'danger', 'info')),
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.nc_severities');
-- critical/major disparam a sugestão de 8D (regra 5).
insert into public.nc_severities (code, label_pt, label_en, tone, sort_order, is_system) values
  ('critical', 'Crítica', 'Critical', 'danger',  10, true),
  ('major',    'Maior',   'Major',    'warning', 20, true),
  ('minor',    'Menor',   'Minor',    'neutral', 30, true);

create table public.failure_modes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.failure_modes');
insert into public.failure_modes (code, label_pt, label_en, sort_order, is_system) values
  ('delamination',      'Delaminação',                 'Delamination',             10, false),
  ('porosity',          'Porosidade / vazios',         'Porosity / voids',         20, false),
  ('dimensional',       'Dimensional fora de especificação', 'Out-of-spec dimension', 30, false),
  ('surface_defect',    'Defeito superficial',         'Surface defect',           40, false),
  ('wrong_material',    'Material incorreto',          'Wrong material',           50, false),
  ('crack',             'Trinca',                      'Crack',                    60, false),
  ('documentation',     'Documentação incorreta/faltante', 'Wrong/missing documentation', 70, false),
  ('transport_damage',  'Dano de transporte',          'Transport damage',         80, false),
  ('other',             'Outro',                       'Other',                    999, true);

create table public.dispositions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.dispositions');
insert into public.dispositions (code, label_pt, label_en, sort_order, is_system) values
  ('rework',    'Retrabalho',                  'Rework',               10, true),
  ('repair',    'Reparo',                      'Repair',               20, true),
  ('scrap',     'Sucata',                      'Scrap',                30, true),
  ('return',    'Devolução',                   'Return to supplier',   40, true),
  ('use_as_is', 'Uso como está (concessão)',   'Use as is (waiver)',   50, true);

create table public.containment_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.containment_locations');
insert into public.containment_locations (code, label_pt, label_en, sort_order, is_system) values
  ('supplier', 'Fornecedor', 'Supplier',   10, true),
  ('transit',  'Trânsito',   'In transit', 20, true),
  ('gw_stock', 'Estoque GW', 'GW stock',   30, true),
  ('plant',    'Planta',     'Plant',      40, true),
  ('field',    'Campo',      'Field',      50, true);

create table public.cost_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.cost_types');
insert into public.cost_types (code, label_pt, label_en, sort_order, is_system) values
  ('tests',     'Testes / ensaios',  'Tests',        10, false),
  ('rework',    'Retrabalho',        'Rework',       20, false),
  ('hours',     'Horas de mão de obra', 'Labor hours', 30, false),
  ('freight',   'Frete',             'Freight',      40, false),
  ('line_stop', 'Parada de linha',   'Line stop',    50, false),
  ('other',     'Outros',            'Other',        999, true);

-- Disciplinas do 8D: nomes e prazo (horas corridas desde a abertura da NC).
create table public.eight_d_disciplines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^D[0-8]$'),
  label_pt text not null, label_en text not null,
  deadline_hours integer not null check (deadline_hours > 0),
  sort_order integer not null default 0, is_system boolean not null default true
);
select app.setup_lookup_table('public.eight_d_disciplines');
insert into public.eight_d_disciplines (code, label_pt, label_en, deadline_hours, sort_order) values
  ('D0', 'Preparação e ação emergencial',       'Preparation and emergency response', 48,  0),
  ('D1', 'Equipe',                              'Team',                                48,  1),
  ('D2', 'Descrição do problema',               'Problem description',                 48,  2),
  ('D3', 'Ações de contenção',                  'Containment actions',                 48,  3),
  ('D4', 'Causa raiz',                          'Root cause',                          240, 4),
  ('D5', 'Ações corretivas permanentes',        'Permanent corrective actions',        480, 5),
  ('D6', 'Implementação e validação',           'Implementation and validation',       480, 6),
  ('D7', 'Prevenção de reincidência',           'Prevent recurrence',                  720, 7),
  ('D8', 'Encerramento e reconhecimento',       'Closure and recognition',             720, 8);

insert into public.app_settings (key, value, description_pt, description_en) values
  ('deadline_warning_ratio', '0.25',
   'Fração do prazo restante a partir da qual o item aparece como "vencendo".',
   'Remaining fraction of a deadline from which an item shows as "due soon".'),
  ('simple_nc_response_days', '10',
   'Prazo (dias corridos) para o fornecedor responder uma NC simples.',
   'Deadline (calendar days) for the supplier to answer a simple NC.'),
  ('recurrence_window_days', '365',
   'Janela para detectar reincidência do mesmo modo de falha no mesmo PN (regra 5).',
   'Window to detect recurrence of the same failure mode on the same part (rule 5).');

-- -----------------------------------------------------------------------------
-- NC
-- -----------------------------------------------------------------------------
create table public.nc_counters (
  year integer primary key,
  last_number integer not null default 0
);
alter table public.nc_counters enable row level security;  -- sem políticas: só funções

create table public.ncs (
  id                  uuid primary key default gen_random_uuid(),
  number              text not null unique,
  supplier_id         uuid not null references public.suppliers (id),
  component_id        uuid references public.components (id),
  finding_id          uuid,  -- FK para findings na etapa 4
  type                text not null check (type in ('simple', '8d')),
  status              text not null default 'open'
                        check (status in ('open', 'awaiting_sqe', 'effectiveness_check', 'closed')),
  origin_code         text not null references public.nc_origins (code),
  severity_code       text not null references public.nc_severities (code),
  failure_mode_code   text references public.failure_modes (code),
  title               text not null check (length(btrim(title)) > 0),
  description         text not null check (length(btrim(description)) > 0),
  detected_on         date not null default current_date,
  detected_location   text,
  quantity_affected   numeric(12, 2),
  customer_affected   boolean not null default false,
  suggested_8d        boolean not null default false,
  suggestion_reasons  text[] not null default '{}',
  opened_at           timestamptz not null default now(),
  response_due_at     timestamptz,
  -- NC simples
  disposition_code    text references public.dispositions (code),
  disposition_notes   text,
  supplier_action     text,
  supplier_responded_at timestamptz,
  sqe_review_comment  text,
  -- Eficácia (8D) e fechamento
  effectiveness_method   text check (effectiveness_method in ('time', 'quantity')),
  effectiveness_target   text,
  effectiveness_result   text,
  effectiveness_verified boolean not null default false,
  effectiveness_verified_at timestamptz,
  effectiveness_verified_by uuid references auth.users (id),
  closure_comment     text,
  closed_at           timestamptz,
  closed_by           uuid references auth.users (id)
);
select app.setup_business_table('public.ncs');
create index ncs_supplier_idx on public.ncs (supplier_id, created_at desc);
create index ncs_component_failure_idx on public.ncs (component_id, failure_mode_code, opened_at desc);
create index ncs_status_idx on public.ncs (status) where cancelled_at is null;

create table public.nc_items (
  id          uuid primary key default gen_random_uuid(),
  nc_id       uuid not null references public.ncs (id),
  supplier_id uuid not null references public.suppliers (id),
  sn_or_lot   text not null check (length(btrim(sn_or_lot)) > 0),
  quantity    numeric(12, 2),
  notes       text
);
select app.setup_business_table('public.nc_items');
create index nc_items_nc_idx on public.nc_items (nc_id);

-- -----------------------------------------------------------------------------
-- 8D: estado atual por disciplina + versões imutáveis de cada envio
-- -----------------------------------------------------------------------------
create table public.eight_d_steps (
  id              uuid primary key default gen_random_uuid(),
  nc_id           uuid not null references public.ncs (id),
  supplier_id     uuid not null references public.suppliers (id),
  discipline      text not null references public.eight_d_disciplines (code),
  status          text not null default 'not_started'
                    check (status in ('not_started', 'draft', 'submitted', 'approved', 'rejected')),
  content         jsonb not null default '{}',
  current_version integer not null default 0,
  due_at          timestamptz not null,
  submitted_at    timestamptz,
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users (id),
  review_comment  text,
  unique (nc_id, discipline)
);
select app.setup_business_table('public.eight_d_steps');

create table public.eight_d_step_versions (
  id             uuid primary key default gen_random_uuid(),
  step_id        uuid not null references public.eight_d_steps (id),
  nc_id          uuid not null references public.ncs (id),
  supplier_id    uuid not null references public.suppliers (id),
  discipline     text not null,
  version        integer not null,
  content        jsonb not null,
  submitted_by   uuid references auth.users (id),
  submitted_at   timestamptz not null default now(),
  decision       text check (decision in ('approved', 'rejected')),
  review_comment text,
  reviewed_by    uuid references auth.users (id),
  reviewed_at    timestamptz,
  unique (step_id, version),
  constraint versions_reject_comment_chk check (
    decision is distinct from 'rejected' or coalesce(length(btrim(review_comment)), 0) >= 3
  )
);
select app.setup_business_table('public.eight_d_step_versions');

-- D3: contenção por local e SN/lote
create table public.containment_actions (
  id            uuid primary key default gen_random_uuid(),
  nc_id         uuid not null references public.ncs (id),
  supplier_id   uuid not null references public.suppliers (id),
  location_code text not null references public.containment_locations (code),
  sn_or_lot     text,
  qty_checked   numeric(12, 2) not null default 0 check (qty_checked >= 0),
  qty_ok        numeric(12, 2) not null default 0 check (qty_ok >= 0),
  qty_nok       numeric(12, 2) not null default 0 check (qty_nok >= 0),
  action_taken  text,
  responsible   text,
  done_on       date,
  constraint containment_qty_chk check (qty_ok + qty_nok <= qty_checked)
);
select app.setup_business_table('public.containment_actions');
create index containment_nc_idx on public.containment_actions (nc_id);

-- D4: ferramentas de análise de causa raiz (conteúdo JSON)
create table public.rca_tools (
  id              uuid primary key default gen_random_uuid(),
  eight_d_step_id uuid not null references public.eight_d_steps (id),
  nc_id           uuid not null references public.ncs (id),
  supplier_id     uuid not null references public.suppliers (id),
  tool_type       text not null check (tool_type in ('ishikawa', '5why_3legs', 'is_isnot')),
  content         jsonb not null default '{}'
);
select app.setup_business_table('public.rca_tools');
create unique index rca_tools_key on public.rca_tools (nc_id, tool_type) where cancelled_at is null;

-- -----------------------------------------------------------------------------
-- Custos, comentários, lições aprendidas
-- -----------------------------------------------------------------------------
create table public.nc_costs (
  id                   uuid primary key default gen_random_uuid(),
  nc_id                uuid not null references public.ncs (id),
  supplier_id          uuid not null references public.suppliers (id),
  cost_type_code       text not null references public.cost_types (code),
  description          text not null,
  quantity             numeric(12, 2) not null default 1 check (quantity > 0),
  unit_amount          numeric(14, 2) not null check (unit_amount >= 0),
  amount               numeric(14, 2) generated always as (round(quantity * unit_amount, 2)) stored,
  currency             char(3) not null default 'BRL',
  chargeable           boolean not null default true,
  status               text not null default 'launched'
                         check (status in ('launched', 'accepted', 'contested', 'debited')),
  supplier_response    text,
  responded_at         timestamptz,
  responded_by         uuid references auth.users (id),
  sqe_decision_comment text
);
comment on column public.nc_costs.chargeable is
  'false = custo interno (não cobrado): nunca visível ao fornecedor (regra 1).';
select app.setup_business_table('public.nc_costs');
create index nc_costs_nc_idx on public.nc_costs (nc_id);

create table public.nc_comments (
  id          uuid primary key default gen_random_uuid(),
  nc_id       uuid not null references public.ncs (id),
  supplier_id uuid not null references public.suppliers (id),
  body        text not null check (length(btrim(body)) > 0),
  internal    boolean not null default false
);
select app.setup_business_table('public.nc_comments');
create index nc_comments_nc_idx on public.nc_comments (nc_id, created_at);

create table public.lessons_learned (
  id                uuid primary key default gen_random_uuid(),
  nc_id             uuid not null references public.ncs (id),
  supplier_id       uuid not null references public.suppliers (id),
  component_id      uuid references public.components (id),
  failure_mode_code text references public.failure_modes (code),
  failure           text not null check (length(btrim(failure)) > 0),
  root_cause        text not null check (length(btrim(root_cause)) > 0),
  action            text not null check (length(btrim(action)) > 0),
  keywords          text[] not null default '{}'
);
select app.setup_business_table('public.lessons_learned');
create index lessons_learned_component_idx on public.lessons_learned (component_id);

-- -----------------------------------------------------------------------------
-- Funções auxiliares
-- -----------------------------------------------------------------------------
create or replace function app.setting_numeric(p_key text, p_default numeric)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::numeric from public.app_settings where key = p_key and cancelled_at is null), p_default)
$$;

-- Regra 5: sugere 8D para severidade crítica/maior, reincidência do mesmo modo
-- de falha no mesmo PN dentro da janela, ou cliente final afetado.
create or replace function app.compute_8d_suggestion(
  p_severity text,
  p_customer_affected boolean,
  p_component_id uuid,
  p_failure_mode text,
  p_exclude_nc uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reasons text[] := '{}';
  v_previous jsonb := '[]';
  v_window int := app.setting_numeric('recurrence_window_days', 365)::int;
begin
  if p_severity in ('critical', 'major') then
    v_reasons := array_append(v_reasons, 'severity');
  end if;
  if p_customer_affected then
    v_reasons := array_append(v_reasons, 'customer_affected');
  end if;
  if p_component_id is not null and p_failure_mode is not null and p_failure_mode <> 'other' then
    select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'number', n.number) order by n.opened_at desc), '[]')
      into v_previous
      from public.ncs n
     where n.component_id = p_component_id
       and n.failure_mode_code = p_failure_mode
       and n.cancelled_at is null
       and n.opened_at >= now() - make_interval(days => v_window)
       and (p_exclude_nc is null or n.id <> p_exclude_nc);
    if jsonb_array_length(v_previous) > 0 then
      v_reasons := array_append(v_reasons, 'recurrence');
    end if;
  end if;
  return jsonb_build_object('suggest', cardinality(v_reasons) > 0, 'reasons', to_jsonb(v_reasons), 'previous', v_previous);
end;
$$;

-- Versão chamável pela tela de abertura (só internos).
create or replace function public.suggest_8d(
  p_severity text,
  p_customer_affected boolean,
  p_component_id uuid,
  p_failure_mode text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_internal() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return app.compute_8d_suggestion(p_severity, p_customer_affected, p_component_id, p_failure_mode);
end;
$$;

-- Destinatários padrão
create or replace function app.supplier_user_ids(p_supplier_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public.users u
   where u.supplier_id = p_supplier_id and u.role = 'supplier' and u.cancelled_at is null
$$;

create or replace function app.notify_nc(p_nc_id uuid, p_to text, p_event text, p_extra jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
  v_recipient uuid;
begin
  select x.id, x.number, x.title, x.supplier_id, s.legal_name, s.responsible_sqe_id
    into n
    from public.ncs x join public.suppliers s on s.id = x.supplier_id
   where x.id = p_nc_id;
  for v_recipient in
    select r from (
      select app.supplier_user_ids(n.supplier_id) as r where p_to = 'supplier'
      union
      select n.responsible_sqe_id where p_to = 'sqe' and n.responsible_sqe_id is not null
    ) q
  loop
    perform app.notify(
      v_recipient, p_event, 'ncs', n.id, n.supplier_id,
      jsonb_build_object('number', n.number, 'title', n.title, 'supplier', n.legal_name) || coalesce(p_extra, '{}'),
      '/ncs/' || n.id
    );
  end loop;
end;
$$;

create or replace function app.create_8d_steps(p_nc_id uuid, p_from timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.eight_d_steps (nc_id, supplier_id, discipline, due_at, created_by)
  select n.id, n.supplier_id, d.code, p_from + make_interval(hours => d.deadline_hours), n.created_by
    from public.ncs n cross join public.eight_d_disciplines d
   where n.id = p_nc_id
  on conflict (nc_id, discipline) do nothing
$$;

-- -----------------------------------------------------------------------------
-- Triggers da NC
-- -----------------------------------------------------------------------------
create or replace function app.tg_ncs_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int;
  v_seq int;
  v_suggestion jsonb;
begin
  if tg_op = 'INSERT' then
    v_year := extract(year from now() at time zone 'America/Sao_Paulo');
    insert into public.nc_counters (year, last_number) values (v_year, 1)
      on conflict (year) do update set last_number = public.nc_counters.last_number + 1
      returning last_number into v_seq;
    new.number := format('NC-%s-%s', v_year, lpad(v_seq::text, 4, '0'));
    new.opened_at := now();
    new.status := 'open';
    new.closed_at := null;
    new.closed_by := null;
    new.effectiveness_verified := false;
    if new.type = 'simple' then
      new.response_due_at := now() + make_interval(days => app.setting_numeric('simple_nc_response_days', 10)::int);
    end if;

    -- Regra 5: registra a sugestão calculada no momento da abertura.
    v_suggestion := app.compute_8d_suggestion(new.severity_code, new.customer_affected, new.component_id, new.failure_mode_code);
    new.suggested_8d := (v_suggestion ->> 'suggest')::boolean;
    select coalesce(array_agg(r), '{}') into new.suggestion_reasons
      from jsonb_array_elements_text(v_suggestion -> 'reasons') r;
    return new;
  end if;

  -- Colunas de fluxo só mudam pelas funções de workflow.
  if coalesce(current_setting('app.nc_workflow', true), 'off') <> 'on' then
    if new.status is distinct from old.status
       or new.type is distinct from old.type
       or new.closed_at is distinct from old.closed_at
       or new.supplier_action is distinct from old.supplier_action
       or new.supplier_id is distinct from old.supplier_id
       or new.number is distinct from old.number then
      raise exception 'nc_workflow_only' using errcode = 'P0001';
    end if;
  end if;
  if old.status = 'closed' and new.cancelled_at is null
     and coalesce(current_setting('app.nc_workflow', true), 'off') <> 'on' then
    raise exception 'nc_closed' using errcode = 'P0001';
  end if;

  -- Eficácia: quem e quando verificou.
  if new.effectiveness_verified and not old.effectiveness_verified then
    new.effectiveness_verified_at := now();
    new.effectiveness_verified_by := auth.uid();
  elsif not new.effectiveness_verified then
    new.effectiveness_verified_at := null;
    new.effectiveness_verified_by := null;
  end if;
  return new;
end;
$$;
create trigger ncs_before before insert or update on public.ncs
  for each row execute function app.tg_ncs_before();

create or replace function app.tg_ncs_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = '8d' then
    perform app.create_8d_steps(new.id, new.opened_at);
  end if;
  perform app.notify_nc(new.id, 'supplier', 'nc_opened', jsonb_build_object('type', new.type));
  return null;
end;
$$;
create trigger ncs_after_insert after insert on public.ncs
  for each row execute function app.tg_ncs_after_insert();

-- -----------------------------------------------------------------------------
-- Workflow: 8D
-- -----------------------------------------------------------------------------
create or replace function app.discipline_order(p_code text)
returns int
language sql
immutable
set search_path = ''
as $$ select substr(p_code, 2)::int $$;

-- Fornecedor salva rascunho ou envia uma D. Envio gera nova versão (regra 6).
create or replace function public.save_8d_step(p_step_id uuid, p_content jsonb, p_submit boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.eight_d_steps;
  n public.ncs;
  v_snapshot jsonb := coalesce(p_content, '{}');
begin
  select * into s from public.eight_d_steps where id = p_step_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into n from public.ncs where id = s.nc_id;

  if public.current_supplier_id() is distinct from s.supplier_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if n.cancelled_at is not null or n.status = 'closed' then
    raise exception 'nc_closed' using errcode = 'P0001';
  end if;
  if s.status not in ('not_started', 'draft', 'rejected') then
    raise exception 'step_locked' using errcode = 'P0001';
  end if;

  if p_submit then
    -- Regra 7 já no envio da D7: revisão de PFMEA e Plano de Controle, ou justificativa.
    if s.discipline = 'D7' and not (
      (coalesce(btrim(p_content ->> 'pfmea_revision'), '') <> '' and coalesce(btrim(p_content ->> 'control_plan_revision'), '') <> '')
      or coalesce(length(btrim(p_content ->> 'no_change_justification')), 0) >= 10
    ) then
      raise exception 'd7_requires_pfmea_cp' using errcode = '23514';
    end if;
    -- A versão guarda também as linhas de contenção (D3) e as ferramentas de RCA (D4).
    if s.discipline = 'D3' then
      v_snapshot := v_snapshot || jsonb_build_object('containment', coalesce((
        select jsonb_agg(to_jsonb(c) - array['created_by', 'updated_by', 'cancelled_by'] order by c.created_at)
          from public.containment_actions c where c.nc_id = s.nc_id and c.cancelled_at is null), '[]'));
    elsif s.discipline = 'D4' then
      v_snapshot := v_snapshot || jsonb_build_object('rca_tools', coalesce((
        select jsonb_object_agg(r.tool_type, r.content)
          from public.rca_tools r where r.nc_id = s.nc_id and r.cancelled_at is null), '{}'));
    end if;

    update public.eight_d_steps
       set content = coalesce(p_content, '{}'), status = 'submitted', current_version = s.current_version + 1,
           submitted_at = now(), review_comment = null
     where id = s.id;
    insert into public.eight_d_step_versions (step_id, nc_id, supplier_id, discipline, version, content, submitted_by, created_by)
    values (s.id, s.nc_id, s.supplier_id, s.discipline, s.current_version + 1, v_snapshot, auth.uid(), auth.uid());
    perform app.notify_nc(s.nc_id, 'sqe', 'eight_d_submitted', jsonb_build_object('discipline', s.discipline));
  else
    update public.eight_d_steps
       set content = coalesce(p_content, '{}'),
           status = case when s.status = 'rejected' then 'rejected' else 'draft' end
     where id = s.id;
  end if;
end;
$$;

-- SQE aprova ou reprova. Reprovação exige comentário; aprovação só em ordem.
create or replace function public.review_8d_step(p_step_id uuid, p_approve boolean, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.eight_d_steps;
  v_pending int;
begin
  select * into s from public.eight_d_steps where id = p_step_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_manage_supplier(s.supplier_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if s.status <> 'submitted' then
    raise exception 'step_not_submitted' using errcode = 'P0001';
  end if;

  if p_approve then
    if exists (
      select 1 from public.eight_d_steps p
       where p.nc_id = s.nc_id and app.discipline_order(p.discipline) < app.discipline_order(s.discipline)
         and p.status <> 'approved'
    ) then
      raise exception 'previous_discipline_not_approved' using errcode = 'P0001';
    end if;
  elsif coalesce(length(btrim(p_comment)), 0) < 3 then
    raise exception 'rejection_comment_required' using errcode = '23514';
  end if;

  update public.eight_d_steps
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_at = now(), reviewed_by = auth.uid(), review_comment = nullif(btrim(p_comment), '')
   where id = s.id;
  update public.eight_d_step_versions
     set decision = case when p_approve then 'approved' else 'rejected' end,
         review_comment = nullif(btrim(p_comment), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where step_id = s.id and version = s.current_version;

  perform app.notify_nc(s.nc_id, 'supplier', case when p_approve then 'eight_d_approved' else 'eight_d_rejected' end,
                        jsonb_build_object('discipline', s.discipline));

  select count(*) into v_pending from public.eight_d_steps where nc_id = s.nc_id and status <> 'approved';
  if v_pending = 0 then
    perform set_config('app.nc_workflow', 'on', true);
    update public.ncs set status = 'effectiveness_check' where id = s.nc_id and status = 'open';
    perform set_config('app.nc_workflow', 'off', true);
  end if;
end;
$$;

-- Regra 7: fecha o 8D só com D7 (PFMEA/PC ou justificativa), eficácia
-- verificada e registro em lições aprendidas (criado aqui).
create or replace function public.close_8d(
  p_nc_id uuid,
  p_failure text,
  p_root_cause text,
  p_action text,
  p_keywords text[],
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.ncs;
  d7 jsonb;
  v_lesson uuid;
begin
  select * into n from public.ncs where id = p_nc_id for update;
  if not found or n.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_manage_supplier(n.supplier_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if n.type <> '8d' then raise exception 'not_8d' using errcode = 'P0001'; end if;
  if n.status = 'closed' then raise exception 'nc_closed' using errcode = 'P0001'; end if;
  if exists (select 1 from public.eight_d_steps where nc_id = n.id and status <> 'approved') then
    raise exception 'all_disciplines_must_be_approved' using errcode = 'P0001';
  end if;

  select content into d7 from public.eight_d_steps where nc_id = n.id and discipline = 'D7';
  if not (
    (coalesce(btrim(d7 ->> 'pfmea_revision'), '') <> '' and coalesce(btrim(d7 ->> 'control_plan_revision'), '') <> '')
    or coalesce(length(btrim(d7 ->> 'no_change_justification')), 0) >= 10
  ) then
    raise exception 'd7_requires_pfmea_cp' using errcode = '23514';
  end if;
  if not n.effectiveness_verified then
    raise exception 'effectiveness_not_verified' using errcode = '23514';
  end if;
  if coalesce(btrim(p_failure), '') = '' or coalesce(btrim(p_root_cause), '') = '' or coalesce(btrim(p_action), '') = '' then
    raise exception 'lesson_learned_required' using errcode = '23514';
  end if;

  insert into public.lessons_learned (nc_id, supplier_id, component_id, failure_mode_code, failure, root_cause, action, keywords, created_by)
  values (n.id, n.supplier_id, n.component_id, n.failure_mode_code, btrim(p_failure), btrim(p_root_cause), btrim(p_action),
          coalesce(p_keywords, '{}'), auth.uid())
  returning id into v_lesson;

  perform set_config('app.nc_workflow', 'on', true);
  update public.ncs set status = 'closed', closed_at = now(), closed_by = auth.uid(), closure_comment = nullif(btrim(p_comment), '')
   where id = n.id;
  perform set_config('app.nc_workflow', 'off', true);
  perform app.notify_nc(n.id, 'supplier', 'nc_closed');
  return v_lesson;
end;
$$;

-- SQE converte NC simples aberta em 8D (prazos contam a partir da conversão).
create or replace function public.convert_nc_to_8d(p_nc_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.ncs;
begin
  select * into n from public.ncs where id = p_nc_id for update;
  if not found or n.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_manage_supplier(n.supplier_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if n.type <> 'simple' or n.status = 'closed' then raise exception 'cannot_convert' using errcode = 'P0001'; end if;
  perform set_config('app.nc_workflow', 'on', true);
  update public.ncs set type = '8d', status = 'open', response_due_at = null where id = n.id;
  perform set_config('app.nc_workflow', 'off', true);
  perform app.create_8d_steps(n.id, now());
  perform app.notify_nc(n.id, 'supplier', 'nc_converted_8d');
end;
$$;

-- -----------------------------------------------------------------------------
-- Workflow: NC simples
-- -----------------------------------------------------------------------------
create or replace function public.respond_simple_nc(p_nc_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.ncs;
begin
  select * into n from public.ncs where id = p_nc_id for update;
  if not found or n.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.current_supplier_id() is distinct from n.supplier_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if n.type <> 'simple' or n.status <> 'open' then raise exception 'step_locked' using errcode = 'P0001'; end if;
  if coalesce(length(btrim(p_action)), 0) < 5 then raise exception 'action_required' using errcode = '23514'; end if;
  perform set_config('app.nc_workflow', 'on', true);
  update public.ncs set supplier_action = btrim(p_action), supplier_responded_at = now(), status = 'awaiting_sqe'
   where id = n.id;
  perform set_config('app.nc_workflow', 'off', true);
  perform app.notify_nc(n.id, 'sqe', 'simple_nc_responded');
end;
$$;

create or replace function public.review_simple_nc(p_nc_id uuid, p_accept boolean, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.ncs;
begin
  select * into n from public.ncs where id = p_nc_id for update;
  if not found or n.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_manage_supplier(n.supplier_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if n.type <> 'simple' or n.status <> 'awaiting_sqe' then raise exception 'step_not_submitted' using errcode = 'P0001'; end if;
  if not p_accept and coalesce(length(btrim(p_comment)), 0) < 3 then
    raise exception 'rejection_comment_required' using errcode = '23514';
  end if;
  perform set_config('app.nc_workflow', 'on', true);
  if p_accept then
    update public.ncs set status = 'closed', closed_at = now(), closed_by = auth.uid(),
                          sqe_review_comment = nullif(btrim(p_comment), ''), closure_comment = nullif(btrim(p_comment), '')
     where id = n.id;
  else
    update public.ncs set status = 'open', sqe_review_comment = btrim(p_comment) where id = n.id;
  end if;
  perform set_config('app.nc_workflow', 'off', true);
  perform app.notify_nc(n.id, 'supplier', case when p_accept then 'nc_closed' else 'simple_nc_returned' end);
end;
$$;

-- -----------------------------------------------------------------------------
-- Custos (regras 1 e 12)
-- -----------------------------------------------------------------------------
create or replace function app.tg_nc_costs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow boolean := coalesce(current_setting('app.nc_workflow', true), 'off') = 'on';
begin
  if tg_op = 'INSERT' then
    new.status := 'launched';
    new.supplier_response := null;
    new.responded_at := null;
    new.responded_by := null;
    return new;
  end if;
  -- Aceite/contestação só pelo fornecedor (função respond_nc_cost).
  if new.status in ('accepted', 'contested') and new.status is distinct from old.status and not v_workflow then
    raise exception 'cost_response_only_by_supplier' using errcode = 'P0001';
  end if;
  if not v_workflow and (new.supplier_response is distinct from old.supplier_response
                         or new.responded_at is distinct from old.responded_at) then
    raise exception 'cost_response_only_by_supplier' using errcode = 'P0001';
  end if;
  -- SQE revisou valor/descrição de um custo contestado → volta para o fornecedor.
  if not v_workflow and old.status = 'contested' and new.status = 'contested'
     and (new.unit_amount, new.quantity, new.description) is distinct from (old.unit_amount, old.quantity, old.description) then
    new.status := 'launched';
  end if;
  if new.status = 'debited' and old.status = 'launched' then
    raise exception 'cost_not_accepted' using errcode = 'P0001';
  end if;
  if new.status = 'debited' and old.status = 'contested' and coalesce(length(btrim(new.sqe_decision_comment)), 0) < 3 then
    raise exception 'decision_comment_required' using errcode = '23514';
  end if;
  if old.status = 'debited' and new.cancelled_at is null then
    raise exception 'cost_debited_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger nc_costs_guard before insert or update on public.nc_costs
  for each row execute function app.tg_nc_costs_guard();

create or replace function app.tg_nc_costs_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.chargeable and new.cancelled_at is null and new.status = 'launched'
     and (tg_op = 'INSERT' or old.status is distinct from 'launched') then
    perform app.notify_nc(new.nc_id, 'supplier', 'nc_cost_launched',
      jsonb_build_object('amount', new.amount, 'currency', new.currency, 'description', new.description));
  end if;
  return null;
end;
$$;
create trigger nc_costs_notify after insert or update on public.nc_costs
  for each row execute function app.tg_nc_costs_notify();

create or replace function public.respond_nc_cost(p_cost_id uuid, p_accept boolean, p_justification text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.nc_costs;
begin
  select * into c from public.nc_costs where id = p_cost_id for update;
  if not found or c.cancelled_at is not null or not c.chargeable then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.current_supplier_id() is distinct from c.supplier_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if c.status <> 'launched' then raise exception 'cost_already_answered' using errcode = 'P0001'; end if;
  if not p_accept and coalesce(length(btrim(p_justification)), 0) < 5 then
    raise exception 'justification_required' using errcode = '23514';
  end if;
  perform set_config('app.nc_workflow', 'on', true);
  update public.nc_costs
     set status = case when p_accept then 'accepted' else 'contested' end,
         supplier_response = nullif(btrim(p_justification), ''), responded_at = now(), responded_by = auth.uid()
   where id = c.id;
  perform set_config('app.nc_workflow', 'off', true);
  perform app.notify_nc(c.nc_id, 'sqe', case when p_accept then 'nc_cost_accepted' else 'nc_cost_contested' end,
    jsonb_build_object('amount', c.amount, 'currency', c.currency, 'description', c.description));
end;
$$;

-- -----------------------------------------------------------------------------
-- Contenção e RCA: editáveis só enquanto a D correspondente está aberta
-- -----------------------------------------------------------------------------
create or replace function app.tg_step_content_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discipline text := case tg_table_name when 'containment_actions' then 'D3' else 'D4' end;
  v_status text;
begin
  select status into v_status from public.eight_d_steps where nc_id = new.nc_id and discipline = v_discipline;
  if v_status is null then
    raise exception 'not_8d' using errcode = 'P0001';
  end if;
  if v_status in ('submitted', 'approved') then
    raise exception 'step_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger containment_lock before insert or update on public.containment_actions
  for each row execute function app.tg_step_content_lock();
create trigger rca_tools_lock before insert or update on public.rca_tools
  for each row execute function app.tg_step_content_lock();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.ncs enable row level security;
create policy ncs_select on public.ncs for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
create policy ncs_insert on public.ncs for insert to authenticated
  with check ((select public.is_internal()) and (select public.can_manage_supplier(supplier_id)));
create policy ncs_update on public.ncs for update to authenticated
  using ((select public.can_manage_supplier(supplier_id)))
  with check ((select public.can_manage_supplier(supplier_id)));

alter table public.nc_items enable row level security;
create policy nc_items_select on public.nc_items for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
create policy nc_items_insert on public.nc_items for insert to authenticated
  with check ((select public.can_manage_supplier(supplier_id)));
create policy nc_items_update on public.nc_items for update to authenticated
  using ((select public.can_manage_supplier(supplier_id))) with check ((select public.can_manage_supplier(supplier_id)));

-- 8D: leitura pela RLS; escrita só pelas funções de workflow.
alter table public.eight_d_steps enable row level security;
create policy eight_d_steps_select on public.eight_d_steps for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
revoke insert, update on public.eight_d_steps from anon, authenticated;

alter table public.eight_d_step_versions enable row level security;
create policy eight_d_versions_select on public.eight_d_step_versions for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
revoke insert, update on public.eight_d_step_versions from anon, authenticated;

-- Contenção e RCA: fornecedor dono e SQE responsável escrevem (trava pela D).
select app.apply_default_supplier_policies('public.containment_actions');
select app.apply_default_supplier_policies('public.rca_tools');

-- Custos: fornecedor só vê os cobráveis da própria NC (regra 1); escrita interna.
alter table public.nc_costs enable row level security;
create policy nc_costs_select on public.nc_costs for select to authenticated
  using (
    (select public.is_internal())
    or (supplier_id = (select public.current_supplier_id()) and chargeable)
  );
create policy nc_costs_insert on public.nc_costs for insert to authenticated
  with check ((select public.can_manage_supplier(supplier_id)));
create policy nc_costs_update on public.nc_costs for update to authenticated
  using ((select public.can_manage_supplier(supplier_id))) with check ((select public.can_manage_supplier(supplier_id)));

-- Comentários: internos nunca visíveis ao fornecedor (regra 1).
alter table public.nc_comments enable row level security;
create policy nc_comments_select on public.nc_comments for select to authenticated
  using (
    (select public.is_internal())
    or (supplier_id = (select public.current_supplier_id()) and not internal)
  );
create policy nc_comments_insert on public.nc_comments for insert to authenticated
  with check (
    (select public.is_internal())
    or (supplier_id = (select public.current_supplier_id()) and not internal)
  );
revoke update on public.nc_comments from anon, authenticated;
grant update (cancelled_at, cancel_reason) on public.nc_comments to authenticated;
create policy nc_comments_update on public.nc_comments for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

-- Lições aprendidas: base interna; criadas no fechamento do 8D.
alter table public.lessons_learned enable row level security;
create policy lessons_learned_select on public.lessons_learned for select to authenticated
  using ((select public.is_internal()));
create policy lessons_learned_update on public.lessons_learned for update to authenticated
  using ((select public.is_internal())) with check ((select public.is_internal()));
revoke insert on public.lessons_learned from anon, authenticated;

-- Garante que comentário de NC pertence ao mesmo fornecedor da NC (e itens/custos).
create or replace function app.tg_nc_child_supplier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select supplier_id into new.supplier_id from public.ncs where id = new.nc_id;
  if new.supplier_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
create trigger nc_items_supplier before insert on public.nc_items for each row execute function app.tg_nc_child_supplier();
create trigger nc_costs_supplier before insert on public.nc_costs for each row execute function app.tg_nc_child_supplier();
create trigger nc_comments_supplier before insert on public.nc_comments for each row execute function app.tg_nc_child_supplier();
create trigger containment_supplier before insert on public.containment_actions for each row execute function app.tg_nc_child_supplier();
create trigger rca_tools_supplier before insert on public.rca_tools for each row execute function app.tg_nc_child_supplier();

-- -----------------------------------------------------------------------------
-- Visão para listas: próximo prazo e com quem está a pendência (regra 8)
-- -----------------------------------------------------------------------------
create or replace view public.nc_overview
with (security_invoker = true)
as
select
  n.id, n.number, n.title, n.type, n.status, n.supplier_id, n.component_id, n.origin_code, n.severity_code,
  n.failure_mode_code, n.opened_at, n.closed_at, n.cancelled_at, n.suggested_8d,
  s.legal_name as supplier_name,
  c.gw_code,
  case
    when n.status = 'closed' then null
    when n.type = 'simple' and n.status = 'open' then n.response_due_at
    when n.type = '8d' then (
      select min(st.due_at) from public.eight_d_steps st
       where st.nc_id = n.id and st.status in ('not_started', 'draft', 'rejected'))
  end as next_due_at,
  case
    when n.status = 'closed' then null
    when n.type = 'simple' then case n.status when 'open' then 'supplier' when 'awaiting_sqe' then 'sqe' end
    when n.status = 'effectiveness_check' then 'sqe'
    when exists (select 1 from public.eight_d_steps st where st.nc_id = n.id and st.status = 'submitted') then 'sqe'
    else 'supplier'
  end as pending_with,
  (select count(*) from public.eight_d_steps st where st.nc_id = n.id and st.status = 'approved')::int as approved_steps
from public.ncs n
join public.suppliers s on s.id = n.supplier_id
left join public.components c on c.id = n.component_id;

grant select on public.nc_overview to authenticated;

revoke execute on all functions in schema app from public, anon, authenticated;

-- >>>>>>>>>> 20261024000400_audits.sql
-- =============================================================================
-- SQM App — Etapa 4: M2 Auditorias
-- Regras: 3 (classificação sugere mudança de status; SQE confirma),
-- 4 (achado NC maior abre NC 8D vinculada), 11 (achado só fecha com eficácia
-- verificada pelo SQE), 14 (plano anual só vale depois de aprovado pelo SQM).
-- Cálculo de nota/classificação fica no banco (fonte única): VDA 6.3 e GWI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Listas configuráveis
-- -----------------------------------------------------------------------------
create table public.audit_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.audit_types');
insert into public.audit_types (code, label_pt, label_en, sort_order, is_system) values
  ('potential',           'Potencial',                    'Potential',              10, true),
  ('system',              'Sistema',                      'System',                 20, true),
  ('process',             'Processo (anual GWI)',         'Process (GWI annual)',   30, true),
  ('product',             'Produto',                      'Product',                40, true),
  ('extraordinary',       'Extraordinária',               'Extraordinary',          50, true),
  ('follow_up',           'Follow-up',                    'Follow-up',              60, true),
  ('remote_document',     'Documental remota',            'Remote document review', 70, true),
  ('controlled_shipment', 'Embarque controlado',          'Controlled shipment',    80, true);

create table public.audit_scopes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.audit_scopes');
insert into public.audit_scopes (code, label_pt, label_en, sort_order) values
  ('management',       'Gestão e sistema da qualidade', 'Management and QMS',       10),
  ('raw_material',     'Recebimento de matéria-prima',  'Raw material receiving',   20),
  ('infusion',         'Infusão / laminação',           'Infusion / lamination',    30),
  ('machining',        'Usinagem',                      'Machining',                40),
  ('repairs',          'Reparos',                       'Repairs',                  50),
  ('final_inspection', 'Inspeção final',                'Final inspection',         60),
  ('shipping',         'Expedição e embalagem',         'Shipping and packaging',   70);

insert into public.app_settings (key, value, description_pt, description_en) values
  ('audit_frequency_months', '{"A": 12, "B": 24, "C": 36}',
   'Frequência da auditoria de processo por criticidade (meses), usada para gerar o plano anual.',
   'Process audit frequency by criticality (months), used to generate the annual plan.'),
  ('vda_rules', '{"a_min": 90, "b_min": 80, "element_to_b": 80, "element_to_c": 70, "star4_to_b": true, "any0_to_b": true, "star0_to_c": true}',
   'Classificação VDA 6.3: faixas de EG e regras de rebaixamento.',
   'VDA 6.3 classification: EG thresholds and downgrade rules.'),
  ('gwi_rules', '{"a_min": 90, "b_min": 80, "major_nc_limits_to_b": true}',
   'Classificação do modelo GWI (conformes ÷ aplicáveis).',
   'GWI template classification (conforming ÷ applicable).'),
  ('audit_status_suggestion', '{"C": "controlled_shipment"}',
   'Regra 3: status sugerido ao fornecedor conforme a classificação da auditoria (o SQE confirma).',
   'Rule 3: supplier status suggested by audit classification (the SQE confirms).'),
  ('finding_response_days', '15',
   'Prazo (dias corridos) para o fornecedor responder o plano de ação de um achado.',
   'Deadline (calendar days) for the supplier to answer a finding action plan.');

-- -----------------------------------------------------------------------------
-- Modelos de checklist versionados
-- -----------------------------------------------------------------------------
create table public.audit_templates (
  id           uuid primary key default gen_random_uuid(),
  code         text not null check (length(btrim(code)) > 0),
  name_pt      text not null,
  name_en      text not null,
  method       text not null check (method in ('vda63', 'gwi')),
  version      integer not null default 1,
  status       text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  based_on_id  uuid references public.audit_templates (id),
  notes        text,
  unique (code, version)
);
select app.setup_business_table('public.audit_templates');
create unique index audit_templates_one_active on public.audit_templates (code) where status = 'active' and cancelled_at is null;

create table public.audit_template_items (
  id                      uuid primary key default gen_random_uuid(),
  template_id             uuid not null references public.audit_templates (id),
  element_code            text not null,   -- VDA: P1..P7; GWI: seção
  element_title_pt        text,
  element_title_en        text,
  item_code               text not null,
  question_pt             text not null,
  question_en             text not null,
  guidance_pt             text,
  guidance_en             text,
  is_star                 boolean not null default false,
  scope_code              text references public.audit_scopes (code),  -- null = todos os escopos
  standard_requirement_id uuid references public.standard_requirements (id),
  sort_order              integer not null default 0
);
select app.setup_business_table('public.audit_template_items');
create index audit_template_items_template_idx on public.audit_template_items (template_id, sort_order);

-- Modelo ativo/aposentado não muda: alterações exigem nova versão.
create or replace function app.tg_template_items_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.audit_templates where id = new.template_id;
  if v_status <> 'draft' then
    raise exception 'template_not_draft' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger template_items_lock before insert or update on public.audit_template_items
  for each row execute function app.tg_template_items_lock();

create or replace function app.tg_templates_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (new.method, new.code, new.version) is distinct from (old.method, old.code, old.version) then
    raise exception 'template_not_draft' using errcode = 'P0001';
  end if;
  if old.status = 'retired' and new.status <> 'retired' then
    raise exception 'template_not_draft' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger templates_guard before update on public.audit_templates
  for each row execute function app.tg_templates_guard();

-- Nova versão em rascunho a partir de um modelo (copia os itens).
create or replace function public.new_template_version(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.audit_templates;
  v_new uuid;
begin
  if not public.is_internal() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from public.audit_templates where id = p_template_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.audit_templates where code = t.code and status = 'draft' and cancelled_at is null) then
    raise exception 'draft_exists' using errcode = 'P0001';
  end if;
  insert into public.audit_templates (code, name_pt, name_en, method, version, status, based_on_id, notes, created_by)
  values (t.code, t.name_pt, t.name_en, t.method,
          (select max(version) + 1 from public.audit_templates where code = t.code), 'draft', t.id, t.notes, auth.uid())
  returning id into v_new;
  insert into public.audit_template_items (template_id, element_code, element_title_pt, element_title_en, item_code,
    question_pt, question_en, guidance_pt, guidance_en, is_star, scope_code, standard_requirement_id, sort_order, created_by)
  select v_new, element_code, element_title_pt, element_title_en, item_code, question_pt, question_en, guidance_pt,
         guidance_en, is_star, scope_code, standard_requirement_id, sort_order, auth.uid()
    from public.audit_template_items where template_id = t.id and cancelled_at is null;
  return v_new;
end;
$$;

-- Ativa um rascunho e aposenta a versão ativa anterior do mesmo código.
create or replace function public.activate_template(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.audit_templates;
begin
  if not public.is_internal() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from public.audit_templates where id = p_template_id for update;
  if not found or t.status <> 'draft' then raise exception 'template_not_draft' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.audit_template_items where template_id = t.id and cancelled_at is null) then
    raise exception 'template_empty' using errcode = 'P0001';
  end if;
  update public.audit_templates set status = 'retired' where code = t.code and status = 'active' and id <> t.id;
  update public.audit_templates set status = 'active' where id = t.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Plano anual e auditorias
-- -----------------------------------------------------------------------------
create table public.audit_plans (
  id             uuid primary key default gen_random_uuid(),
  year           integer not null check (year between 2000 and 2100),
  status         text not null default 'draft' check (status in ('draft', 'submitted', 'approved')),
  submitted_at   timestamptz,
  submitted_by   uuid references auth.users (id),
  approved_at    timestamptz,
  approved_by    uuid references auth.users (id),
  return_comment text
);
select app.setup_business_table('public.audit_plans');
create unique index audit_plans_year_key on public.audit_plans (year) where cancelled_at is null;

create table public.audit_counters (
  year integer primary key,
  last_number integer not null default 0
);
alter table public.audit_counters enable row level security;

create table public.audits (
  id                     uuid primary key default gen_random_uuid(),
  number                 text not null unique,
  supplier_id            uuid not null references public.suppliers (id),
  plan_id                uuid references public.audit_plans (id),
  type_code              text not null references public.audit_types (code),
  template_id            uuid references public.audit_templates (id),
  scope_codes            text[] not null default '{}',
  title                  text,
  planned_start          date not null,
  planned_end            date not null,
  actual_start           date,
  actual_end             date,
  lead_auditor_id        uuid references public.users (id),
  auditor_ids            uuid[] not null default '{}',
  plant_id               uuid references public.plants (id),
  status                 text not null default 'scheduled'
                           check (status in ('planned', 'scheduled', 'in_progress', 'completed', 'closed')),
  score_percent          numeric(5, 2),
  classification         char(1) check (classification in ('A', 'B', 'C')),
  element_scores         jsonb not null default '{}',
  downgrade_reasons      text[] not null default '{}',
  summary                text,
  report_issued_at       timestamptz,
  status_suggestion      text references public.supplier_statuses (code),
  status_suggestion_resolution text check (status_suggestion_resolution in ('applied', 'dismissed')),
  constraint audits_dates_chk check (planned_end >= planned_start)
);
select app.setup_business_table('public.audits');
create index audits_supplier_idx on public.audits (supplier_id, planned_start desc);
create index audits_plan_idx on public.audits (plan_id);

create table public.audit_answers (
  id               uuid primary key default gen_random_uuid(),
  audit_id         uuid not null references public.audits (id),
  supplier_id      uuid not null references public.suppliers (id),
  template_item_id uuid references public.audit_template_items (id),
  -- Cópia do item no momento da auditoria (o modelo pode ganhar nova versão).
  element_code     text not null,
  element_title_pt text,
  element_title_en text,
  item_code        text not null,
  question_pt      text not null,
  question_en      text not null,
  is_star          boolean not null default false,
  sort_order       integer not null default 0,
  score            integer check (score in (0, 4, 6, 8, 10)),
  result           text check (result in ('conform', 'minor_nc', 'major_nc', 'observation', 'not_applicable')),
  not_applicable   boolean not null default false,
  comment          text,
  evidence         text,
  answered_at      timestamptz,
  answered_by      uuid references auth.users (id)
);
select app.setup_business_table('public.audit_answers');
create index audit_answers_audit_idx on public.audit_answers (audit_id, sort_order);

create table public.findings (
  id                  uuid primary key default gen_random_uuid(),
  audit_id            uuid not null references public.audits (id),
  supplier_id         uuid not null references public.suppliers (id),
  answer_id           uuid references public.audit_answers (id),
  classification      text not null check (classification in ('major_nc', 'minor_nc', 'observation', 'improvement')),
  description         text not null check (length(btrim(description)) > 0),
  requirement         text,
  nc_id               uuid references public.ncs (id),
  status              text not null default 'open'
                        check (status in ('open', 'responded', 'action_accepted', 'closed')),
  response_due        date,
  action_plan         text,
  action_responsible  text,
  action_due_date     date,
  responded_at        timestamptz,
  responded_by        uuid references auth.users (id),
  sqe_comment         text,
  effectiveness_comment text,
  verified_at         timestamptz,
  verified_by         uuid references auth.users (id)
);
select app.setup_business_table('public.findings');
create index findings_audit_idx on public.findings (audit_id);

alter table public.ncs
  add constraint ncs_finding_id_fkey foreign key (finding_id) references public.findings (id);

-- -----------------------------------------------------------------------------
-- Permissões auxiliares
-- -----------------------------------------------------------------------------
-- Executa a auditoria: SQM, SQE responsável pelo fornecedor ou auditor designado.
create or replace function public.can_execute_audit(p_audit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.audits a
     where a.id = p_audit_id
       and public.is_internal()
       and (public.can_manage_supplier(a.supplier_id)
            or a.lead_auditor_id = auth.uid()
            or auth.uid() = any (a.auditor_ids))
  )
$$;

create or replace function app.setting_json(p_key text, p_default jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce((select value from public.app_settings where key = p_key and cancelled_at is null), p_default)
$$;

-- -----------------------------------------------------------------------------
-- Cálculo de nota e classificação (VDA 6.3 e GWI)
-- -----------------------------------------------------------------------------
create or replace function public.audit_score(p_audit_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.audits;
  v_method text;
  v_rules jsonb;
  v_total numeric;
  v_count int;
  v_pct numeric;
  v_class char(1);
  v_reasons text[] := '{}';
  v_elements jsonb := '{}';
  v_answered int;
  v_items int;
  e record;
begin
  select * into a from public.audits where id = p_audit_id;
  if not found or not public.can_access_supplier(a.supplier_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select method into v_method from public.audit_templates where id = a.template_id;

  select count(*) filter (where (score is not null) or not_applicable or result is not null), count(*)
    into v_answered, v_items
    from public.audit_answers where audit_id = a.id and cancelled_at is null;

  if v_method = 'vda63' then
    v_rules := app.setting_json('vda_rules', '{"a_min":90,"b_min":80,"element_to_b":80,"element_to_c":70,"star4_to_b":true,"any0_to_b":true,"star0_to_c":true}');
    select sum(score), count(*) into v_total, v_count
      from public.audit_answers where audit_id = a.id and cancelled_at is null and not not_applicable and score is not null;
    if v_count = 0 then
      return jsonb_build_object('method', v_method, 'answered', v_answered, 'items', v_items, 'percent', null, 'classification', null,
                                'elements', '{}'::jsonb, 'reasons', '[]'::jsonb);
    end if;
    v_pct := round(v_total / (v_count * 10) * 100, 1);
    v_class := case when v_pct >= (v_rules ->> 'a_min')::numeric then 'A'
                    when v_pct >= (v_rules ->> 'b_min')::numeric then 'B' else 'C' end;

    for e in
      select element_code, round(sum(score)::numeric / (count(*) * 10) * 100, 1) as pct
        from public.audit_answers
       where audit_id = a.id and cancelled_at is null and not not_applicable and score is not null
       group by element_code order by element_code
    loop
      v_elements := v_elements || jsonb_build_object(e.element_code, e.pct);
      -- Elementos de processo (P2–P7) entram nas regras de rebaixamento.
      if e.element_code ~ '^P[2-7]$' then
        if e.pct < (v_rules ->> 'element_to_c')::numeric then
          v_reasons := array_append(v_reasons, 'element_to_c:' || e.element_code);
        elsif e.pct < (v_rules ->> 'element_to_b')::numeric then
          v_reasons := array_append(v_reasons, 'element_to_b:' || e.element_code);
        end if;
      end if;
    end loop;

    if (v_rules ->> 'star0_to_c')::boolean and exists (
      select 1 from public.audit_answers where audit_id = a.id and cancelled_at is null and is_star and score = 0) then
      v_reasons := array_append(v_reasons, 'star0_to_c');
    end if;
    if (v_rules ->> 'star4_to_b')::boolean and exists (
      select 1 from public.audit_answers where audit_id = a.id and cancelled_at is null and is_star and score = 4) then
      v_reasons := array_append(v_reasons, 'star4_to_b');
    end if;
    if (v_rules ->> 'any0_to_b')::boolean and exists (
      select 1 from public.audit_answers where audit_id = a.id and cancelled_at is null and not is_star and score = 0) then
      v_reasons := array_append(v_reasons, 'any0_to_b');
    end if;

    -- Aplica o rebaixamento mais severo.
    if exists (select 1 from unnest(v_reasons) r where r like '%_to_c%') then
      v_class := 'C';
    elsif cardinality(v_reasons) > 0 and v_class = 'A' then
      v_class := 'B';
    end if;
  elsif v_method = 'gwi' then
    v_rules := app.setting_json('gwi_rules', '{"a_min":90,"b_min":80,"major_nc_limits_to_b":true}');
    select count(*) filter (where result = 'conform' or result = 'observation'),
           count(*) filter (where result is not null and result <> 'not_applicable')
      into v_total, v_count
      from public.audit_answers where audit_id = a.id and cancelled_at is null;
    if v_count = 0 then
      return jsonb_build_object('method', v_method, 'answered', v_answered, 'items', v_items, 'percent', null, 'classification', null,
                                'elements', '{}'::jsonb, 'reasons', '[]'::jsonb);
    end if;
    v_pct := round(v_total / v_count * 100, 1);
    v_class := case when v_pct >= (v_rules ->> 'a_min')::numeric then 'A'
                    when v_pct >= (v_rules ->> 'b_min')::numeric then 'B' else 'C' end;
    for e in
      select element_code,
             round(count(*) filter (where result in ('conform', 'observation'))::numeric
                   / nullif(count(*) filter (where result is not null and result <> 'not_applicable'), 0) * 100, 1) as pct
        from public.audit_answers where audit_id = a.id and cancelled_at is null
       group by element_code order by element_code
    loop
      v_elements := v_elements || jsonb_build_object(e.element_code, e.pct);
    end loop;
    if (v_rules ->> 'major_nc_limits_to_b')::boolean and v_class = 'A' and exists (
      select 1 from public.audit_answers where audit_id = a.id and cancelled_at is null and result = 'major_nc') then
      v_class := 'B';
      v_reasons := array_append(v_reasons, 'major_nc_to_b');
    end if;
  else
    return jsonb_build_object('method', null, 'answered', v_answered, 'items', v_items);
  end if;

  return jsonb_build_object(
    'method', v_method, 'answered', v_answered, 'items', v_items, 'percent', v_pct, 'classification', v_class,
    'elements', v_elements, 'reasons', to_jsonb(v_reasons));
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers de auditoria
-- -----------------------------------------------------------------------------
create or replace function app.tg_audits_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int;
  v_seq int;
  v_plan_status text;
begin
  if tg_op = 'INSERT' then
    v_year := extract(year from new.planned_start);
    insert into public.audit_counters (year, last_number) values (v_year, 1)
      on conflict (year) do update set last_number = public.audit_counters.last_number + 1
      returning last_number into v_seq;
    new.number := format('AUD-%s-%s', v_year, lpad(v_seq::text, 4, '0'));
    -- Regra 14: auditoria de plano não aprovado nasce "planejada".
    if new.plan_id is not null then
      select status into v_plan_status from public.audit_plans where id = new.plan_id;
      new.status := case when v_plan_status = 'approved' then 'scheduled' else 'planned' end;
    else
      new.status := 'scheduled';
    end if;
    new.score_percent := null; new.classification := null; new.report_issued_at := null;
    return new;
  end if;

  if coalesce(current_setting('app.audit_workflow', true), 'off') <> 'on' then
    if (new.status, new.score_percent, new.classification, new.report_issued_at, new.status_suggestion,
        new.status_suggestion_resolution, new.number, new.supplier_id, new.plan_id)
       is distinct from
       (old.status, old.score_percent, old.classification, old.report_issued_at, old.status_suggestion,
        old.status_suggestion_resolution, old.number, old.supplier_id, old.plan_id) then
      raise exception 'audit_workflow_only' using errcode = 'P0001';
    end if;
    if old.status in ('completed', 'closed') and new.cancelled_at is null
       and (new.template_id, new.scope_codes, new.summary) is distinct from (old.template_id, old.scope_codes, old.summary) then
      raise exception 'audit_completed' using errcode = 'P0001';
    end if;
    if old.status in ('in_progress', 'completed', 'closed') and new.template_id is distinct from old.template_id then
      raise exception 'audit_started' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger audits_before before insert or update on public.audits
  for each row execute function app.tg_audits_before();

-- Respostas só mudam com a auditoria em andamento.
create or replace function app.tg_answers_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_method text;
begin
  if coalesce(current_setting('app.audit_workflow', true), 'off') = 'on' then
    return new;
  end if;
  select a.status, t.method into v_status, v_method
    from public.audits a left join public.audit_templates t on t.id = a.template_id where a.id = new.audit_id;
  if v_status <> 'in_progress' then
    raise exception 'audit_not_in_progress' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (new.element_code, new.item_code, new.question_pt, new.question_en, new.is_star, new.audit_id)
     is distinct from (old.element_code, old.item_code, old.question_pt, old.question_en, old.is_star, old.audit_id) then
    raise exception 'answer_snapshot_immutable' using errcode = 'P0001';
  end if;
  if v_method = 'vda63' and new.result is not null then
    raise exception 'wrong_scoring_method' using errcode = '23514';
  end if;
  if v_method = 'gwi' and new.score is not null then
    raise exception 'wrong_scoring_method' using errcode = '23514';
  end if;
  if new.not_applicable then
    new.score := null;
  end if;
  if (new.score is not null or new.not_applicable or new.result is not null)
     and (tg_op = 'INSERT' or (new.score, new.not_applicable, new.result) is distinct from (old.score, old.not_applicable, old.result)) then
    new.answered_at := now();
    new.answered_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger answers_guard before insert or update on public.audit_answers
  for each row execute function app.tg_answers_guard();

-- Regra 4: achado NC maior abre NC 8D vinculada (na criação ou ao reclassificar).
create or replace function app.tg_findings_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.audits;
  v_component uuid;
begin
  select * into a from public.audits where id = new.audit_id;
  new.supplier_id := a.supplier_id;
  if tg_op = 'INSERT' then
    new.status := 'open';
    new.response_due := (now() at time zone 'America/Sao_Paulo')::date
                        + app.setting_numeric('finding_response_days', 15)::int;
    if a.status not in ('in_progress', 'completed') then
      raise exception 'audit_not_in_progress' using errcode = 'P0001';
    end if;
  elsif coalesce(current_setting('app.audit_workflow', true), 'off') <> 'on' then
    if (new.status, new.action_plan, new.action_responsible, new.action_due_date, new.responded_at, new.verified_at, new.nc_id)
       is distinct from
       (old.status, old.action_plan, old.action_responsible, old.action_due_date, old.responded_at, old.verified_at, old.nc_id) then
      raise exception 'finding_workflow_only' using errcode = 'P0001';
    end if;
    if old.status = 'closed' and new.cancelled_at is null then
      raise exception 'finding_closed' using errcode = 'P0001';
    end if;
  end if;

  if new.classification = 'major_nc' and new.nc_id is null and new.cancelled_at is null then
    -- Componente: único componente vinculado ao fornecedor, se houver só um.
    select case when count(*) = 1 then min(component_id::text)::uuid end into v_component
      from public.supplier_components where supplier_id = a.supplier_id and cancelled_at is null;
    insert into public.ncs (supplier_id, component_id, type, origin_code, severity_code, title, description, created_by)
    values (a.supplier_id, v_component, '8d', 'audit', 'major',
            left(format('%s — %s', a.number, new.description), 200),
            format('%s%s', new.description, coalesce(E'\n' || new.requirement, '')),
            coalesce(auth.uid(), new.created_by))
    returning id into new.nc_id;
  end if;
  return new;
end;
$$;
create trigger findings_before before insert or update on public.findings
  for each row execute function app.tg_findings_before();

-- Liga a NC criada ao achado (depois que o achado tem id).
create or replace function app.tg_findings_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nc_id is not null then
    perform set_config('app.nc_workflow', 'on', true);
    update public.ncs set finding_id = new.id where id = new.nc_id and finding_id is null;
    perform set_config('app.nc_workflow', 'off', true);
  end if;
  return null;
end;
$$;
create trigger findings_after after insert or update of nc_id on public.findings
  for each row execute function app.tg_findings_after();

-- -----------------------------------------------------------------------------
-- Workflow: plano anual (regra 14)
-- -----------------------------------------------------------------------------
-- Gera (ou completa) o plano do ano pela criticidade e pela última auditoria
-- de processo de cada fornecedor.
create or replace function public.generate_audit_plan(p_year int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.audit_plans;
  v_freq jsonb := app.setting_json('audit_frequency_months', '{"A":12,"B":24,"C":36}');
  r record;
  v_last date;
  v_due date;
  v_start date;
  v_idx int := 0;
begin
  if not public.is_internal() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_plan from public.audit_plans where year = p_year and cancelled_at is null;
  if not found then
    insert into public.audit_plans (year, created_by) values (p_year, auth.uid()) returning * into v_plan;
  elsif v_plan.status <> 'draft' then
    raise exception 'plan_not_draft' using errcode = 'P0001';
  end if;

  for r in
    select s.id, s.criticality, s.responsible_sqe_id
      from public.suppliers s
     where s.cancelled_at is null and s.status_code not in ('disqualified')
       and (v_freq ->> s.criticality) is not null
       and not exists (select 1 from public.audits x where x.plan_id = v_plan.id and x.supplier_id = s.id and x.cancelled_at is null)
     order by s.criticality, s.legal_name
  loop
    v_idx := v_idx + 1;
    select max(coalesce(actual_end, planned_end)) into v_last
      from public.audits
     where supplier_id = r.id and type_code = 'process' and status in ('completed', 'closed') and cancelled_at is null;
    if v_last is null then
      -- Sem histórico: distribui ao longo do ano (fev a nov).
      v_start := make_date(p_year, 2 + ((v_idx - 1) % 10), 15);
    else
      v_due := v_last + make_interval(months => (v_freq ->> r.criticality)::int);
      if v_due > make_date(p_year, 12, 31) then
        continue;  -- ainda não vence neste ano
      end if;
      v_start := greatest(v_due, make_date(p_year, 1, 15));
    end if;
    insert into public.audits (supplier_id, plan_id, type_code, planned_start, planned_end, lead_auditor_id, created_by)
    values (r.id, v_plan.id, 'process', v_start, v_start + 1, r.responsible_sqe_id, auth.uid());
  end loop;
  return v_plan.id;
end;
$$;

create or replace function public.submit_audit_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_internal() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.audit_plans set status = 'submitted', submitted_at = now(), submitted_by = auth.uid(), return_comment = null
   where id = p_plan_id and status = 'draft';
  if not found then raise exception 'plan_not_draft' using errcode = 'P0001'; end if;
  perform app.notify(u.id, 'audit_plan_submitted', 'audit_plans', p_plan_id, null,
                     jsonb_build_object('year', (select year from public.audit_plans where id = p_plan_id)), '/audits/plan')
     from public.users u where u.role = 'sqm' and u.cancelled_at is null;
end;
$$;

-- Só o SQM aprova (ou devolve com comentário).
create or replace function public.review_audit_plan(p_plan_id uuid, p_approve boolean, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.audit_plans;
begin
  if not public.is_sqm() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_plan from public.audit_plans where id = p_plan_id for update;
  if not found or v_plan.status <> 'submitted' then raise exception 'plan_not_submitted' using errcode = 'P0001'; end if;
  if not p_approve and coalesce(length(btrim(p_comment)), 0) < 3 then
    raise exception 'rejection_comment_required' using errcode = '23514';
  end if;
  if p_approve then
    update public.audit_plans set status = 'approved', approved_at = now(), approved_by = auth.uid() where id = p_plan_id;
    perform set_config('app.audit_workflow', 'on', true);
    update public.audits set status = 'scheduled' where plan_id = p_plan_id and status = 'planned' and cancelled_at is null;
    perform set_config('app.audit_workflow', 'off', true);
    -- Auditoria agendada: avisa o fornecedor.
    perform app.notify(u.id, 'audit_scheduled', 'audits', a.id, a.supplier_id,
                       jsonb_build_object('number', a.number, 'date', a.planned_start), '/audits/' || a.id)
       from public.audits a join public.users u on u.supplier_id = a.supplier_id and u.role = 'supplier' and u.cancelled_at is null
      where a.plan_id = p_plan_id and a.cancelled_at is null;
  else
    update public.audit_plans set status = 'draft', return_comment = btrim(p_comment) where id = p_plan_id;
  end if;
end;
$$;

-- Auditoria planejada só entra em plano em rascunho.
create or replace function app.tg_audits_plan_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if new.plan_id is null or coalesce(current_setting('app.audit_workflow', true), 'off') = 'on' then
    return new;
  end if;
  select status into v_status from public.audit_plans where id = new.plan_id;
  if tg_op = 'INSERT' and v_status <> 'draft' then
    raise exception 'plan_not_draft' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger audits_plan_guard before insert on public.audits
  for each row execute function app.tg_audits_plan_guard();

-- -----------------------------------------------------------------------------
-- Workflow: execução e relatório
-- -----------------------------------------------------------------------------
create or replace function public.start_audit(p_audit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.audits;
  v_template_status text;
begin
  select * into a from public.audits where id = p_audit_id for update;
  if not found or a.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_execute_audit(a.id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status = 'planned' then raise exception 'plan_not_approved' using errcode = 'P0001'; end if;  -- regra 14
  if a.status <> 'scheduled' then raise exception 'audit_not_scheduled' using errcode = 'P0001'; end if;
  select status into v_template_status from public.audit_templates where id = a.template_id;
  if v_template_status is null then raise exception 'template_required' using errcode = 'P0001'; end if;

  perform set_config('app.audit_workflow', 'on', true);
  insert into public.audit_answers (audit_id, supplier_id, template_item_id, element_code, element_title_pt, element_title_en,
    item_code, question_pt, question_en, is_star, sort_order, created_by)
  select a.id, a.supplier_id, i.id, i.element_code, i.element_title_pt, i.element_title_en, i.item_code, i.question_pt,
         i.question_en, i.is_star, i.sort_order, auth.uid()
    from public.audit_template_items i
   where i.template_id = a.template_id and i.cancelled_at is null
     and (i.scope_code is null or i.scope_code = any (a.scope_codes))
     and not exists (select 1 from public.audit_answers x where x.audit_id = a.id and x.template_item_id = i.id);
  update public.audits set status = 'in_progress', actual_start = coalesce(actual_start, current_date) where id = a.id;
  perform set_config('app.audit_workflow', 'off', true);
end;
$$;

-- Conclui: todas as perguntas respondidas, nota calculada, relatório emitido,
-- sugestão de status (regra 3) registrada para o SQE decidir.
create or replace function public.complete_audit(p_audit_id uuid, p_summary text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.audits;
  v_score jsonb;
  v_map jsonb := app.setting_json('audit_status_suggestion', '{"C":"controlled_shipment"}');
  v_suggestion text;
  v_current text;
begin
  select * into a from public.audits where id = p_audit_id for update;
  if not found or a.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_execute_audit(a.id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then raise exception 'audit_not_in_progress' using errcode = 'P0001'; end if;
  if exists (select 1 from public.audit_answers where audit_id = a.id and cancelled_at is null
              and score is null and not not_applicable and result is null) then
    raise exception 'unanswered_items' using errcode = 'P0001';
  end if;

  v_score := public.audit_score(a.id);
  v_suggestion := v_map ->> (v_score ->> 'classification');
  select status_code into v_current from public.suppliers where id = a.supplier_id;
  if v_suggestion = v_current then v_suggestion := null; end if;

  perform set_config('app.audit_workflow', 'on', true);
  update public.audits
     set status = case when exists (select 1 from public.findings f where f.audit_id = a.id and f.cancelled_at is null and f.status <> 'closed')
                       then 'completed' else 'closed' end,
         actual_end = current_date,
         score_percent = (v_score ->> 'percent')::numeric,
         classification = v_score ->> 'classification',
         element_scores = coalesce(v_score -> 'elements', '{}'),
         downgrade_reasons = coalesce((select array_agg(x) from jsonb_array_elements_text(v_score -> 'reasons') x), '{}'),
         summary = coalesce(nullif(btrim(p_summary), ''), summary),
         report_issued_at = now(),
         status_suggestion = v_suggestion
   where id = a.id;
  perform set_config('app.audit_workflow', 'off', true);

  perform app.notify(u.id, 'audit_report_available', 'audits', a.id, a.supplier_id,
                     jsonb_build_object('number', a.number, 'classification', v_score ->> 'classification'), '/audits/' || a.id)
     from public.users u where u.supplier_id = a.supplier_id and u.role = 'supplier' and u.cancelled_at is null;
  return v_score;
end;
$$;

-- Regra 3: o SQE aplica (com justificativa) ou descarta a sugestão de status.
create or replace function public.resolve_audit_status_suggestion(p_audit_id uuid, p_apply boolean, p_justification text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.audits;
begin
  select * into a from public.audits where id = p_audit_id for update;
  if not found or a.status_suggestion is null or a.status_suggestion_resolution is not null then
    raise exception 'no_pending_suggestion' using errcode = 'P0001';
  end if;
  if not public.can_manage_supplier(a.supplier_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_apply then
    perform public.change_supplier_status(a.supplier_id, a.status_suggestion, p_justification);
  end if;
  perform set_config('app.audit_workflow', 'on', true);
  update public.audits set status_suggestion_resolution = case when p_apply then 'applied' else 'dismissed' end where id = a.id;
  perform set_config('app.audit_workflow', 'off', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Workflow: achados (regra 11)
-- -----------------------------------------------------------------------------
create or replace function app.close_audit_if_done(p_audit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.findings where audit_id = p_audit_id and cancelled_at is null and status <> 'closed') then
    perform set_config('app.audit_workflow', 'on', true);
    update public.audits set status = 'closed' where id = p_audit_id and status = 'completed';
    perform set_config('app.audit_workflow', 'off', true);
  end if;
end;
$$;

-- Fornecedor responde o plano de ação do achado (após o relatório).
create or replace function public.respond_finding(p_finding_id uuid, p_action_plan text, p_responsible text, p_due date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.findings;
  v_audit_status text;
begin
  select * into f from public.findings where id = p_finding_id for update;
  if not found or f.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.current_supplier_id() is distinct from f.supplier_id then raise exception 'forbidden' using errcode = '42501'; end if;
  select status into v_audit_status from public.audits where id = f.audit_id;
  if v_audit_status not in ('completed', 'closed') then raise exception 'report_not_issued' using errcode = 'P0001'; end if;
  if f.classification = 'major_nc' then raise exception 'major_nc_via_8d' using errcode = 'P0001'; end if;
  if f.status not in ('open') then raise exception 'step_locked' using errcode = 'P0001'; end if;
  if coalesce(length(btrim(p_action_plan)), 0) < 5 or coalesce(btrim(p_responsible), '') = '' or p_due is null then
    raise exception 'action_plan_required' using errcode = '23514';
  end if;
  perform set_config('app.audit_workflow', 'on', true);
  update public.findings set action_plan = btrim(p_action_plan), action_responsible = btrim(p_responsible), action_due_date = p_due,
         responded_at = now(), responded_by = auth.uid(), status = 'responded'
   where id = f.id;
  perform set_config('app.audit_workflow', 'off', true);
  perform app.notify(s.responsible_sqe_id, 'finding_responded', 'findings', f.id, f.supplier_id,
                     jsonb_build_object('number', a.number, 'supplier', s.legal_name), '/audits/' || a.id || '?tab=findings')
     from public.audits a join public.suppliers s on s.id = a.supplier_id
    where a.id = f.audit_id and s.responsible_sqe_id is not null;
end;
$$;

create or replace function public.review_finding(p_finding_id uuid, p_accept boolean, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.findings;
begin
  select * into f from public.findings where id = p_finding_id for update;
  if not found or f.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_execute_audit(f.audit_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if f.status <> 'responded' then raise exception 'step_not_submitted' using errcode = 'P0001'; end if;
  if not p_accept and coalesce(length(btrim(p_comment)), 0) < 3 then
    raise exception 'rejection_comment_required' using errcode = '23514';
  end if;
  perform set_config('app.audit_workflow', 'on', true);
  update public.findings set status = case when p_accept then 'action_accepted' else 'open' end,
         sqe_comment = nullif(btrim(p_comment), '') where id = f.id;
  perform set_config('app.audit_workflow', 'off', true);
  perform app.notify(u.id, case when p_accept then 'finding_action_accepted' else 'finding_returned' end, 'findings', f.id,
                     f.supplier_id, jsonb_build_object('number', a.number), '/audits/' || a.id || '?tab=findings')
     from public.audits a join public.users u on u.supplier_id = a.supplier_id and u.role = 'supplier' and u.cancelled_at is null
    where a.id = f.audit_id;
end;
$$;

-- Regra 11: fechamento só com eficácia verificada pelo SQE. NC maior: só
-- depois do fechamento do 8D vinculado (que tem a própria verificação).
create or replace function public.verify_finding(p_finding_id uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.findings;
  v_nc_status text;
begin
  select * into f from public.findings where id = p_finding_id for update;
  if not found or f.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_execute_audit(f.audit_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if f.status = 'closed' then raise exception 'finding_closed' using errcode = 'P0001'; end if;
  if coalesce(length(btrim(p_comment)), 0) < 5 then raise exception 'effectiveness_comment_required' using errcode = '23514'; end if;
  if f.classification = 'major_nc' then
    select status into v_nc_status from public.ncs where id = f.nc_id;
    if v_nc_status is distinct from 'closed' then raise exception 'linked_nc_open' using errcode = 'P0001'; end if;
  elsif f.status <> 'action_accepted' then
    raise exception 'action_not_accepted' using errcode = 'P0001';
  end if;
  perform set_config('app.audit_workflow', 'on', true);
  update public.findings set status = 'closed', effectiveness_comment = btrim(p_comment), verified_at = now(), verified_by = auth.uid()
   where id = f.id;
  perform set_config('app.audit_workflow', 'off', true);
  perform app.close_audit_if_done(f.audit_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.audit_templates enable row level security;
create policy audit_templates_select on public.audit_templates for select to authenticated using ((select public.is_internal()));
create policy audit_templates_insert on public.audit_templates for insert to authenticated with check ((select public.is_internal()));
create policy audit_templates_update on public.audit_templates for update to authenticated
  using ((select public.is_internal())) with check ((select public.is_internal()));

alter table public.audit_template_items enable row level security;
create policy audit_template_items_select on public.audit_template_items for select to authenticated using ((select public.is_internal()));
create policy audit_template_items_insert on public.audit_template_items for insert to authenticated with check ((select public.is_internal()));
create policy audit_template_items_update on public.audit_template_items for update to authenticated
  using ((select public.is_internal())) with check ((select public.is_internal()));

-- Plano: interno. Status muda só pelas funções (submit/review).
alter table public.audit_plans enable row level security;
create policy audit_plans_select on public.audit_plans for select to authenticated using ((select public.is_internal()));
revoke insert, update on public.audit_plans from anon, authenticated;

-- Auditorias: fornecedor vê as dele a partir do agendamento (não as de plano não aprovado).
alter table public.audits enable row level security;
create policy audits_select on public.audits for select to authenticated
  using (
    (select public.is_internal())
    or (supplier_id = (select public.current_supplier_id()) and status <> 'planned')
  );
create policy audits_insert on public.audits for insert to authenticated
  with check ((select public.is_internal()) and (select public.can_manage_supplier(supplier_id)));
create policy audits_update on public.audits for update to authenticated
  using ((select public.can_execute_audit(id))) with check ((select public.is_internal()));

-- Respostas e achados: fornecedor só vê depois do relatório emitido.
create or replace function public.audit_report_visible(p_audit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_internal() or exists (
    select 1 from public.audits a
     where a.id = p_audit_id and a.supplier_id = public.current_supplier_id() and a.status in ('completed', 'closed')
  )
$$;

alter table public.audit_answers enable row level security;
create policy audit_answers_select on public.audit_answers for select to authenticated
  using ((select public.audit_report_visible(audit_id)));
create policy audit_answers_update on public.audit_answers for update to authenticated
  using ((select public.can_execute_audit(audit_id))) with check ((select public.can_execute_audit(audit_id)));
revoke insert on public.audit_answers from anon, authenticated;

alter table public.findings enable row level security;
create policy findings_select on public.findings for select to authenticated
  using ((select public.audit_report_visible(audit_id)));
create policy findings_insert on public.findings for insert to authenticated
  with check ((select public.can_execute_audit(audit_id)));
create policy findings_update on public.findings for update to authenticated
  using ((select public.can_execute_audit(audit_id))) with check ((select public.can_execute_audit(audit_id)));

revoke execute on all functions in schema app from public, anon, authenticated;

-- >>>>>>>>>> 20261024000500_inspections.sql
-- =============================================================================
-- SQM App — Etapa 5: M3 Inspeções
-- Regras: 9 (SQE só inspeciona peça verde; reparo aberto = amarela até o
-- fornecedor concluir) e 10 (concessão tem validade e expira sozinha).
-- Embarque controlado: abrir/fechar período acompanha a mudança manual de
-- status do fornecedor (regra 2).
-- =============================================================================

create table public.inspection_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.inspection_types');
insert into public.inspection_types (code, label_pt, label_en, sort_order, is_system) values
  ('self_inspection',     'Autoinspeção do fornecedor',        'Supplier self-inspection',      10, true),
  ('final_supplier',      'Inspeção final no fornecedor',      'Final inspection at supplier',  20, true),
  ('receiving',           'Recebimento',                       'Receiving inspection',          30, true),
  ('controlled_shipment', 'Embarque controlado',               'Controlled shipment',           40, true),
  ('reinspection',        'Reinspeção / contenção de estoque', 'Re-inspection / containment',   50, true);

create table public.characteristic_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt text not null, label_en text not null,
  sort_order integer not null default 0, is_system boolean not null default false
);
select app.setup_lookup_table('public.characteristic_types');
insert into public.characteristic_types (code, label_pt, label_en, sort_order, is_system) values
  ('dimensional', 'Dimensional', 'Dimensional', 10, true),
  ('visual',      'Visual',      'Visual',      20, true),
  ('functional',  'Funcional',   'Functional',  30, true),
  ('documental',  'Documental',  'Documentation', 40, false);

-- Numeração genérica de documentos (INS, WVR…).
create table public.doc_counters (
  kind text not null,
  year integer not null,
  last_number integer not null default 0,
  primary key (kind, year)
);
alter table public.doc_counters enable row level security;

create or replace function app.next_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from now() at time zone 'America/Sao_Paulo');
  v_seq int;
begin
  insert into public.doc_counters (kind, year, last_number) values (p_kind, v_year, 1)
    on conflict (kind, year) do update set last_number = public.doc_counters.last_number + 1
    returning last_number into v_seq;
  return format('%s-%s-%s', p_kind, v_year, lpad(v_seq::text, 4, '0'));
end;
$$;

-- Anexos ganham categoria (ex.: fotos "antes"/"depois" do reparo).
alter table public.attachments add column category text;

-- -----------------------------------------------------------------------------
-- Planos de inspeção por componente
-- -----------------------------------------------------------------------------
create table public.inspection_plans (
  id           uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components (id),
  revision     text not null default 'A',
  active       boolean not null default true,
  notes        text
);
select app.setup_business_table('public.inspection_plans');
create unique index inspection_plans_active_key on public.inspection_plans (component_id) where active and cancelled_at is null;

create table public.inspection_characteristics (
  id                      uuid primary key default gen_random_uuid(),
  plan_id                 uuid not null references public.inspection_plans (id),
  char_type_code          text not null references public.characteristic_types (code),
  name_pt                 text not null,
  name_en                 text not null,
  specification           text,
  nominal                 numeric,
  lower_limit             numeric,
  upper_limit             numeric,
  unit                    text,
  method                  text,
  instrument              text,
  sampling                text not null default '100' check (sampling in ('100', 'aql')),
  aql_level               text,
  sample_size             integer check (sample_size > 0),
  accept_number           integer check (accept_number >= 0),
  is_critical             boolean not null default false,
  standard_requirement_id uuid references public.standard_requirements (id),
  sort_order              integer not null default 0,
  constraint characteristic_limits_chk check (lower_limit is null or upper_limit is null or lower_limit <= upper_limit),
  constraint characteristic_aql_chk check (sampling = '100' or (sample_size is not null and accept_number is not null))
);
select app.setup_business_table('public.inspection_characteristics');
create index inspection_characteristics_plan_idx on public.inspection_characteristics (plan_id, sort_order);

-- -----------------------------------------------------------------------------
-- Peças (SN) e lotes
-- -----------------------------------------------------------------------------
create table public.serial_units (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers (id),
  component_id    uuid not null references public.components (id),
  identifier      text not null check (length(btrim(identifier)) > 0),
  kind            text not null default 'serial' check (kind in ('serial', 'lot')),
  quantity        numeric(12, 2) not null default 1 check (quantity > 0),
  tag             text check (tag in ('green', 'yellow', 'red')),  -- null = aguardando autoinspeção
  scrapped        boolean not null default false,
  production_date date,
  notes           text,
  constraint serial_units_qty_chk check (kind = 'lot' or quantity = 1)
);
select app.setup_business_table('public.serial_units');
create unique index serial_units_key on public.serial_units (supplier_id, component_id, upper(identifier)) where cancelled_at is null;
create index serial_units_tag_idx on public.serial_units (supplier_id, component_id, tag);

-- Etiqueta e sucata só mudam pelas funções de fluxo.
create or replace function app.tg_serial_units_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.tag := null;
    new.scrapped := false;
    return new;
  end if;
  if coalesce(current_setting('app.inspection_workflow', true), 'off') <> 'on'
     and (new.tag is distinct from old.tag or new.scrapped is distinct from old.scrapped
          or new.supplier_id is distinct from old.supplier_id or new.component_id is distinct from old.component_id) then
    raise exception 'tag_workflow_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger serial_units_guard before insert or update on public.serial_units
  for each row execute function app.tg_serial_units_guard();

create or replace function app.set_unit_tag(p_unit_id uuid, p_tag text, p_scrapped boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Restaura o valor anterior: pode ser chamada de dentro de outro fluxo.
  v_prev text := coalesce(current_setting('app.inspection_workflow', true), 'off');
begin
  perform set_config('app.inspection_workflow', 'on', true);
  update public.serial_units set tag = p_tag, scrapped = coalesce(p_scrapped, scrapped) where id = p_unit_id;
  perform set_config('app.inspection_workflow', v_prev, true);
end;
$$;

alter table public.nc_items add column serial_unit_id uuid references public.serial_units (id);

-- A peça ligada ao item da NC tem de ser do mesmo fornecedor da NC.
create or replace function app.tg_nc_items_unit_supplier() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.serial_unit_id is not null and not exists (
    select 1 from public.serial_units u where u.id = new.serial_unit_id and u.supplier_id = new.supplier_id
  ) then
    raise exception 'unit_supplier_mismatch' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger nc_items_unit_supplier before insert or update of serial_unit_id, supplier_id on public.nc_items
  for each row execute function app.tg_nc_items_unit_supplier();

-- -----------------------------------------------------------------------------
-- Reparos (regra 9: reparo aberto deixa a peça amarela)
-- -----------------------------------------------------------------------------
create table public.repairs (
  id               uuid primary key default gen_random_uuid(),
  serial_unit_id   uuid not null references public.serial_units (id),
  supplier_id      uuid not null references public.suppliers (id),
  description      text not null check (length(btrim(description)) > 0),
  performed_by     text,
  started_on       date not null default current_date,
  status           text not null default 'open' check (status in ('open', 'completed')),
  completed_on     date,
  completion_notes text
);
select app.setup_business_table('public.repairs');
create index repairs_unit_idx on public.repairs (serial_unit_id);
create unique index repairs_one_open on public.repairs (serial_unit_id) where status = 'open' and cancelled_at is null;

create or replace function app.tg_repairs_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.serial_units;
begin
  select * into u from public.serial_units where id = new.serial_unit_id;
  new.supplier_id := u.supplier_id;
  if tg_op = 'INSERT' then
    if u.scrapped then raise exception 'unit_scrapped' using errcode = 'P0001'; end if;
    new.status := 'open';
    new.completed_on := null;
  elsif coalesce(current_setting('app.inspection_workflow', true), 'off') <> 'on'
        and (new.status, new.completed_on) is distinct from (old.status, old.completed_on) then
    raise exception 'repair_workflow_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger repairs_before before insert or update on public.repairs
  for each row execute function app.tg_repairs_before();

create or replace function app.tg_repairs_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.set_unit_tag(new.serial_unit_id, 'yellow');
  return null;
end;
$$;
create trigger repairs_after_insert after insert on public.repairs
  for each row execute function app.tg_repairs_after_insert();

-- Fornecedor conclui o reparo: a peça sai do amarelo e aguarda nova autoinspeção.
create or replace function public.complete_repair(p_repair_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.repairs;
begin
  select * into r from public.repairs where id = p_repair_id for update;
  if not found or r.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_write_supplier_row(r.supplier_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.status <> 'open' then raise exception 'repair_not_open' using errcode = 'P0001'; end if;
  perform set_config('app.inspection_workflow', 'on', true);
  update public.repairs set status = 'completed', completed_on = current_date, completion_notes = nullif(btrim(p_notes), '')
   where id = r.id;
  perform set_config('app.inspection_workflow', 'off', true);
  perform app.set_unit_tag(r.serial_unit_id, null);
end;
$$;

-- -----------------------------------------------------------------------------
-- Concessões / desvios (regra 10)
-- -----------------------------------------------------------------------------
create table public.waivers (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,
  supplier_id        uuid not null references public.suppliers (id),
  component_id       uuid not null references public.components (id),
  characteristic_ids uuid[] not null default '{}',
  description        text not null check (length(btrim(description)) > 0),
  justification      text not null check (length(btrim(justification)) > 0),
  valid_until        date,
  max_quantity       numeric(12, 2) check (max_quantity > 0),
  serial_unit_ids    uuid[] not null default '{}',
  used_quantity      numeric(12, 2) not null default 0,
  status             text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'expired')),
  decided_at         timestamptz,
  decided_by         uuid references auth.users (id),
  decision_comment   text,
  constraint waivers_limit_chk check (valid_until is not null or max_quantity is not null or cardinality(serial_unit_ids) > 0)
);
select app.setup_business_table('public.waivers');
create index waivers_supplier_idx on public.waivers (supplier_id, status);

create or replace function app.tg_waivers_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.number := app.next_number('WVR');
    new.status := 'requested';
    new.used_quantity := 0;
    new.decided_at := null; new.decided_by := null;
    return new;
  end if;
  if coalesce(current_setting('app.inspection_workflow', true), 'off') <> 'on' then
    if (new.status, new.used_quantity, new.decided_at, new.number, new.supplier_id)
       is distinct from (old.status, old.used_quantity, old.decided_at, old.number, old.supplier_id) then
      raise exception 'waiver_workflow_only' using errcode = 'P0001';
    end if;
    if old.status <> 'requested' and new.cancelled_at is null then
      raise exception 'waiver_decided' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger waivers_before before insert or update on public.waivers
  for each row execute function app.tg_waivers_before();

create or replace function public.waiver_is_active(p_waiver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.waivers w
     where w.id = p_waiver_id and w.status = 'approved' and w.cancelled_at is null
       and (w.valid_until is null or w.valid_until >= (now() at time zone 'America/Sao_Paulo')::date)
       and (w.max_quantity is null or w.used_quantity < w.max_quantity)
  )
$$;

-- SQE ou SQM aprova/reprova o pedido do fornecedor.
create or replace function public.review_waiver(p_waiver_id uuid, p_approve boolean, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.waivers;
begin
  select * into w from public.waivers where id = p_waiver_id for update;
  if not found or w.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_manage_supplier(w.supplier_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if w.status <> 'requested' then raise exception 'waiver_decided' using errcode = 'P0001'; end if;
  if not p_approve and coalesce(length(btrim(p_comment)), 0) < 3 then
    raise exception 'rejection_comment_required' using errcode = '23514';
  end if;
  if p_approve and w.valid_until is not null and w.valid_until < current_date then
    raise exception 'waiver_already_expired' using errcode = 'P0001';
  end if;
  perform set_config('app.inspection_workflow', 'on', true);
  update public.waivers set status = case when p_approve then 'approved' else 'rejected' end,
         decided_at = now(), decided_by = auth.uid(), decision_comment = nullif(btrim(p_comment), '')
   where id = w.id;
  perform set_config('app.inspection_workflow', 'off', true);
  perform app.notify(u.id, case when p_approve then 'waiver_approved' else 'waiver_rejected' end, 'waivers', w.id, w.supplier_id,
                     jsonb_build_object('number', w.number), '/inspections/waivers')
     from public.users u where u.supplier_id = w.supplier_id and u.role = 'supplier' and u.cancelled_at is null;
end;
$$;

-- Expiração automática (data vencida); a quantidade expira no uso.
create or replace function app.expire_waivers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  perform set_config('app.inspection_workflow', 'on', true);
  update public.waivers set status = 'expired'
   where status = 'approved' and cancelled_at is null
     and ((valid_until is not null and valid_until < (now() at time zone 'America/Sao_Paulo')::date)
          or (max_quantity is not null and used_quantity >= max_quantity));
  get diagnostics v_count = row_count;
  perform set_config('app.inspection_workflow', 'off', true);
  return v_count;
end;
$$;
select cron.schedule('expire-waivers', '5 3 * * *', $$select app.expire_waivers()$$);

create or replace function app.tg_waiver_notify_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.notify(s.responsible_sqe_id, 'waiver_requested', 'waivers', new.id, new.supplier_id,
                     jsonb_build_object('number', new.number, 'supplier', s.legal_name), '/inspections/waivers')
     from public.suppliers s where s.id = new.supplier_id and s.responsible_sqe_id is not null;
  return null;
end;
$$;
create trigger waivers_notify after insert on public.waivers
  for each row execute function app.tg_waiver_notify_request();

-- -----------------------------------------------------------------------------
-- Inspeções
-- -----------------------------------------------------------------------------
create table public.inspections (
  id            uuid primary key default gen_random_uuid(),
  number        text not null unique,
  supplier_id   uuid not null references public.suppliers (id),
  component_id  uuid not null references public.components (id),
  plan_id       uuid not null references public.inspection_plans (id),
  type_code     text not null references public.inspection_types (code),
  location      text,
  inspected_on  date not null default current_date,
  inspector_id  uuid references public.users (id),
  status        text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  result        text check (result in ('approved', 'rejected', 'partial')),
  notes         text,
  completed_at  timestamptz
);
select app.setup_business_table('public.inspections');
create index inspections_supplier_idx on public.inspections (supplier_id, inspected_on desc);

create table public.inspection_units (
  id             uuid primary key default gen_random_uuid(),
  inspection_id  uuid not null references public.inspections (id),
  serial_unit_id uuid not null references public.serial_units (id),
  supplier_id    uuid not null references public.suppliers (id),
  result         text check (result in ('approved', 'rejected')),
  unique (inspection_id, serial_unit_id)
);
select app.setup_business_table('public.inspection_units');

create table public.inspection_results (
  id                uuid primary key default gen_random_uuid(),
  inspection_id     uuid not null references public.inspections (id),
  inspection_unit_id uuid not null references public.inspection_units (id),
  serial_unit_id    uuid not null references public.serial_units (id),
  characteristic_id uuid not null references public.inspection_characteristics (id),
  supplier_id       uuid not null references public.suppliers (id),
  measured_values   numeric[] not null default '{}',
  measured_text     text,
  qty_inspected     numeric(12, 2),
  qty_nok           numeric(12, 2),
  ok                boolean,
  auto_evaluated    boolean not null default false,
  waiver_id         uuid references public.waivers (id),
  comment           text,
  unique (inspection_unit_id, characteristic_id)
);
select app.setup_business_table('public.inspection_results');
create index inspection_results_inspection_idx on public.inspection_results (inspection_id);

create or replace function app.tg_inspections_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  if tg_op = 'INSERT' then
    new.number := app.next_number('INS');
    new.status := 'in_progress';
    new.result := null;
    new.completed_at := null;
    new.inspector_id := coalesce(auth.uid(), new.inspector_id);
    if new.plan_id is null then
      select id into v_plan from public.inspection_plans
       where component_id = new.component_id and active and cancelled_at is null;
      if v_plan is null then raise exception 'inspection_plan_required' using errcode = 'P0001'; end if;
      new.plan_id := v_plan;
    end if;
    -- Fornecedor só faz autoinspeção; interno não faz autoinspeção em nome do fornecedor.
    if public.current_app_role() = 'supplier' and new.type_code <> 'self_inspection' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if public.is_internal() and new.type_code = 'self_inspection' then
      raise exception 'self_inspection_by_supplier' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if coalesce(current_setting('app.inspection_workflow', true), 'off') <> 'on' then
    if (new.status, new.result, new.completed_at, new.number, new.supplier_id, new.type_code, new.plan_id)
       is distinct from (old.status, old.result, old.completed_at, old.number, old.supplier_id, old.type_code, old.plan_id) then
      raise exception 'inspection_workflow_only' using errcode = 'P0001';
    end if;
    if old.status = 'completed' and new.cancelled_at is null then
      raise exception 'inspection_completed' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger inspections_before before insert or update on public.inspections
  for each row execute function app.tg_inspections_before();

-- Regra 9: na inspeção do SQE só entram peças verdes (não sucateadas).
-- Na autoinspeção: peça sem reparo aberto e não sucateada.
create or replace function public.add_inspection_unit(p_inspection_id uuid, p_unit_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.inspections;
  u public.serial_units;
  v_iu uuid;
begin
  select * into i from public.inspections where id = p_inspection_id;
  select * into u from public.serial_units where id = p_unit_id;
  if i.id is null or u.id is null or u.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_write_supplier_row(i.supplier_id)
     or (public.current_app_role() = 'supplier' and i.type_code <> 'self_inspection') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if i.status <> 'in_progress' then raise exception 'inspection_completed' using errcode = 'P0001'; end if;
  if u.supplier_id <> i.supplier_id or u.component_id <> i.component_id then
    raise exception 'unit_mismatch' using errcode = 'P0001';
  end if;
  if u.scrapped then raise exception 'unit_scrapped' using errcode = 'P0001'; end if;
  if i.type_code = 'self_inspection' then
    if u.tag = 'yellow' then raise exception 'unit_under_repair' using errcode = 'P0001'; end if;
  elsif u.tag is distinct from 'green' then
    raise exception 'unit_not_green' using errcode = 'P0001';
  end if;

  insert into public.inspection_units (inspection_id, serial_unit_id, supplier_id, created_by)
  values (i.id, u.id, u.supplier_id, auth.uid()) returning id into v_iu;
  insert into public.inspection_results (inspection_id, inspection_unit_id, serial_unit_id, characteristic_id, supplier_id,
                                         qty_inspected, created_by)
  select i.id, v_iu, u.id, c.id, u.supplier_id,
         case when c.sampling = 'aql' then least(c.sample_size, u.quantity) else u.quantity end, auth.uid()
    from public.inspection_characteristics c
   where c.plan_id = i.plan_id and c.cancelled_at is null;
  return v_iu;
end;
$$;

-- Avalia OK/NOK sozinho quando há medição numérica e limites, ou contagem de NOK.
create or replace function app.tg_results_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.inspection_characteristics;
  v_status text;
  v_out int;
  v_accept int;
begin
  select status into v_status from public.inspections where id = new.inspection_id;
  if v_status <> 'in_progress' and coalesce(current_setting('app.inspection_workflow', true), 'off') <> 'on' then
    raise exception 'inspection_completed' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.waiver_id is distinct from old.waiver_id
     and coalesce(current_setting('app.inspection_workflow', true), 'off') <> 'on' then
    raise exception 'waiver_workflow_only' using errcode = 'P0001';
  end if;
  select * into c from public.inspection_characteristics where id = new.characteristic_id;
  v_accept := case when c.sampling = 'aql' then coalesce(c.accept_number, 0) else 0 end;
  new.auto_evaluated := false;

  if cardinality(new.measured_values) > 0 and (c.lower_limit is not null or c.upper_limit is not null) then
    select count(*) into v_out from unnest(new.measured_values) v
     where (c.lower_limit is not null and v < c.lower_limit) or (c.upper_limit is not null and v > c.upper_limit);
    new.qty_nok := greatest(coalesce(new.qty_nok, 0), v_out);
    new.ok := new.qty_nok <= v_accept;
    new.auto_evaluated := true;
  elsif new.qty_nok is not null and new.qty_inspected is not null and (tg_op = 'INSERT' or new.qty_nok is distinct from old.qty_nok) then
    new.ok := new.qty_nok <= v_accept;
    new.auto_evaluated := true;
  end if;
  -- Aceito sob concessão (regra 10) conta como OK.
  if new.waiver_id is not null then
    new.ok := true;
  end if;
  return new;
end;
$$;
create trigger results_before before insert or update on public.inspection_results
  for each row execute function app.tg_results_before();

-- Aceite sob concessão: verifica validade/escopo e consome a quantidade.
create or replace function public.apply_waiver(p_result_id uuid, p_waiver_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.inspection_results;
  w public.waivers;
  u public.serial_units;
  v_use numeric;
begin
  select * into r from public.inspection_results where id = p_result_id for update;
  select * into w from public.waivers where id = p_waiver_id for update;
  if r.id is null or w.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_manage_supplier(r.supplier_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.waiver_is_active(w.id) then raise exception 'waiver_not_active' using errcode = 'P0001'; end if;
  select * into u from public.serial_units where id = r.serial_unit_id;
  if w.supplier_id <> r.supplier_id or w.component_id <> u.component_id
     or (cardinality(w.characteristic_ids) > 0 and not (r.characteristic_id = any (w.characteristic_ids)))
     or (cardinality(w.serial_unit_ids) > 0 and not (r.serial_unit_id = any (w.serial_unit_ids))) then
    raise exception 'waiver_not_applicable' using errcode = 'P0001';
  end if;
  if r.ok is distinct from false or r.waiver_id is not null then raise exception 'result_not_nok' using errcode = 'P0001'; end if;

  v_use := case when u.kind = 'lot' then coalesce(nullif(r.qty_nok, 0), 1) else 1 end;
  if w.max_quantity is not null and w.used_quantity + v_use > w.max_quantity then
    raise exception 'waiver_quantity_exceeded' using errcode = 'P0001';
  end if;
  perform set_config('app.inspection_workflow', 'on', true);
  update public.inspection_results set waiver_id = w.id where id = r.id;
  update public.waivers set used_quantity = used_quantity + v_use,
         status = case when max_quantity is not null and used_quantity + v_use >= max_quantity then 'expired' else status end
   where id = w.id;
  perform set_config('app.inspection_workflow', 'off', true);
end;
$$;

-- Conclui a inspeção: decide cada peça e atualiza a etiqueta.
create or replace function public.complete_inspection(p_inspection_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.inspections;
  iu record;
  v_rejected int := 0;
  v_approved int := 0;
  v_result text;
begin
  select * into i from public.inspections where id = p_inspection_id for update;
  if not found or i.cancelled_at is not null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_write_supplier_row(i.supplier_id)
     or (public.current_app_role() = 'supplier' and i.type_code <> 'self_inspection') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if i.status <> 'in_progress' then raise exception 'inspection_completed' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.inspection_units where inspection_id = i.id and cancelled_at is null) then
    raise exception 'inspection_no_units' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.inspection_results where inspection_id = i.id and cancelled_at is null and ok is null) then
    raise exception 'unanswered_items' using errcode = 'P0001';
  end if;

  perform set_config('app.inspection_workflow', 'on', true);
  for iu in
    select x.id, x.serial_unit_id,
           exists (select 1 from public.inspection_results r where r.inspection_unit_id = x.id and r.cancelled_at is null and not r.ok) as has_nok
      from public.inspection_units x where x.inspection_id = i.id and x.cancelled_at is null
  loop
    update public.inspection_units set result = case when iu.has_nok then 'rejected' else 'approved' end where id = iu.id;
    if iu.has_nok then
      v_rejected := v_rejected + 1;
      perform app.set_unit_tag(iu.serial_unit_id, 'red');
    else
      v_approved := v_approved + 1;
      -- Autoinspeção aprovada = peça pronta para o SQE (verde).
      if i.type_code = 'self_inspection' then perform app.set_unit_tag(iu.serial_unit_id, 'green'); end if;
    end if;
  end loop;
  v_result := case when v_rejected = 0 then 'approved' when v_approved = 0 then 'rejected' else 'partial' end;
  update public.inspections set status = 'completed', result = v_result, completed_at = now() where id = i.id;
  perform set_config('app.inspection_workflow', 'off', true);

  if v_rejected > 0 and i.type_code <> 'self_inspection' then
    perform app.notify(u.id, 'inspection_rejected', 'inspections', i.id, i.supplier_id,
                       jsonb_build_object('number', i.number, 'count', v_rejected), '/inspections/' || i.id)
       from public.users u where u.supplier_id = i.supplier_id and u.role = 'supplier' and u.cancelled_at is null;
  end if;
  return v_result;
end;
$$;

-- SQE: rejeição final (sucata) de peça vermelha; não volta ao fluxo.
create or replace function public.scrap_unit(p_unit_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.serial_units;
begin
  select * into u from public.serial_units where id = p_unit_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.can_manage_supplier(u.supplier_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if u.tag is distinct from 'red' then raise exception 'unit_not_red' using errcode = 'P0001'; end if;
  if coalesce(length(btrim(p_reason)), 0) < 3 then raise exception 'justification_required' using errcode = '23514'; end if;
  perform set_config('app.inspection_workflow', 'on', true);
  update public.serial_units set scrapped = true, notes = concat_ws(E'\n', notes, btrim(p_reason)) where id = u.id;
  perform set_config('app.inspection_workflow', 'off', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Embarque controlado: períodos ligados ao status do fornecedor
-- -----------------------------------------------------------------------------
create table public.controlled_shipment_periods (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.suppliers (id),
  started_at   timestamptz not null default now(),
  start_reason text not null,
  started_by   uuid references auth.users (id),
  ended_at     timestamptz,
  end_reason   text,
  ended_by     uuid references auth.users (id)
);
select app.setup_business_table('public.controlled_shipment_periods');
create unique index controlled_shipment_one_open on public.controlled_shipment_periods (supplier_id)
  where ended_at is null and cancelled_at is null;
revoke insert, update on public.controlled_shipment_periods from anon, authenticated;

-- Entrada e saída são sempre decisão manual (regra 2): acontecem dentro de
-- change_supplier_status, que exige justificativa.
create or replace function public.change_supplier_status(
  p_supplier_id uuid,
  p_status text,
  p_justification text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.can_manage_supplier(p_supplier_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_justification)), 0) < 5 then
    raise exception 'justification_required' using errcode = '23514';
  end if;
  if not exists (select 1 from public.supplier_statuses where code = p_status and cancelled_at is null) then
    raise exception 'invalid_status' using errcode = '23514';
  end if;

  select status_code into v_old from public.suppliers
   where id = p_supplier_id and cancelled_at is null
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_old = p_status then
    raise exception 'status_unchanged' using errcode = '23514';
  end if;

  perform set_config('app.status_change', 'on', true);
  update public.suppliers set status_code = p_status where id = p_supplier_id;
  perform set_config('app.status_change', 'off', true);

  insert into public.supplier_status_history (supplier_id, from_status, to_status, justification, created_by)
  values (p_supplier_id, v_old, p_status, btrim(p_justification), auth.uid());

  if p_status = 'controlled_shipment' then
    insert into public.controlled_shipment_periods (supplier_id, start_reason, started_by, created_by)
    values (p_supplier_id, btrim(p_justification), auth.uid(), auth.uid());
  elsif v_old = 'controlled_shipment' then
    update public.controlled_shipment_periods
       set ended_at = now(), end_reason = btrim(p_justification), ended_by = auth.uid()
     where supplier_id = p_supplier_id and ended_at is null and cancelled_at is null;
  end if;
end;
$$;

-- Fornecedor cadastrado já em embarque controlado também abre o período.
create or replace function app.tg_suppliers_initial_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.supplier_status_history (supplier_id, from_status, to_status, created_by)
  values (new.id, null, new.status_code, new.created_by);
  if new.status_code = 'controlled_shipment' then
    insert into public.controlled_shipment_periods (supplier_id, start_reason, started_by, created_by)
    values (new.id, '—', new.created_by, new.created_by);
  end if;
  return null;
end;
$$;

-- Fornecedores já em embarque controlado ganham o período aberto.
insert into public.controlled_shipment_periods (supplier_id, start_reason, started_at)
select s.id, coalesce(h.justification, '—'), coalesce(h.created_at, now())
  from public.suppliers s
  left join lateral (select justification, created_at from public.supplier_status_history
                      where supplier_id = s.id and to_status = 'controlled_shipment' order by created_at desc limit 1) h on true
 where s.status_code = 'controlled_shipment' and s.cancelled_at is null;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- Planos: fornecedor vê os dos seus componentes (precisa para a autoinspeção).
alter table public.inspection_plans enable row level security;
create policy inspection_plans_select on public.inspection_plans for select to authenticated
  using ((select public.can_access_component(component_id)));
create policy inspection_plans_insert on public.inspection_plans for insert to authenticated
  with check ((select public.can_manage_component(component_id)));
create policy inspection_plans_update on public.inspection_plans for update to authenticated
  using ((select public.can_manage_component(component_id))) with check ((select public.can_manage_component(component_id)));

create or replace function public.plan_component(p_plan_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select component_id from public.inspection_plans where id = p_plan_id $$;

alter table public.inspection_characteristics enable row level security;
create policy inspection_characteristics_select on public.inspection_characteristics for select to authenticated
  using ((select public.can_access_component(public.plan_component(plan_id))));
create policy inspection_characteristics_insert on public.inspection_characteristics for insert to authenticated
  with check ((select public.can_manage_component(public.plan_component(plan_id))));
create policy inspection_characteristics_update on public.inspection_characteristics for update to authenticated
  using ((select public.can_manage_component(public.plan_component(plan_id))))
  with check ((select public.can_manage_component(public.plan_component(plan_id))));

-- Peças: fornecedor cadastra as próprias; SQE responsável também.
select app.apply_default_supplier_policies('public.serial_units');
select app.apply_default_supplier_policies('public.repairs');

alter table public.inspections enable row level security;
create policy inspections_select on public.inspections for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
create policy inspections_insert on public.inspections for insert to authenticated
  with check ((select public.can_write_supplier_row(supplier_id)));
create policy inspections_update on public.inspections for update to authenticated
  using ((select public.can_write_supplier_row(supplier_id))
         and (public.is_internal() or type_code = 'self_inspection'))
  with check ((select public.can_write_supplier_row(supplier_id)));

alter table public.inspection_units enable row level security;
create policy inspection_units_select on public.inspection_units for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
revoke insert, update on public.inspection_units from anon, authenticated;

-- Resultados: quem pode editar a inspeção (fornecedor só na autoinspeção).
create or replace function public.can_edit_inspection(p_inspection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.inspections i
     where i.id = p_inspection_id
       and public.can_write_supplier_row(i.supplier_id)
       and (public.is_internal() or i.type_code = 'self_inspection')
  )
$$;

alter table public.inspection_results enable row level security;
create policy inspection_results_select on public.inspection_results for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
create policy inspection_results_update on public.inspection_results for update to authenticated
  using ((select public.can_edit_inspection(inspection_id))) with check ((select public.can_edit_inspection(inspection_id)));
revoke insert on public.inspection_results from anon, authenticated;

-- Concessões: fornecedor solicita as próprias; decisão só pela função.
alter table public.waivers enable row level security;
create policy waivers_select on public.waivers for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));
create policy waivers_insert on public.waivers for insert to authenticated
  with check (supplier_id = (select public.current_supplier_id()) or (select public.can_manage_supplier(supplier_id)));
create policy waivers_update on public.waivers for update to authenticated
  using ((select public.can_write_supplier_row(supplier_id))) with check ((select public.can_write_supplier_row(supplier_id)));

alter table public.controlled_shipment_periods enable row level security;
create policy controlled_shipment_select on public.controlled_shipment_periods for select to authenticated
  using ((select public.can_access_supplier(supplier_id)));

revoke execute on all functions in schema app from public, anon, authenticated;

-- >>>>>>>>>> 20261024000600_notifications_export.sql
-- =============================================================================
-- Etapa 6 — M5 Notificações e escalonamento + M10 Exportação
--   * escalation_rules (configurável): vencimento → fornecedor; +3 → SQE e
--     contatos de Qualidade; +7 → SQM e contatos de Direção. Um aviso por nível.
--   * Regra 8: só escala o que está com o fornecedor (D aguardando análise não).
--   * email_outbox: fila de e-mails (usuários e contatos sem login), enviada
--     pela Edge Function "notifications" (Resend, ou Mailpit no ambiente local).
--   * notification_events: quais eventos também vão por e-mail (configurável).
--   * pending_items_for(): "Minhas pendências" e o resumo diário do SQE.
--   * export_tables(): exportação completa da base (só SQM).
-- =============================================================================

create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- Configurações
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value, description_pt, description_en) values
  ('due_soon_days', '2',
   'Dias antes do prazo para avisar o fornecedor (prazo chegando).',
   'Days before the deadline to remind the supplier (deadline approaching).'),
  ('cost_response_days', '10',
   'Prazo (dias corridos) para o fornecedor aceitar ou contestar um custo de NC.',
   'Deadline (calendar days) for the supplier to accept or contest an NC cost.'),
  ('daily_digest', '{"enabled": true, "roles": ["sqe"]}',
   'Resumo diário por e-mail: ligado/desligado e perfis que recebem.',
   'Daily e-mail digest: on/off and which roles receive it.')
on conflict (key) do nothing;

create or replace function app.tz()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value #>> '{}' from public.app_settings where key = 'timezone' and cancelled_at is null),
                  'America/Sao_Paulo')
$$;

create or replace function app.local_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone app.tz())::date
$$;

-- Preferência do usuário: receber notificações também por e-mail.
alter table public.users add column email_notifications boolean not null default true;

-- -----------------------------------------------------------------------------
-- Eventos de notificação (quais vão por e-mail)
-- -----------------------------------------------------------------------------
create table public.notification_events (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_pt   text not null,
  label_en   text not null,
  send_email boolean not null default true,
  sort_order integer not null default 0,
  is_system  boolean not null default true
);
select app.setup_lookup_table('public.notification_events');

insert into public.notification_events (code, label_pt, label_en, send_email, sort_order) values
  ('nc_opened',                       'NC aberta',                              'NC opened',                         true,  10),
  ('nc_converted_8d',                 'NC convertida em 8D',                    'NC converted to 8D',                true,  20),
  ('eight_d_submitted',               'D enviada',                              'D submitted',                       true,  30),
  ('eight_d_approved',                'D aprovada',                             'D approved',                        true,  40),
  ('eight_d_rejected',                'D reprovada (documento reprovado)',      'D rejected (document rejected)',    true,  50),
  ('simple_nc_responded',             'NC simples respondida',                  'Simple NC answered',                true,  60),
  ('simple_nc_returned',              'Resposta de NC devolvida (documento reprovado)', 'NC answer returned (document rejected)', true, 70),
  ('nc_closed',                       'NC fechada',                             'NC closed',                         true,  80),
  ('nc_cost_launched',                'Custo lançado',                          'Cost posted',                       true,  90),
  ('nc_cost_accepted',                'Custo aceito',                           'Cost accepted',                     true, 100),
  ('nc_cost_contested',               'Custo contestado',                       'Cost contested',                    true, 110),
  ('deadline_soon',                   'Prazo chegando',                         'Deadline approaching',              true, 120),
  ('deadline_overdue',                'Prazo vencido / escalonamento',          'Deadline overdue / escalation',     true, 130),
  ('audit_plan_submitted',            'Plano de auditorias aguardando aprovação', 'Audit plan awaiting approval',    true, 140),
  ('audit_scheduled',                 'Auditoria agendada',                     'Audit scheduled',                   true, 150),
  ('audit_report_available',          'Relatório de auditoria disponível',      'Audit report available',            true, 160),
  ('finding_responded',               'Achado respondido',                      'Finding answered',                  true, 170),
  ('finding_action_accepted',         'Plano de ação aceito',                   'Action plan accepted',              true, 180),
  ('finding_returned',                'Plano de ação devolvido (documento reprovado)', 'Action plan returned (document rejected)', true, 190),
  ('waiver_requested',                'Concessão solicitada',                   'Waiver requested',                  true, 200),
  ('waiver_approved',                 'Concessão aprovada',                     'Waiver approved',                   true, 210),
  ('waiver_rejected',                 'Concessão reprovada (documento reprovado)', 'Waiver rejected (document rejected)', true, 220),
  ('inspection_rejected',             'Inspeção com peça reprovada',            'Inspection with rejected part',     true, 230),
  ('certificate_expiring',            'Certificado vencendo',                   'Certificate expiring',              true, 240),
  ('certificate_expired',             'Certificado vencido',                    'Certificate expired',               true, 250),
  ('certificate_updated_by_supplier', 'Certificado atualizado pelo fornecedor', 'Certificate updated by supplier',   true, 260),
  ('daily_digest',                    'Resumo diário (somente e-mail)',         'Daily digest (e-mail only)',        true, 270);

-- -----------------------------------------------------------------------------
-- Regras de escalonamento
-- -----------------------------------------------------------------------------
create table public.escalation_rules (
  id                     uuid primary key default gen_random_uuid(),
  days_after_due         integer not null check (days_after_due between 0 and 365),
  notify_supplier_users  boolean not null default false,
  notify_responsible_sqe boolean not null default false,
  notify_sqm             boolean not null default false,
  contact_role_codes     text[] not null default '{}',
  active                 boolean not null default true
);
comment on table public.escalation_rules is
  'Escalonamento por atraso (regra 8). Cada linha é um nível: X dias após o vencimento avisa os destinatários marcados, uma vez.';
select app.setup_business_table('public.escalation_rules');
create unique index escalation_rules_days on public.escalation_rules (days_after_due) where cancelled_at is null;

alter table public.escalation_rules enable row level security;
create policy escalation_rules_select on public.escalation_rules for select to authenticated
  using ((select public.is_internal()));
create policy escalation_rules_insert on public.escalation_rules for insert to authenticated
  with check ((select public.is_internal()));
create policy escalation_rules_update on public.escalation_rules for update to authenticated
  using ((select public.is_internal())) with check ((select public.is_internal()));

insert into public.escalation_rules (days_after_due, notify_supplier_users, notify_responsible_sqe, notify_sqm, contact_role_codes) values
  (0, true,  false, false, '{}'),
  (3, false, true,  false, '{quality}'),
  (7, false, false, true,  '{director}');

-- -----------------------------------------------------------------------------
-- Fila de e-mails
-- -----------------------------------------------------------------------------
create table public.email_outbox (
  id                uuid primary key default gen_random_uuid(),
  recipient_email   text not null,
  recipient_name    text,
  recipient_user_id uuid references public.users (id),
  locale            text not null default 'pt-BR' check (locale in ('pt-BR', 'en')),
  event_code        text not null,
  params            jsonb not null default '{}',
  link_path         text,
  notification_id   uuid references public.notifications (id),
  dedupe_key        text unique,
  status            text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts          integer not null default 0,
  last_error        text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);
comment on table public.email_outbox is
  'E-mails a enviar. O texto é montado na Edge Function a partir de event_code + params, no idioma do destinatário.';
create index email_outbox_pending_idx on public.email_outbox (created_at) where status in ('pending', 'sending');
create trigger prevent_delete before delete on public.email_outbox
  for each row execute function app.tg_prevent_delete();
alter table public.email_outbox enable row level security;
create policy email_outbox_select on public.email_outbox for select to authenticated
  using ((select public.is_sqm()));

create or replace function app.enqueue_email(
  p_email text, p_name text, p_user uuid, p_locale text, p_event text, p_params jsonb, p_link text,
  p_notification uuid default null, p_dedupe text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_email is null or btrim(p_email) = '' then
    return 0;
  end if;
  insert into public.email_outbox
    (recipient_email, recipient_name, recipient_user_id, locale, event_code, params, link_path, notification_id, dedupe_key)
  values
    (lower(btrim(p_email)), p_name, p_user, case when p_locale = 'en' then 'en' else 'pt-BR' end, p_event,
     coalesce(p_params, '{}'), p_link, p_notification, p_dedupe)
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Toda notificação in-app de evento com e-mail ligado também entra na fila.
create or replace function app.tg_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  u record;
begin
  if not coalesce((select e.send_email from public.notification_events e
                    where e.code = new.event_code and e.cancelled_at is null), false) then
    return new;
  end if;
  select x.email, x.full_name, x.language, x.email_notifications, x.cancelled_at into u
    from public.users x where x.id = new.recipient_id;
  if u.email is null or not u.email_notifications or u.cancelled_at is not null then
    return new;
  end if;
  perform app.enqueue_email(u.email, u.full_name, new.recipient_id, u.language::text, new.event_code, new.params,
                            new.link_path, new.id, 'n:' || new.id);
  return new;
end;
$$;
create trigger notification_email after insert on public.notifications
  for each row execute function app.tg_notification_email();

-- Edge Function: pega um lote para envio (service_role) e registra o resultado.
create or replace function public.claim_email_batch(p_limit integer default 50)
returns setof public.email_outbox
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox o
     set status = 'sending', attempts = o.attempts + 1
   where o.id in (
     select id from public.email_outbox
      where (status = 'pending' or (status = 'sending' and attempts < 5 and created_at < now() - interval '10 minutes'))
      order by created_at
      limit p_limit
      for update skip locked)
  returning o.*
$$;

create or replace function public.mark_email_result(p_id uuid, p_ok boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
begin
  update public.email_outbox
     set status = case when p_ok then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
         sent_at = case when p_ok then now() end,
         last_error = case when p_ok then null else left(p_error, 1000) end
   where id = p_id
  returning notification_id into o;
  if p_ok and o.notification_id is not null then
    update public.notifications set email_sent_at = now() where id = o.notification_id;
  end if;
end;
$$;
revoke execute on function public.claim_email_batch(integer) from public, anon, authenticated;
revoke execute on function public.mark_email_result(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_email_batch(integer) to service_role;
grant execute on function public.mark_email_result(uuid, boolean, text) to service_role;

-- -----------------------------------------------------------------------------
-- O que o fornecedor deve (base do escalonamento, regra 8)
-- Itens aguardando o SQE (D enviada, NC aguardando análise...) não entram.
-- -----------------------------------------------------------------------------
create or replace function app.supplier_owed_items()
returns table (
  kind text, entity_table text, entity_id uuid, supplier_id uuid, ref text, detail text, due_at timestamptz, link text
)
language sql
stable
security definer
set search_path = ''
as $$
  select 'eight_d_step', 'eight_d_steps', st.id, st.supplier_id, n.number, st.discipline, st.due_at, '/ncs/' || n.id
    from public.eight_d_steps st
    join public.ncs n on n.id = st.nc_id
   where st.status in ('not_started', 'draft', 'rejected') and st.cancelled_at is null
     and n.type = '8d' and n.status = 'open' and n.cancelled_at is null
  union all
  select 'simple_nc', 'ncs', n.id, n.supplier_id, n.number, n.title, n.response_due_at, '/ncs/' || n.id
    from public.ncs n
   where n.type = 'simple' and n.status = 'open' and n.response_due_at is not null and n.cancelled_at is null
  union all
  select 'finding', 'findings', f.id, f.supplier_id, a.number, left(f.description, 120),
         ((f.response_due + 1)::timestamp at time zone app.tz()) - interval '1 second',
         '/audits/' || a.id || '?tab=findings'
    from public.findings f
    join public.audits a on a.id = f.audit_id
   where f.status = 'open' and f.response_due is not null and f.cancelled_at is null and a.cancelled_at is null
  union all
  select 'nc_cost', 'nc_costs', c.id, c.supplier_id, n.number, c.description,
         c.created_at + make_interval(days => app.setting_numeric('cost_response_days', 10)::int),
         '/ncs/' || n.id || '?tab=costs'
    from public.nc_costs c
    join public.ncs n on n.id = c.nc_id
   where c.status = 'launched' and c.chargeable and c.cancelled_at is null and n.cancelled_at is null
$$;

-- Escalonamento diário. Cada nível dispara uma vez por pendência e prazo
-- (prazo prorrogado = novo ciclo). p_today permite simular datas nos testes.
create or replace function app.run_escalation(p_today date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, app.local_today());
  v_tz    text := app.tz();
  i       record;
  r       record;
  s       record;
  v_due   date;
  v_late  integer;
  v_key   text;
  v_params jsonb;
  v_rcpt  uuid;
  c       record;
  v_count integer := 0;
begin
  for i in select * from app.supplier_owed_items() loop
    v_due := (i.due_at at time zone v_tz)::date;
    v_late := v_today - v_due;
    if v_late < 0 then
      continue;
    end if;
    select x.legal_name, x.responsible_sqe_id, x.country_code into s from public.suppliers x where x.id = i.supplier_id;
    v_params := jsonb_build_object('kind', i.kind, 'ref', i.ref, 'detail', coalesce(i.detail, ''),
                                   'supplier', s.legal_name, 'due', v_due::text, 'daysLate', v_late);
    for r in select * from public.escalation_rules
              where active and cancelled_at is null and days_after_due <= v_late
              order by days_after_due loop
      v_key := format('esc:%s:%s:%s:%s', i.entity_table, i.entity_id, v_due, r.days_after_due);
      -- Usuários do app (in-app + e-mail pela fila)
      for v_rcpt in
        select x from (
          select app.supplier_user_ids(i.supplier_id) as x where r.notify_supplier_users
          union
          select s.responsible_sqe_id where r.notify_responsible_sqe
          union
          -- Fornecedor sem SQE responsável: o nível do SQE vai para o SQM.
          select u.id from public.users u
           where r.notify_responsible_sqe and s.responsible_sqe_id is null and u.role = 'sqm' and u.cancelled_at is null
          union
          select u.id from public.users u where r.notify_sqm and u.role = 'sqm' and u.cancelled_at is null
        ) t where x is not null
      loop
        v_count := v_count + app.notify(v_rcpt, 'deadline_overdue', i.entity_table, i.entity_id, i.supplier_id,
                                        v_params || jsonb_build_object('level', r.days_after_due), i.link,
                                        v_key || ':' || v_rcpt);
      end loop;
      -- Contatos do fornecedor sem login (Qualidade, Direção...): só e-mail.
      for c in
        select ct.id, ct.email, ct.full_name from public.contacts ct
         where ct.supplier_id = i.supplier_id and ct.cancelled_at is null
           and ct.role_code = any (r.contact_role_codes) and ct.email is not null
           and not exists (select 1 from public.users u where lower(u.email) = lower(ct.email) and u.cancelled_at is null)
      loop
        v_count := v_count + app.enqueue_email(c.email, c.full_name, null,
                                               case when s.country_code = 'BR' then 'pt-BR' else 'en' end,
                                               'deadline_overdue',
                                               v_params || jsonb_build_object('level', r.days_after_due, 'asContact', true),
                                               i.link, null, v_key || ':c:' || c.id);
      end loop;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- Prazo chegando: um aviso ao fornecedor quando faltam até N dias.
create or replace function app.run_due_soon()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := app.local_today();
  v_tz    text := app.tz();
  v_days  integer := app.setting_numeric('due_soon_days', 2)::int;
  i       record;
  v_due   date;
  v_rcpt  uuid;
  v_count integer := 0;
begin
  if v_days <= 0 then
    return 0;
  end if;
  for i in select * from app.supplier_owed_items() loop
    v_due := (i.due_at at time zone v_tz)::date;
    if v_due - v_today between 1 and v_days then
      for v_rcpt in select app.supplier_user_ids(i.supplier_id) loop
        v_count := v_count + app.notify(v_rcpt, 'deadline_soon', i.entity_table, i.entity_id, i.supplier_id,
          jsonb_build_object('kind', i.kind, 'ref', i.ref, 'detail', coalesce(i.detail, ''), 'due', v_due::text,
                             'days', v_due - v_today,
                             'supplier', (select legal_name from public.suppliers where id = i.supplier_id)),
          i.link, format('soon:%s:%s:%s:%s', i.entity_table, i.entity_id, v_due, v_rcpt));
      end loop;
    end if;
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pendências por usuário ("Minhas pendências" e resumo diário)
--   grp: review (aguardando o SQE) · overdue (fornecedor atrasado) ·
--        due (o que o fornecedor deve) · week (agenda dos próximos 7 dias) ·
--        expiring (certificados vencendo/vencidos)
-- SQE: fornecedores sob sua responsabilidade. SQM: todos. Fornecedor: só o dele.
-- -----------------------------------------------------------------------------
create or replace function app.pending_items_for(p_user uuid)
returns table (
  grp text, kind text, entity_table text, entity_id uuid, supplier_id uuid, supplier_name text,
  responsible_sqe_id uuid, ref text, detail text, due_at timestamptz, link text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  u        record;
  v_today  date := app.local_today();
  v_alert  integer := coalesce((select max(x::int) from jsonb_array_elements_text(
                        app.setting_json('certificate_alert_days', '[60,30,7]')) x), 60);
begin
  select x.id, x.role, x.supplier_id into u from public.users x where x.id = p_user and x.cancelled_at is null;
  if u.id is null then
    return;
  end if;

  if u.role = 'supplier' then
    return query
      select case when o.due_at < now() then 'overdue' else 'due' end, o.kind, o.entity_table, o.entity_id, o.supplier_id,
             s.legal_name, s.responsible_sqe_id, o.ref, o.detail, o.due_at, o.link
        from app.supplier_owed_items() o join public.suppliers s on s.id = o.supplier_id
       where o.supplier_id = u.supplier_id;
    return query
      select 'week', 'audit', 'audits', a.id, a.supplier_id, s.legal_name, s.responsible_sqe_id, a.number, a.title,
             a.planned_start::timestamptz, '/audits/' || a.id
        from public.audits a join public.suppliers s on s.id = a.supplier_id
       where a.supplier_id = u.supplier_id and a.cancelled_at is null and a.status in ('scheduled', 'in_progress')
         and a.planned_start between v_today and v_today + 30;
    return query
      select 'expiring', 'certificate', 'certifications', c.id, c.supplier_id, s.legal_name, s.responsible_sqe_id,
             coalesce(c.standard_name, st.code), c.certificate_number, c.valid_until::timestamptz, '/my-supplier?tab=certifications'
        from public.certifications c join public.suppliers s on s.id = c.supplier_id
        left join public.standards st on st.id = c.standard_id
       where c.supplier_id = u.supplier_id and c.cancelled_at is null and c.valid_until <= v_today + v_alert;
    return;
  end if;

  -- Internos: fornecedores visíveis para a lista.
  return query
    with sup as (
      select s.id, s.legal_name, s.responsible_sqe_id from public.suppliers s
       where s.cancelled_at is null and (u.role = 'sqm' or s.responsible_sqe_id = u.id)
    )
    -- Aguardando o SQE
    select 'review', 'eight_d_review', 'eight_d_steps', st.id, sup.id, sup.legal_name, sup.responsible_sqe_id,
           n.number, st.discipline, st.submitted_at, '/ncs/' || n.id
      from public.eight_d_steps st join public.ncs n on n.id = st.nc_id join sup on sup.id = st.supplier_id
     where st.status = 'submitted' and st.cancelled_at is null and n.cancelled_at is null and n.status <> 'closed'
    union all
    select 'review', 'simple_nc_review', 'ncs', n.id, sup.id, sup.legal_name, sup.responsible_sqe_id, n.number, n.title,
           n.updated_at, '/ncs/' || n.id
      from public.ncs n join sup on sup.id = n.supplier_id
     where n.type = 'simple' and n.status = 'awaiting_sqe' and n.cancelled_at is null
    union all
    select 'review', 'effectiveness_check', 'ncs', n.id, sup.id, sup.legal_name, sup.responsible_sqe_id, n.number, n.title,
           n.updated_at, '/ncs/' || n.id
      from public.ncs n join sup on sup.id = n.supplier_id
     where n.status = 'effectiveness_check' and n.cancelled_at is null
    union all
    select 'review', 'finding_review', 'findings', f.id, sup.id, sup.legal_name, sup.responsible_sqe_id, a.number,
           left(f.description, 120), f.responded_at, '/audits/' || a.id || '?tab=findings'
      from public.findings f join public.audits a on a.id = f.audit_id join sup on sup.id = f.supplier_id
     where f.status = 'responded' and f.cancelled_at is null
    union all
    select 'review', 'finding_verify', 'findings', f.id, sup.id, sup.legal_name, sup.responsible_sqe_id, a.number,
           left(f.description, 120), f.action_due_date::timestamptz, '/audits/' || a.id || '?tab=findings'
      from public.findings f join public.audits a on a.id = f.audit_id join sup on sup.id = f.supplier_id
     where f.status = 'action_accepted' and f.cancelled_at is null and f.action_due_date <= v_today + 7
    union all
    select 'review', 'waiver_review', 'waivers', w.id, sup.id, sup.legal_name, sup.responsible_sqe_id, w.number,
           w.description, w.created_at, '/inspections/waivers'
      from public.waivers w join sup on sup.id = w.supplier_id
     where w.status = 'requested' and w.cancelled_at is null
    union all
    select 'review', 'cost_contested', 'nc_costs', c.id, sup.id, sup.legal_name, sup.responsible_sqe_id, n.number,
           c.description, c.responded_at, '/ncs/' || n.id || '?tab=costs'
      from public.nc_costs c join public.ncs n on n.id = c.nc_id join sup on sup.id = c.supplier_id
     where c.status = 'contested' and c.cancelled_at is null
    union all
    -- Fornecedor atrasado
    select 'overdue', o.kind, o.entity_table, o.entity_id, sup.id, sup.legal_name, sup.responsible_sqe_id, o.ref, o.detail,
           o.due_at, o.link
      from app.supplier_owed_items() o join sup on sup.id = o.supplier_id
     where o.due_at < now()
    union all
    -- Agenda da semana
    select 'week', 'audit', 'audits', a.id, sup.id, sup.legal_name, sup.responsible_sqe_id, a.number, a.title,
           a.planned_start::timestamptz, '/audits/' || a.id
      from public.audits a join sup on sup.id = a.supplier_id
     where a.cancelled_at is null and a.status in ('scheduled', 'in_progress') and a.planned_start <= v_today + 7
       and coalesce(a.planned_end, a.planned_start) >= v_today
    union all
    select 'week', 'inspection', 'inspections', i.id, sup.id, sup.legal_name, sup.responsible_sqe_id, i.number,
           null, i.inspected_on::timestamptz, '/inspections/' || i.id
      from public.inspections i join sup on sup.id = i.supplier_id
     where i.cancelled_at is null and i.status = 'in_progress' and i.type_code <> 'self_inspection'
       and i.inspected_on between v_today - 7 and v_today + 7
    union all
    -- Vencimentos
    select 'expiring', 'certificate', 'certifications', c.id, sup.id, sup.legal_name, sup.responsible_sqe_id,
           coalesce(c.standard_name, st.code), c.certificate_number, c.valid_until::timestamptz,
           '/suppliers/' || sup.id || '?tab=certifications'
      from public.certifications c join sup on sup.id = c.supplier_id
      left join public.standards st on st.id = c.standard_id
     where c.cancelled_at is null and c.valid_until <= v_today + v_alert
    union all
    select 'expiring', 'waiver', 'waivers', w.id, sup.id, sup.legal_name, sup.responsible_sqe_id, w.number,
           w.description, w.valid_until::timestamptz, '/inspections/waivers'
      from public.waivers w join sup on sup.id = w.supplier_id
     where w.status = 'approved' and w.cancelled_at is null and w.valid_until <= v_today + 7;
end;
$$;

-- Versão para a tela: sempre do usuário logado; due_on/days_left no fuso configurado.
create or replace function public.my_pending_items()
returns table (
  grp text, kind text, entity_table text, entity_id uuid, supplier_id uuid, supplier_name text,
  responsible_sqe_id uuid, ref text, detail text, due_at timestamptz, link text, due_on date, days_left integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.*, (p.due_at at time zone app.tz())::date, (p.due_at at time zone app.tz())::date - app.local_today()
    from app.pending_items_for(auth.uid()) p
$$;
grant execute on function public.my_pending_items() to authenticated;

-- Resumo diário por e-mail (SQE por padrão; perfis em app_settings.daily_digest).
create or replace function app.enqueue_daily_digest()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg   jsonb := app.setting_json('daily_digest', '{"enabled": true, "roles": ["sqe"]}');
  v_today date := app.local_today();
  u       record;
  v_items jsonb;
  v_count integer := 0;
begin
  if not coalesce((v_cfg ->> 'enabled')::boolean, true) then
    return 0;
  end if;
  for u in
    select x.id, x.email, x.full_name, x.language from public.users x
     where x.cancelled_at is null and x.email_notifications
       and x.role::text in (select jsonb_array_elements_text(coalesce(v_cfg -> 'roles', '["sqe"]')))
  loop
    select jsonb_agg(jsonb_build_object('grp', p.grp, 'kind', p.kind, 'ref', p.ref, 'detail', coalesce(p.detail, ''),
                                        'supplier', p.supplier_name,
                                        'due', to_char(p.due_at at time zone app.tz(), 'YYYY-MM-DD'), 'link', p.link)
                     order by array_position(array['review', 'overdue', 'week', 'expiring'], p.grp), p.due_at nulls last)
      into v_items
      from app.pending_items_for(u.id) p;
    if v_items is null then
      continue;
    end if;
    v_count := v_count + app.enqueue_email(u.email, u.full_name, u.id, u.language::text, 'daily_digest',
      jsonb_build_object('date', v_today::text, 'count', jsonb_array_length(v_items), 'items', v_items), '/',
      null, format('digest:%s:%s', u.id, v_today));
  end loop;
  return v_count;
end;
$$;

-- Rotina diária completa (chamada pela Edge Function).
create or replace function public.run_daily_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  if auth.role() is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_res := jsonb_build_object(
    'escalation', app.run_escalation(),
    'due_soon', app.run_due_soon(),
    'digest', app.enqueue_daily_digest());
  return v_res;
end;
$$;
revoke execute on function public.run_daily_jobs() from public, anon, authenticated;
grant execute on function public.run_daily_jobs() to service_role;

-- -----------------------------------------------------------------------------
-- pg_cron → Edge Function "notifications" (URL e segredo no Vault)
--   vault: project_url (ex.: https://<ref>.supabase.co) e service_role_key
-- -----------------------------------------------------------------------------
create or replace function app.call_notifications_function(p_task text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
begin
  if v_url is null or v_secret is null then
    raise notice 'notifications: vault secrets project_url/service_role_key ausentes';
    return null;
  end if;
  return net.http_post(
    url := v_url || '/functions/v1/notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('task', p_task),
    timeout_milliseconds := 60000);
end;
$$;

-- 06:00 em Brasília: escalonamento, prazos chegando e resumo diário; a cada 5 min: envio da fila.
select cron.schedule('daily-notifications', '0 9 * * *', $$select app.call_notifications_function('daily')$$);
select cron.schedule('send-emails', '*/5 * * * *', $$select app.call_notifications_function('send')$$);

-- -----------------------------------------------------------------------------
-- Exportação completa da base (só SQM): lista de tabelas exportáveis.
-- -----------------------------------------------------------------------------
create or replace function public.export_tables()
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_sqm() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by 1;
end;
$$;
grant execute on function public.export_tables() to authenticated;

revoke execute on all functions in schema app from public, anon, authenticated;

-- >>>>>>>>>> 20261024000700_review.sql
-- =============================================================================
-- Etapa 7 — revisão de RLS e regras de negócio
--   * SQE só altera usuários e anexos de fornecedores sob sua responsabilidade
--     (achado pelo teste automático 08_rls_review: antes valia para qualquer fornecedor).
--   * SQE só convida usuários para fornecedores sob sua responsabilidade.
--   * Regra 13 (parte do MVP): o conteúdo de um anexo não muda; alterar um
--     documento = enviar nova versão (supersedes_id). O ciclo de aprovação com
--     congelamento de documentos é do módulo PPAP (fase 2, prompt 8).
-- =============================================================================

drop policy users_update on public.users;
create policy users_update on public.users for update to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_sqm())
    or ((select public.current_app_role()) = 'sqe' and role = 'supplier' and public.can_manage_supplier(supplier_id))
  )
  with check (
    id = (select auth.uid())
    or (select public.is_sqm())
    or ((select public.current_app_role()) = 'sqe' and role = 'supplier' and public.can_manage_supplier(supplier_id))
  );

create or replace function public.can_invite(p_role public.app_role, p_supplier_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_app_role() = 'sqm' then true
    when public.current_app_role() = 'sqe' then
      p_role = 'supplier'
      and exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.cancelled_at is null)
      and public.can_manage_supplier(p_supplier_id)
    else false
  end
$$;

-- Anexos: interno altera os do fornecedor que gerencia (ou internos sem fornecedor).
drop policy attachments_update on public.attachments;
create policy attachments_update on public.attachments for update to authenticated
  using (
    ((select public.is_internal()) and (supplier_id is null or public.can_manage_supplier(supplier_id)))
    or (supplier_id = (select public.current_supplier_id()) and not internal_only)
  )
  with check (
    ((select public.is_internal()) and (supplier_id is null or public.can_manage_supplier(supplier_id)))
    or (supplier_id = (select public.current_supplier_id()) and not internal_only)
  );

-- Regra 13 (MVP): arquivo e vínculo de um anexo são imutáveis; muda-se só
-- descrição, visibilidade interna e cancelamento. Nova versão = novo anexo.
create or replace function app.tg_attachments_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.storage_bucket, new.storage_path, new.file_name, new.mime_type, new.size_bytes, new.entity_table, new.entity_id,
      new.supplier_id, new.version, new.supersedes_id)
     is distinct from
     (old.storage_bucket, old.storage_path, old.file_name, old.mime_type, old.size_bytes, old.entity_table, old.entity_id,
      old.supplier_id, old.version, old.supersedes_id) then
    raise exception 'attachment_new_version_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger attachments_immutable before update on public.attachments
  for each row execute function app.tg_attachments_immutable();

revoke execute on all functions in schema app from public, anon, authenticated;

-- >>>>>>>>>> 20261025000800_needs_password.sql
-- =============================================================================
-- Primeiro acesso: quem entrou pelo link do convite (o e-mail padrão do Supabase
-- já devolve a sessão) ainda não escolheu a senha. O app consulta needs_password()
-- e manda a pessoa para "Definir senha" antes de usar o sistema.
-- password_set_at é gravado ao definir a senha ou ao entrar com e-mail e senha.
-- Quem entra pela Microsoft (outro provedor) não precisa de senha.
-- =============================================================================
alter table public.users add column password_set_at timestamptz;

create or replace function public.needs_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p.password_set_at is null
         and not exists (select 1 from auth.identities i where i.user_id = p.id and i.provider <> 'email')
    from public.users p
   where p.id = auth.uid() and p.cancelled_at is null
$$;
revoke execute on function public.needs_password() from public, anon;
grant execute on function public.needs_password() to authenticated;

-- O próprio usuário registra que já tem senha (chamado pelo app ao definir a senha
-- ou ao entrar com e-mail e senha).
create or replace function public.mark_password_set()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users set password_set_at = coalesce(password_set_at, now()) where id = auth.uid()
$$;
revoke execute on function public.mark_password_set() from public, anon;
grant execute on function public.mark_password_set() to authenticated;

-- >>>>>>>>>> registro das migrations aplicadas
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261024000100', 'foundation'),
  ('20261024000200', 'master_data'),
  ('20261024000300', 'nc_8d'),
  ('20261024000400', 'audits'),
  ('20261024000500', 'inspections'),
  ('20261024000600', 'notifications_export'),
  ('20261024000700', 'review'),
  ('20261025000800', 'needs_password')
on conflict (version) do nothing;

select 'SQM App: banco criado com sucesso' as resultado;
