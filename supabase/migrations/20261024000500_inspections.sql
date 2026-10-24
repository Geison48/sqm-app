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
