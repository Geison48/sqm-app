-- Etapa 5 (M3 Inspeções): regras 9 e 10, embarque controlado e isolamento.
begin;
select plan(37);

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
-- Peças: 0430/0431 verdes · 0432 amarela (reparo) · 0433 sem etiqueta · lote B verde
-- SQE 02 (A) · SQE2 03 (B) · fornecedor A a1 · fornecedor B b1

-- ================================================================ regra 9
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
insert into public.inspections (id, supplier_id, component_id, type_code, location)
values ('99000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000001',
        'final_supplier', 'Joinville');
select is((select plan_id from public.inspections where id = '99000000-0000-4000-8000-000000000001'),
  '80000000-0000-4000-8000-000000000001'::uuid, 'Inspeção usa o plano ativo do componente');
select throws_ok($$select public.add_inspection_unit('99000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003')$$,
  'P0001', 'unit_not_green', 'Regra 9: SQE não inspeciona peça amarela (reparo aberto)');
select throws_ok($$select public.add_inspection_unit('99000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000004')$$,
  'P0001', 'unit_not_green', 'Regra 9: SQE não inspeciona peça sem autoinspeção');
select lives_ok($$select public.add_inspection_unit('99000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001')$$,
  'SQE inclui peça verde');
select is((select count(*)::int from public.inspection_results where inspection_id = '99000000-0000-4000-8000-000000000001'), 3,
  'Uma linha de resultado por característica do plano');
select throws_ok($$update public.serial_units set tag = 'green' where id = '90000000-0000-4000-8000-000000000003'$$,
  'P0001', 'tag_workflow_only', 'Etiqueta não muda por UPDATE direto');
select throws_ok(
  $$insert into public.inspections (supplier_id, component_id, type_code) values
    ('10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000001', 'self_inspection')$$,
  'P0001', 'self_inspection_by_supplier', 'Autoinspeção é registrada pelo fornecedor');

-- Medição fora do limite → NOK automático; conclusão deixa a peça vermelha.
update public.inspection_results set measured_values = array[42.0, 42.9]
 where inspection_id = '99000000-0000-4000-8000-000000000001' and characteristic_id = '81000000-0000-4000-8000-000000000001';
select is((select ok from public.inspection_results where inspection_id = '99000000-0000-4000-8000-000000000001'
            and characteristic_id = '81000000-0000-4000-8000-000000000001'), false, 'Valor fora do limite → NOK automático');
select throws_ok($$select public.complete_inspection('99000000-0000-4000-8000-000000000001')$$,
  'P0001', 'unanswered_items', 'Não conclui com característica sem resultado');
update public.inspection_results set ok = true
 where inspection_id = '99000000-0000-4000-8000-000000000001' and characteristic_id <> '81000000-0000-4000-8000-000000000001';
select pg_temp.logout();

-- ================================================================ regra 10 (concessão)
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.review_waiver((select id from public.waivers where number = 'WVR-2026-0001'), true, null)$$,
  '42501', 'forbidden', 'Fornecedor não aprova a própria concessão');
select pg_temp.logout();
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$select public.review_waiver((select id from public.waivers where number = 'WVR-2026-0001'), false, '')$$,
  '23514', 'rejection_comment_required', 'Reprovação de concessão exige comentário');
select lives_ok($$select public.review_waiver((select id from public.waivers where number = 'WVR-2026-0001'), true, 'ok')$$,
  'SQE aprova a concessão (até 2 peças)');
select throws_ok(
  $$select public.apply_waiver((select id from public.inspection_results where inspection_id = '99000000-0000-4000-8000-000000000001'
            and characteristic_id = '81000000-0000-4000-8000-000000000002'), (select id from public.waivers where number = 'WVR-2026-0001'))$$,
  'P0001', 'waiver_not_applicable', 'Concessão não cobre outra característica');
select lives_ok(
  $$select public.apply_waiver((select id from public.inspection_results where inspection_id = '99000000-0000-4000-8000-000000000001'
            and characteristic_id = '81000000-0000-4000-8000-000000000001'), (select id from public.waivers where number = 'WVR-2026-0001'))$$,
  'NOK aceito sob concessão');
select is((select used_quantity from public.waivers where number = 'WVR-2026-0001'), 1.00::numeric(12,2), 'Concessão consome 1 unidade');
select is(public.complete_inspection('99000000-0000-4000-8000-000000000001'), 'approved', 'Peça aprovada sob concessão');
select is((select tag from public.serial_units where id = '90000000-0000-4000-8000-000000000001'), 'green', 'Peça aprovada continua verde');

-- Segunda inspeção (0431): NOK sem concessão → vermelha.
insert into public.inspections (id, supplier_id, component_id, type_code)
values ('99000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000001', 'receiving');
select public.add_inspection_unit('99000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002');
update public.inspection_results set ok = true where inspection_id = '99000000-0000-4000-8000-000000000002';
update public.inspection_results set ok = false, comment = 'Bolha 15 mm'
 where inspection_id = '99000000-0000-4000-8000-000000000002' and characteristic_id = '81000000-0000-4000-8000-000000000002';
select is(public.complete_inspection('99000000-0000-4000-8000-000000000002'), 'rejected', 'Inspeção de recebimento reprova a peça');
select is((select tag from public.serial_units where id = '90000000-0000-4000-8000-000000000002'), 'red', 'NOK → etiqueta vermelha');
select throws_ok($$update public.inspection_results set comment = 'x' where inspection_id = '99000000-0000-4000-8000-000000000002'$$,
  'P0001', 'inspection_completed', 'Inspeção concluída não é alterada');
select throws_ok(
  $$insert into public.nc_items (nc_id, supplier_id, sn_or_lot, serial_unit_id)
    select id, supplier_id, 'X', '90000000-0000-4000-8000-000000000005' from public.ncs
     where supplier_id = '10000000-0000-4000-8000-00000000000a' limit 1$$,
  'P0001', 'unit_supplier_mismatch', 'Item da NC não aponta para peça de outro fornecedor');
select pg_temp.logout();

-- Data vencida → expira sozinha (rotina diária).
set local app.inspection_workflow = 'on';
update public.waivers set valid_until = current_date - 1 where id = '92000000-0000-4000-8000-000000000001';
set local app.inspection_workflow = 'off';
select ok(app.expire_waivers() >= 1, 'Rotina diária expira concessões vencidas');
select is((select status from public.waivers where id = '92000000-0000-4000-8000-000000000001'), 'expired', 'Regra 10: concessão vencida expira sozinha');
select is(public.waiver_is_active('92000000-0000-4000-8000-000000000001'), false, 'Concessão expirada não pode ser usada');

-- ================================================================ reparo (regra 9)
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select lives_ok($$insert into public.repairs (serial_unit_id, description, performed_by)
  values ('90000000-0000-4000-8000-000000000002', 'Reparo da bolha conforme procedimento', 'Turno A')$$,
  'Fornecedor abre reparo da peça vermelha');
select is((select tag from public.serial_units where id = '90000000-0000-4000-8000-000000000002'), 'yellow', 'Reparo aberto → amarela');
select throws_ok($$insert into public.repairs (serial_unit_id, description) values ('90000000-0000-4000-8000-000000000002', 'outro')$$,
  '23505', null, 'Só um reparo aberto por peça');
select lives_ok($$select public.complete_repair((select id from public.repairs where serial_unit_id = '90000000-0000-4000-8000-000000000002' and status = 'open'), 'Concluído')$$,
  'Fornecedor conclui o reparo');
select is((select tag from public.serial_units where id = '90000000-0000-4000-8000-000000000002'), null, 'Após o reparo, aguarda nova autoinspeção');
select throws_ok(
  $$insert into public.inspections (supplier_id, component_id, type_code) values
    ('10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000001', 'final_supplier')$$,
  '42501', 'forbidden', 'Fornecedor não registra inspeção do SQE');
select is((select count(*)::int from public.inspection_plans), 1, 'Fornecedor A vê só o plano do próprio componente');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-0000000000b1');
select is_empty($$select 1 from public.serial_units where supplier_id = '10000000-0000-4000-8000-00000000000a'$$, 'B não vê peças do A');
select is_empty($$select 1 from public.inspections where supplier_id = '10000000-0000-4000-8000-00000000000a'$$, 'B não vê inspeções do A');
select is_empty($$select 1 from public.waivers where supplier_id = '10000000-0000-4000-8000-00000000000a'$$, 'B não vê concessões do A');
select pg_temp.logout();

-- ================================================================ embarque controlado
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select public.change_supplier_status('10000000-0000-4000-8000-00000000000a', 'controlled_shipment', 'Reincidência de bolhas na raiz');
select is((select start_reason from public.controlled_shipment_periods where supplier_id = '10000000-0000-4000-8000-00000000000a' and ended_at is null),
  'Reincidência de bolhas na raiz', 'Entrada em embarque controlado abre o período com o motivo');
select public.change_supplier_status('10000000-0000-4000-8000-00000000000a', 'approved', 'Três lotes consecutivos aprovados');
select is((select end_reason from public.controlled_shipment_periods where supplier_id = '10000000-0000-4000-8000-00000000000a'),
  'Três lotes consecutivos aprovados', 'Saída fecha o período com o motivo');
select throws_ok($$insert into public.controlled_shipment_periods (supplier_id, start_reason) values ('10000000-0000-4000-8000-00000000000a', 'x')$$,
  '42501', null, 'Período só nasce pela mudança manual de status (regra 2)');
select pg_temp.logout();

select * from finish();
rollback;
