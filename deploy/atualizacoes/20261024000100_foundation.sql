-- SQM App — atualização 20261024000100 (foundation). Gerado por `npm run build:deploy`.
-- Cole tudo no SQL Editor e clique em Run. Se já foi aplicada, para com aviso e não muda nada.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'supabase_migrations')
     and exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000100') then
    raise exception 'Atualização 20261024000100 já aplicada: nada a fazer.';
  end if;
end $$;

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

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('20261024000100', 'foundation') on conflict (version) do nothing;
select 'Atualização 20261024000100 aplicada com sucesso' as resultado;
