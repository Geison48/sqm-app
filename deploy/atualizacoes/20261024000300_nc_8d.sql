-- SQM App — atualização 20261024000300 (nc_8d). Gerado por `npm run build:deploy`.
-- Cole tudo no SQL Editor e clique em Run. Se já foi aplicada, para com aviso e não muda nada.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'supabase_migrations')
     and exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000300') then
    raise exception 'Atualização 20261024000300 já aplicada: nada a fazer.';
  end if;
end $$;

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

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('20261024000300', 'nc_8d') on conflict (version) do nothing;
select 'Atualização 20261024000300 aplicada com sucesso' as resultado;
