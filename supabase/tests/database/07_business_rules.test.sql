-- Etapa 7: um teste por regra de negócio do SPEC (seção "Regras de negócio").
-- Os arquivos 01–06 e 08 cobrem cada regra em detalhe; aqui fica o mapa 1 → 16.
begin;
select plan(25);

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
create temp table ids as
select (select id from public.audits where supplier_id = '10000000-0000-4000-8000-00000000000c') as aud_c,
       (select id from public.nc_costs where chargeable and status = 'launched' limit 1) as cost;
grant select on ids to authenticated;
-- SQM 01 · SQE 02 (A e C) · SQE2 03 (B) · fornecedor A a1 · fornecedor B b1
-- NC1 = 8D do A (D3 com o SQE) · AUD C = GWI agendada

-- ---------------------------------------------------------------- regra 1
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select is_empty($$select 1 from public.ncs where supplier_id <> '10000000-0000-4000-8000-00000000000a'
                  union all select 1 from public.audits where supplier_id <> '10000000-0000-4000-8000-00000000000a'
                  union all select 1 from public.nc_costs where not chargeable
                  union all select 1 from public.nc_comments where internal$$,
  'R1: fornecedor não vê outro fornecedor, notas alheias, custo interno nem comentário interno');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 2
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$select public.change_supplier_status('10000000-0000-4000-8000-00000000000a', 'blocked', ' ')$$,
  '23514', null, 'R2: mudança de status sem justificativa é bloqueada');
select throws_ok($$update public.suppliers set status_code = 'controlled_shipment' where id = '10000000-0000-4000-8000-00000000000a'$$,
  'P0001', null, 'R2: status (inclusive embarque controlado) não muda por UPDATE direto, só pela ação do SQE');
select public.change_supplier_status('10000000-0000-4000-8000-00000000000a', 'conditionally_approved', 'Reincidência de NC');
select ok(exists(select 1 from public.supplier_status_history where supplier_id = '10000000-0000-4000-8000-00000000000a'
                 and justification = 'Reincidência de NC'), 'R2: mudança fica no histórico com a justificativa');
select pg_temp.logout();

-- ---------------------------------------------------------------- regras 3 e 4
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select public.start_audit((select aud_c from ids));
update public.audit_answers set result = 'minor_nc' where audit_id = (select aud_c from ids);
insert into public.findings (audit_id, classification, description) values ((select aud_c from ids), 'major_nc', 'Sem controle de recebimento');
select ok((select n.type = '8d' from public.findings f join public.ncs n on n.id = f.nc_id
            where f.audit_id = (select aud_c from ids) and f.classification = 'major_nc'),
  'R4: achado NC maior abre NC 8D vinculada');
select is(public.complete_audit((select aud_c from ids), null) ->> 'classification', 'C', 'Auditoria termina com C');
select is((select status_code from public.suppliers where id = '10000000-0000-4000-8000-00000000000c'), 'in_qualification',
  'R3: a nota só sugere; o status não muda sozinho');
select is((select status_suggestion from public.audits where id = (select aud_c from ids)), 'controlled_shipment',
  'R3: sugestão de embarque controlado registrada para o SQE decidir');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 5
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select ok((public.suggest_8d('critical', false, null, null) ->> 'suggest')::boolean
          and (public.suggest_8d('minor', true, null, null) ->> 'suggest')::boolean
          and not (public.suggest_8d('minor', false, null, null) ->> 'suggest')::boolean,
  'R5: sugere 8D por severidade ou cliente afetado; NC menor isolada não');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 6
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$select public.review_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3'), false, '')$$,
  '23514', null, 'R6: reprovar uma D exige comentário');
select public.review_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3'), false, 'Falta o estoque em trânsito');
select pg_temp.logout();
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select public.save_8d_step(pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3'), '{"summary":"Inclui trânsito"}', true);
select is((select current_version from public.eight_d_steps where id = pg_temp.step('60000000-0000-4000-8000-000000000001', 'D3')), 2,
  'R6: a D reprovada volta ao fornecedor e o reenvio gera nova versão');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 7
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$select public.close_8d('60000000-0000-4000-8000-000000000001', 'x', 'y', 'z', '{}', null)$$,
  'P0001', null, 'R7: 8D não fecha sem todas as Ds aprovadas, PFMEA/PC, eficácia e lição aprendida');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 8
select is_empty($$select 1 from app.supplier_owed_items() o join public.eight_d_steps s on s.id = o.entity_id where s.status = 'submitted'$$,
  'R8: D aguardando análise do SQE não escala');

-- ---------------------------------------------------------------- regra 9
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
insert into public.inspections (id, supplier_id, component_id, type_code)
values ('99100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000001', 'final_supplier');
select throws_ok($$select public.add_inspection_unit('99100000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003')$$,
  'P0001', 'unit_not_green', 'R9: SQE só inspeciona peça verde (amarela = reparo aberto)');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 10
set local app.inspection_workflow = 'on';
update public.waivers set valid_until = current_date - 1 where id = '92000000-0000-4000-8000-000000000001';
set local app.inspection_workflow = 'off';
select app.expire_waivers();
select is((select status from public.waivers where id = '92000000-0000-4000-8000-000000000001'), 'expired',
  'R10: concessão vencida expira sozinha');

-- ---------------------------------------------------------------- regra 11
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.verify_finding((select id from public.findings where supplier_id = '10000000-0000-4000-8000-00000000000a' limit 1), 'ok')$$,
  '42501', null, 'R11: só o SQE verifica a eficácia do achado');
select pg_temp.logout();
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$select public.verify_finding((select id from public.findings where supplier_id = '10000000-0000-4000-8000-00000000000a' and status = 'open' limit 1), 'Verificado em visita à fábrica')$$,
  'P0001', null, 'R11: achado sem plano de ação aceito não fecha');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 12
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.respond_nc_cost((select cost from ids), false, '')$$, '23514', null,
  'R12: contestação de custo exige justificativa');
select public.respond_nc_cost((select cost from ids), false, 'Ultrassom já estava previsto no contrato');
select pg_temp.logout();
select is((select status from public.nc_costs where id = (select cost from ids)), 'contested', 'R12: contestação volta para o SQE decidir');

-- ---------------------------------------------------------------- regra 13 (MVP)
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
insert into public.attachments (id, entity_table, entity_id, supplier_id, storage_path, file_name)
values ('99200000-0000-4000-8000-000000000001', 'suppliers', '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a',
        '10000000-0000-4000-8000-00000000000a/r13/doc-v1.pdf', 'doc.pdf');
select throws_ok($$update public.attachments set storage_path = '10000000-0000-4000-8000-00000000000a/r13/outro.pdf'
                    where id = '99200000-0000-4000-8000-000000000001'$$,
  'P0001', 'attachment_new_version_required', 'R13: documento não é sobrescrito; alteração = nova revisão');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 14
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select public.generate_audit_plan(2027);
select is_empty($$select 1 from public.audits where plan_id = (select id from public.audit_plans where year = 2027) and status <> 'planned'$$,
  'R14: auditorias do plano não aprovado ficam só planejadas');
select public.submit_audit_plan((select id from public.audit_plans where year = 2027));
select throws_ok($$select public.review_audit_plan((select id from public.audit_plans where year = 2027), true, null)$$,
  '42501', null, 'R14: só o SQM aprova o plano anual');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 15 (MVP)
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$insert into public.audit_template_items (template_id, element_code, item_code, question_pt, question_en, sort_order)
                   select id, 'X', 'X.1', 'x', 'x', 999 from public.audit_templates where status = 'active' limit 1$$,
  'P0001', 'template_not_draft', 'R15: importação não grava em modelo em uso; entra num rascunho que o SQE revisa e ativa');
select pg_temp.logout();

-- ---------------------------------------------------------------- regra 16
select throws_ok($$delete from public.ncs where id = '60000000-0000-4000-8000-000000000002'$$, 'P0001', null,
  'R16: registros não são apagados');
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok($$update public.ncs set cancelled_at = now() where id = '60000000-0000-4000-8000-000000000003'$$, '23514', null,
  'R16: cancelamento exige motivo');
select pg_temp.logout();

select * from finish();
rollback;
