-- Etapa 6 (M5): escalonamento (regra 8), fila de e-mails, pendências e exportação.
begin;
select plan(35);

create or replace function pg_temp.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
-- Volta o prazo de uma NC (8D ou simples) em N dias.
create or replace function pg_temp.shift(p_nc uuid, p_days int) returns void language plpgsql as $$
begin
  perform set_config('app.nc_workflow', 'on', true);
  update public.eight_d_steps set due_at = due_at - make_interval(days => p_days) where nc_id = p_nc;
  update public.ncs set response_due_at = response_due_at - make_interval(days => p_days) where id = p_nc and type = 'simple';
  perform set_config('app.nc_workflow', 'off', true);
end $$;
create or replace function pg_temp.esc(p_user uuid) returns int language sql as $$
  select count(*)::int from public.notifications where event_code = 'deadline_overdue' and recipient_id = p_user
$$;
-- NC-0001 (A): D3 enviada, aguardando o SQE · NC-0003 (A): D0–D3 venceram ontem · NC-0002 (B): NC simples
-- Usuários: SQM 01 · SQE 02 (A) · SQE2 03 (B) · fornecedor A a1 · fornecedor B b1

-- ================================================================ regra 8
select is_empty($$select 1 from app.supplier_owed_items() where entity_table = 'eight_d_steps' and entity_id in
  (select id from public.eight_d_steps where status = 'submitted')$$,
  'Regra 8: D aguardando análise do SQE não conta como atraso do fornecedor');
select ok(exists(select 1 from app.supplier_owed_items() where kind = 'nc_cost'), 'Custo lançado aguarda resposta do fornecedor');
select is_empty($$select 1 from app.supplier_owed_items() o join public.nc_costs c on c.id = o.entity_id where not c.chargeable$$,
  'Custo interno não é cobrado do fornecedor');

-- ================================================================ níveis
select ok(app.run_escalation() > 0, 'Vencimento → avisa');
select is(pg_temp.esc('00000000-0000-4000-8000-0000000000a1'), 4, 'Nível 0: fornecedor A recebe um aviso por D vencida');
select is(pg_temp.esc('00000000-0000-4000-8000-000000000002'), 0, 'Nível 0: SQE ainda não recebe');
select is(app.run_escalation(), 0, 'Um aviso por nível: rodar de novo não repete');
select ok((select count(*) from public.email_outbox where event_code = 'deadline_overdue') = 4, 'Avisos do app também vão para a fila de e-mail');

select ok(app.run_escalation(app.local_today() + 3) > 0, '+3 dias → novo nível');
select is(pg_temp.esc('00000000-0000-4000-8000-000000000002'), 4, '+3: SQE responsável recebe');
select is(pg_temp.esc('00000000-0000-4000-8000-0000000000a1'), 4, '+3: fornecedor não recebe de novo');
select is((select count(*)::int from public.email_outbox where recipient_email = 'qualidade@fornecedor-a.local' and recipient_user_id is null), 0,
  'Contato de Qualidade que já é usuário não recebe e-mail duplicado');
select is(pg_temp.esc('00000000-0000-4000-8000-000000000001'), 0, '+3: SQM ainda não recebe');

select ok(app.run_escalation(app.local_today() + 7) > 0, '+7 dias → último nível');
select is(pg_temp.esc('00000000-0000-4000-8000-000000000001'), 4, '+7: SQM recebe');
select is((select count(*)::int from public.email_outbox where recipient_email = 'direcao@fornecedor-a.local'
            and recipient_user_id is null and locale = 'pt-BR' and (params ->> 'asContact')::boolean), 4,
  '+7: contato de Direção (sem login) recebe por e-mail, em PT');

select pg_temp.shift((select id from public.ncs where number = 'NC-2026-0002'), 20);
select app.run_escalation(app.local_today() + 7);
select ok(exists(select 1 from public.email_outbox where recipient_email = 'gm@supplier-b.local' and locale = 'en'),
  'Fornecedor estrangeiro: contato de Direção recebe em inglês');
select is((select count(*)::int from public.notifications where event_code = 'deadline_overdue'
            and recipient_id = '00000000-0000-4000-8000-000000000002' and supplier_id = '10000000-0000-4000-8000-00000000000b'), 0,
  'SQE do A não é avisado sobre o B');

-- Regras configuráveis: desligar o nível +7 para de escalar ao SQM.
update public.escalation_rules set active = false where days_after_due = 7;
select pg_temp.shift('60000000-0000-4000-8000-000000000001', 30);
select app.run_escalation(app.local_today() + 7);
select is((select count(*)::int from public.notifications where event_code = 'deadline_overdue'
            and recipient_id = '00000000-0000-4000-8000-000000000001' and params ->> 'ref' = 'NC-2026-0001'), 0,
  'Nível desligado não dispara');
update public.escalation_rules set active = true where days_after_due = 7;

-- ================================================================ prazo chegando
update public.app_settings set value = '30' where key = 'due_soon_days';
select ok(app.run_due_soon() > 0, 'Prazo chegando avisa o fornecedor');
select is(app.run_due_soon(), 0, 'Prazo chegando avisa uma vez');

-- ================================================================ fila de e-mail
update public.users set email_notifications = false where id = '00000000-0000-4000-8000-0000000000b1';
select app.notify('00000000-0000-4000-8000-0000000000b1', 'nc_closed', 'ncs', null, null, '{"number":"X"}', '/ncs', 'test:off');
select is((select count(*)::int from public.email_outbox o join public.notifications n on n.id = o.notification_id
            where n.dedupe_key = 'test:off'), 0, 'Usuário com e-mail desligado só recebe no app');
update public.notification_events set send_email = false where code = 'nc_closed';
select app.notify('00000000-0000-4000-8000-000000000002', 'nc_closed', 'ncs', null, null, '{"number":"Y"}', '/ncs', 'test:event-off');
select is((select count(*)::int from public.email_outbox o join public.notifications n on n.id = o.notification_id
            where n.dedupe_key = 'test:event-off'), 0, 'Evento sem e-mail configurado não vai para a fila');

-- ================================================================ resumo diário
select ok(app.enqueue_daily_digest() >= 2, 'Resumo diário para cada SQE com pendências');
select is(app.enqueue_daily_digest(), 0, 'Um resumo por dia');
select is_empty($$select 1 from public.email_outbox o join public.users u on u.id = o.recipient_user_id
                  where o.event_code = 'daily_digest' and u.role <> 'sqe'$$, 'Resumo só para o perfil configurado (SQE)');

-- ================================================================ pendências e permissões
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select is_empty($$select 1 from public.my_pending_items() where supplier_id <> '10000000-0000-4000-8000-00000000000a'$$,
  'Fornecedor A só vê as próprias pendências');
select is_empty($$select 1 from public.my_pending_items() where grp = 'review'$$, 'Fornecedor não vê a fila de análise do SQE');
select is_empty($$select 1 from public.email_outbox$$, 'Fornecedor não lê a fila de e-mails');
select is_empty($$select 1 from public.escalation_rules$$, 'Fornecedor não lê as regras de escalonamento');
select throws_ok($$select public.run_daily_jobs()$$, '42501', null, 'Fornecedor não dispara a rotina diária');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select is_empty($$select 1 from public.my_pending_items() where supplier_id = '10000000-0000-4000-8000-00000000000a'$$,
  'SQE vê as pendências dos fornecedores sob sua responsabilidade');
select throws_ok($$select * from public.export_tables()$$, '42501', 'forbidden', 'Exportação completa é só do SQM');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select ok((select count(distinct supplier_id) from public.my_pending_items()) >= 2, 'SQM vê as pendências do time inteiro');
select ok('audit_log' in (select * from public.export_tables()), 'SQM exporta todas as tabelas, inclusive o log');
select pg_temp.logout();

select * from finish();
rollback;
