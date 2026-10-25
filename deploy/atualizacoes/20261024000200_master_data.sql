-- SQM App — atualização 20261024000200 (master_data). Gerado por `npm run build:deploy`.
-- Cole tudo no SQL Editor e clique em Run. Se já foi aplicada, para com aviso e não muda nada.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'supabase_migrations')
     and exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000200') then
    raise exception 'Atualização 20261024000200 já aplicada: nada a fazer.';
  end if;
end $$;

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

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('20261024000200', 'master_data') on conflict (version) do nothing;
select 'Atualização 20261024000200 aplicada com sucesso' as resultado;
