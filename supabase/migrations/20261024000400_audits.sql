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
