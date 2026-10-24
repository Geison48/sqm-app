-- Etapa 3 (M4 NC e 8D): regras 1, 5, 6, 7, 8, 12 e 16.
begin;
select plan(49);

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
create or replace function pg_temp.step(p_nc uuid, p_d text) returns uuid language sql as $$
  select id from public.eight_d_steps where nc_id = p_nc and discipline = p_d
$$;
grant execute on function pg_temp.step(uuid, text) to authenticated;

-- Atalhos: NC1 = 8D do A (D3 com o SQE), NC2 = simples do B, NC3 = 8D crítica do A
-- SQE 02 (resp. A) · SQE2 03 (resp. B) · usuário A a1 · usuário B b1

-- ================================================================ regra 5
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select ok(
  (public.suggest_8d('minor', false, '30000000-0000-4000-8000-000000000001', 'delamination') -> 'reasons') ? 'recurrence',
  'Regra 5: mesmo modo de falha no mesmo PN em 12 meses → sugere 8D (reincidência)');
select is(
  (public.suggest_8d('minor', false, '30000000-0000-4000-8000-000000000003', 'porosity') ->> 'suggest')::boolean, false,
  'NC menor, sem reincidência e sem cliente → não sugere 8D');
select ok(
  (public.suggest_8d('minor', true, null, null) -> 'reasons') ? 'customer_affected',
  'Cliente final afetado → sugere 8D');
insert into public.ncs (supplier_id, component_id, type, origin_code, severity_code, failure_mode_code, title, description)
values ('10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000001', 'simple', 'receiving_plant',
        'minor', 'delamination', 'Reincidência', 'Nova delaminação no mesmo PN');
select is(
  (select suggestion_reasons from public.ncs where title = 'Reincidência'), array['recurrence'],
  'Sugestão fica registrada na NC, mas a decisão (simples) foi do SQE');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.suggest_8d('major', false, null, null)$$, '42501', 'forbidden',
  'Fornecedor não consulta sugestão');
select throws_ok(
  $$insert into public.ncs (supplier_id, type, origin_code, severity_code, title, description)
    values ('10000000-0000-4000-8000-00000000000a', 'simple', 'audit', 'minor', 'x', 'y')$$,
  '42501', null, 'Fornecedor não abre NC');
select pg_temp.logout();

-- ================================================================ isolamento / regra 1
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select is_empty($$select 1 from public.ncs where supplier_id = '10000000-0000-4000-8000-00000000000b'$$,
  'Fornecedor A não vê NCs do B');
select is((select count(*)::int from public.nc_costs where nc_id = '60000000-0000-4000-8000-000000000001'), 1,
  'Regra 1: fornecedor vê só o custo cobrável, não o interno');
select is_empty($$select 1 from public.nc_comments where internal$$, 'Regra 1: fornecedor não vê comentário interno');
select throws_ok(
  $$insert into public.nc_comments (nc_id, body, internal) values ('60000000-0000-4000-8000-000000000001', 'x', true)$$,
  '42501', null, 'Fornecedor não cria comentário interno');
select lives_ok(
  $$insert into public.nc_comments (nc_id, body) values ('60000000-0000-4000-8000-000000000001', 'Laudo enviado em anexo.')$$,
  'Fornecedor comenta na própria NC');
select is_empty('select 1 from public.lessons_learned', 'Fornecedor não lê lições aprendidas');
select pg_temp.logout();

create temp table ids as select pg_temp.step('60000000-0000-4000-8000-000000000001', 'D4') as d4;
grant select on ids to authenticated;
select pg_temp.login_as('00000000-0000-4000-8000-0000000000b1');
select is_empty($$select 1 from public.eight_d_steps where nc_id = '60000000-0000-4000-8000-000000000001'$$,
  'Fornecedor B não enxerga o 8D do A');
select throws_ok(
  $$select public.save_8d_step((select d4 from ids), '{}', false)$$,
  '42501', 'forbidden', 'Fornecedor B não altera o 8D do A nem com o id em mãos');
select pg_temp.logout();

-- ================================================================ regra 6 e 8
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select is((select pending_with from public.nc_overview where id = '60000000-0000-4000-8000-000000000001'), 'sqe',
  'Regra 8: com D enviada, a pendência está com o SQE');
select throws_ok(
  $$update public.ncs set status = 'closed' where id = '60000000-0000-4000-8000-000000000001'$$,
  'P0001', 'nc_workflow_only', 'Status da NC não muda por UPDATE direto');
select throws_ok(
  $$select public.save_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D4'), '{}', true)$$,
  '42501', 'forbidden', 'SQE não responde 8D (responde o fornecedor)');
select throws_ok(
  $$select public.review_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3'), false, '  ')$$,
  '23514', 'rejection_comment_required', 'Regra 6: reprovação exige comentário');
select lives_ok(
  $$select public.review_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3'), false,
            'Falta incluir o estoque em trânsito na contenção')$$,
  'SQE reprova a D3 com comentário');
select is(
  (select decision from public.eight_d_step_versions v where v.step_id = pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3') and version = 1),
  'rejected', 'Versão 1 da D3 registra a reprovação');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$insert into public.containment_actions (nc_id, location_code, sn_or_lot, qty_checked, qty_ok, qty_nok)
    values ('60000000-0000-4000-8000-000000000001', 'transit', 'Contêiner 7', 4, 4, 0)$$,
  'Com a D3 reprovada, o fornecedor volta a editar a contenção');
select lives_ok(
  $$select public.save_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3'),
            '{"summary":"Inclui trânsito","all_stock_covered":true}', true)$$,
  'Fornecedor reenvia a D3');
select is(
  (select current_version from public.eight_d_steps where id = pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3')), 2,
  'Regra 6: reenvio gera nova versão');
select is(
  (select jsonb_array_length(content -> 'containment') from public.eight_d_step_versions
    where step_id = pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3') and version = 2), 3,
  'A versão guarda a foto da tabela de contenção');
select throws_ok(
  $$insert into public.containment_actions (nc_id, location_code, qty_checked) values ('60000000-0000-4000-8000-000000000001', 'plant', 1)$$,
  'P0001', 'step_locked', 'Contenção travada enquanto a D3 está com o SQE');
select lives_ok(
  $$select public.save_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D4'),
            '{"occurrence_root_cause":"Tempo de infusão","non_detection_root_cause":"Ultrassom amostral"}', true)$$,
  'Fornecedor envia a D4 antes de a D3 ser aprovada (rascunho livre)');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.review_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D4'), true, null)$$,
  'P0001', 'previous_discipline_not_approved', 'Regra 6: D4 não é aprovada antes da D3');
select lives_ok($$select public.review_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3'), true, null)$$,
  'SQE aprova a D3');
select lives_ok($$select public.review_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D4'), true, 'OK')$$,
  'Depois aprova a D4');
select pg_temp.logout();

-- ================================================================ regra 7
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select lives_ok($$
  select public.save_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', d), '{"text":"ok"}', true)
    from unnest(array['D5', 'D6', 'D8']) d
$$, 'Fornecedor envia D5, D6 e D8');
select throws_ok(
  $$select public.save_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D7'), '{"pfmea_revision":"PF-12 rev 4"}', true)$$,
  '23514', 'd7_requires_pfmea_cp', 'Regra 7: D7 sem Plano de Controle (nem justificativa) não é aceita');
select lives_ok(
  $$select public.save_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D7'),
            '{"pfmea_revision":"PF-12 rev 4","control_plan_revision":"PC-A-0001 rev 4"}', true)$$,
  'D7 com PFMEA e Plano de Controle é enviada');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok($$
  select public.review_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', d), true, null)
    from unnest(array['D5', 'D6', 'D7', 'D8']) d
$$, 'SQE aprova D5 a D8 em ordem');
select is((select status from public.ncs where id = '60000000-0000-4000-8000-000000000001'), 'effectiveness_check',
  'Com todas as Ds aprovadas, a NC vai para verificação de eficácia');
select throws_ok(
  $$select public.close_8d('60000000-0000-4000-8000-000000000001', 'Delaminação', 'Infusão', 'Controle de tempo', '{}')$$,
  '23514', 'effectiveness_not_verified', 'Regra 7: não fecha sem eficácia verificada');
update public.ncs set effectiveness_method = 'quantity', effectiveness_target = '5 lotes sem reincidência',
       effectiveness_result = '5 lotes inspecionados, 0 NOK', effectiveness_verified = true
 where id = '60000000-0000-4000-8000-000000000001';
select isnt((select effectiveness_verified_by from public.ncs where id = '60000000-0000-4000-8000-000000000001'), null,
  'Eficácia registra quem verificou');
select throws_ok(
  $$select public.close_8d('60000000-0000-4000-8000-000000000001', 'Delaminação', '  ', 'Controle', '{}')$$,
  '23514', 'lesson_learned_required', 'Regra 7: não fecha sem lição aprendida');
select lives_ok(
  $$select public.close_8d('60000000-0000-4000-8000-000000000001', 'Delaminação na raiz', 'Tempo de infusão abaixo do especificado',
            'Intertravamento do tempo de infusão no CLP', array['infusão', 'delaminação'])$$,
  'Fecha o 8D com tudo atendido');
select is((select status from public.ncs where id = '60000000-0000-4000-8000-000000000001'), 'closed', 'NC fechada');
select is((select count(*)::int from public.lessons_learned where nc_id = '60000000-0000-4000-8000-000000000001'), 1,
  'Lição aprendida registrada');
select throws_ok(
  $$update public.ncs set title = 'mudar' where id = '60000000-0000-4000-8000-000000000001'$$,
  'P0001', 'nc_closed', 'NC fechada não é editada');
select pg_temp.logout();

-- ================================================================ regra 12 (custos)
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$select public.respond_nc_cost((select id from public.nc_costs where nc_id = '60000000-0000-4000-8000-000000000001'), false, '')$$,
  '23514', 'justification_required', 'Contestação exige justificativa');
select lives_ok(
  $$select public.respond_nc_cost((select id from public.nc_costs where nc_id = '60000000-0000-4000-8000-000000000001'), false,
            'Ultrassom já previsto no contrato')$$,
  'Fornecedor contesta o custo');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$update public.nc_costs set status = 'accepted' where nc_id = '60000000-0000-4000-8000-000000000001' and chargeable$$,
  'P0001', 'cost_response_only_by_supplier', 'SQE não marca custo como aceito pelo fornecedor');
update public.nc_costs set unit_amount = 2500 where nc_id = '60000000-0000-4000-8000-000000000001' and chargeable;
select is((select status from public.nc_costs where nc_id = '60000000-0000-4000-8000-000000000001' and chargeable), 'launched',
  'Contestação volta ao SQE; valor revisado retorna ao fornecedor');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$select public.respond_nc_cost((select id from public.nc_costs where nc_id = '60000000-0000-4000-8000-000000000001'), true, null)$$,
  'Fornecedor aceita o valor revisado');
select pg_temp.logout();

-- ================================================================ NC simples
select pg_temp.login_as('00000000-0000-4000-8000-0000000000b1');
select lives_ok($$select public.respond_simple_nc('60000000-0000-4000-8000-000000000002', 'Retrabalho feito e reinspecionado 100%')$$,
  'Fornecedor responde a NC simples');
select pg_temp.logout();
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select lives_ok($$select public.review_simple_nc('60000000-0000-4000-8000-000000000002', true, 'Evidência ok')$$,
  'SQE aceita e fecha a NC simples');
select pg_temp.logout();

-- ================================================================ regra 16
select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select throws_ok($$delete from public.ncs where id = '60000000-0000-4000-8000-000000000003'$$, '42501', null,
  'Regra 16: NC não é apagada');
select pg_temp.logout();

select * from finish();
rollback;
