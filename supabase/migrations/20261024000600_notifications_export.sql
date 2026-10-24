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
