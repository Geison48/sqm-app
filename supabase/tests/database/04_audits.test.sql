-- Etapa 4 (M2 Auditorias): cálculo VDA 6.3/GWI e regras 3, 4, 11 e 14.
begin;
select plan(46);

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

create temp table ids as
select (select id from public.audits where supplier_id = '10000000-0000-4000-8000-00000000000a') as aud_a,
       (select id from public.audits where supplier_id = '10000000-0000-4000-8000-00000000000b') as aud_b,
       (select id from public.audits where supplier_id = '10000000-0000-4000-8000-00000000000c') as aud_c;
grant select on ids to authenticated;
-- SQM 01 · SQE 02 (A, C) · SQE2 03 (B) · fornecedor A a1 · fornecedor B b1

-- ================================================================ VDA 6.3 (seed)
select is((select score_percent from public.audits where id = (select aud_a from ids)), 88.60::numeric(5,2),
  'VDA 6.3: EG = 124 / 140 = 88,6%');
select is((select classification from public.audits where id = (select aud_a from ids)), 'B', 'VDA 6.3: 88,6% → B');
select is((select downgrade_reasons from public.audits where id = (select aud_a from ids)), array['element_to_b:P6', 'star4_to_b'],
  'Motivos registrados: P6 < 80% e pergunta * com 4');

-- ================================================================ VDA 6.3 (cenários)
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
update public.audits set template_id = '70000000-0000-4000-8000-000000000002' where id = (select aud_b from ids);
select lives_ok($$select public.start_audit((select aud_b from ids))$$, 'SQE2 inicia a auditoria do B (plano aprovado)');
update public.audit_answers set score = 10 where audit_id = (select aud_b from ids);
select is(public.audit_score((select aud_b from ids)) ->> 'classification', 'A', 'Tudo 10 → 100% A');
update public.audit_answers set score = 0 where audit_id = (select aud_b from ids) and item_code = '6.4';
select is(public.audit_score((select aud_b from ids)) ->> 'classification', 'B',
  'Pergunta (não *) com 0 → B (EG 92,9%, P6 = 75%)');
update public.audit_answers set score = 0 where audit_id = (select aud_b from ids) and item_code = '2.2';
select is(public.audit_score((select aud_b from ids)) ->> 'classification', 'C',
  'Elemento P2 com 50% (< 70%) → C');
update public.audit_answers set score = 10 where audit_id = (select aud_b from ids) and item_code in ('2.2', '6.4');
update public.audit_answers set score = 0 where audit_id = (select aud_b from ids) and item_code = '7.1';
select is(public.audit_score((select aud_b from ids)) ->> 'classification', 'C', 'Pergunta * com 0 → C');
update public.audit_answers set score = 10 where audit_id = (select aud_b from ids) and item_code = '7.1';
update public.audit_answers set score = 6 where audit_id = (select aud_b from ids) and item_code in ('3.2');
update public.audit_answers set score = 0, not_applicable = false where audit_id = (select aud_b from ids) and item_code = '3.1';
select ok((public.audit_score((select aud_b from ids)) -> 'reasons') ? 'element_to_c:P3', 'Elemento < 70% → motivo de rebaixamento para C');
update public.audit_answers set score = 10 where audit_id = (select aud_b from ids) and item_code in ('3.1', '3.2');
update public.audit_answers set not_applicable = true where audit_id = (select aud_b from ids) and item_code = '6.4';
select is((public.audit_score((select aud_b from ids)) ->> 'percent')::numeric, 100.0, 'Pergunta N/A fica fora do cálculo');
select pg_temp.logout();

-- ================================================================ GWI
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok($$select public.start_audit((select aud_c from ids))$$, 'SQE inicia auditoria GWI do C');
select is((select count(*)::int from public.audit_answers where audit_id = (select aud_c from ids)), 7,
  'Checklist montado pelo escopo (gestão + recebimento + inspeção final)');
select throws_ok($$update public.audit_answers set score = 10 where audit_id = (select aud_c from ids)$$,
  '23514', 'wrong_scoring_method', 'GWI não aceita pontuação 0–10');
update public.audit_answers set result = 'conform' where audit_id = (select aud_c from ids);
update public.audit_answers set result = 'not_applicable' where audit_id = (select aud_c from ids) and item_code = 'R.2';
select is((public.audit_score((select aud_c from ids)) ->> 'percent')::numeric, 100.0, 'GWI: conformes ÷ aplicáveis');
update public.audit_answers set result = 'major_nc' where audit_id = (select aud_c from ids) and item_code = 'G.1';
select is(public.audit_score((select aud_c from ids)) ->> 'percent', '83.3', 'GWI: 5 conformes de 6 aplicáveis = 83,3%');
select is(public.audit_score((select aud_c from ids)) ->> 'classification', 'B', 'GWI: 83,3% → B');
select pg_temp.logout();

-- ================================================================ regra 4
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
insert into public.findings (audit_id, classification, description, requirement)
values ((select aud_c from ids), 'major_nc', 'Indicadores de qualidade inexistentes', 'GWI G.1');
select ok(
  (select n.type = '8d' and n.origin_code = 'audit' and n.finding_id = f.id
     from public.findings f join public.ncs n on n.id = f.nc_id
    where f.audit_id = (select aud_c from ids) and f.classification = 'major_nc'),
  'Regra 4: NC maior abre NC 8D de origem auditoria, vinculada ao achado');
insert into public.findings (audit_id, classification, description)
values ((select aud_c from ids), 'minor_nc', 'Instrumento com etiqueta de calibração vencida');
select is((select count(*)::int from public.ncs where finding_id in (select id from public.findings where audit_id = (select aud_c from ids))), 1,
  'NC menor não abre NC');
select pg_temp.logout();

-- ================================================================ visibilidade do fornecedor
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.audits), 1, 'Fornecedor A vê só a própria auditoria');
select is((select count(*)::int from public.findings), 2, 'Fornecedor vê os achados após o relatório');
select is((select count(*)::int from public.audit_answers), 14, 'Fornecedor vê as respostas após o relatório');
select is_empty('select 1 from public.audit_plans', 'Fornecedor não vê o plano anual');
select pg_temp.logout();

-- ================================================================ regra 3
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
update public.audit_answers set result = null where audit_id = (select aud_c from ids) and item_code = 'G.2';
select throws_ok($$select public.complete_audit((select aud_c from ids))$$, 'P0001', 'unanswered_items',
  'Não conclui com pergunta sem resposta');
update public.audit_answers set result = 'major_nc' where audit_id = (select aud_c from ids) and result is null;
update public.audit_answers set result = 'minor_nc' where audit_id = (select aud_c from ids) and item_code in ('F.1', 'F.2');
select is(public.complete_audit((select aud_c from ids)) ->> 'classification', 'C', 'Auditoria GWI concluída com C');
select is((select status_suggestion from public.audits where id = (select aud_c from ids)), 'controlled_shipment',
  'Regra 3: classificação C sugere embarque controlado');
select is((select status_code from public.suppliers where id = '10000000-0000-4000-8000-00000000000c'), 'in_qualification',
  'Regra 3: o status NÃO muda sozinho');
select throws_ok($$update public.audit_answers set comment = 'x' where audit_id = (select aud_c from ids)$$,
  'P0001', 'audit_not_in_progress', 'Respostas travadas depois da conclusão');
select throws_ok($$select public.resolve_audit_status_suggestion((select aud_c from ids), true, '')$$,
  '23514', 'justification_required', 'Aplicar a sugestão exige justificativa');
select lives_ok($$select public.resolve_audit_status_suggestion((select aud_c from ids), true, 'Auditoria classificação C')$$,
  'SQE confirma a sugestão');
select is((select status_code from public.suppliers where id = '10000000-0000-4000-8000-00000000000c'), 'controlled_shipment',
  'Status alterado pelo SQE, com histórico');
select pg_temp.logout();

-- ================================================================ regra 11
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.verify_finding((select id from public.findings where audit_id = (select aud_a from ids) and classification = 'minor_nc'), 'ok, verificado')$$,
  'P0001', 'action_not_accepted', 'Regra 11: achado sem plano de ação aceito não fecha');
select pg_temp.logout();
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$select public.respond_finding((select id from public.findings where classification = 'minor_nc'), 'x', '', null)$$,
  '23514', 'action_plan_required', 'Plano de ação exige ação, responsável e prazo');
select lives_ok(
  $$select public.respond_finding((select id from public.findings where classification = 'minor_nc'),
            'Etiquetar e segregar NOK em área dedicada', 'Ana', current_date + 15)$$,
  'Fornecedor responde o plano de ação no portal');
select pg_temp.logout();
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.review_finding((select id from public.findings where audit_id = (select aud_a from ids) and classification = 'minor_nc'), true, null)$$,
  'SQE aceita o plano de ação');
select throws_ok(
  $$select public.verify_finding((select id from public.findings where audit_id = (select aud_a from ids) and classification = 'minor_nc'), '')$$,
  '23514', 'effectiveness_comment_required', 'Verificação de eficácia exige comentário');
select lives_ok(
  $$select public.verify_finding((select id from public.findings where audit_id = (select aud_a from ids) and classification = 'minor_nc'),
            'Área de segregação verificada em visita')$$,
  'Regra 11: SQE verifica eficácia e fecha o achado');
select is((select status from public.audits where id = (select aud_a from ids)), 'completed',
  'Auditoria segue aberta enquanto houver achado aberto');
select throws_ok(
  $$select public.verify_finding((select id from public.findings where audit_id = (select aud_c from ids) and classification = 'major_nc'), 'verificado em campo')$$,
  'P0001', 'linked_nc_open', 'NC maior só fecha após o 8D vinculado fechar');
select pg_temp.logout();

-- ================================================================ regra 14
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select lives_ok($$select public.generate_audit_plan(2027)$$, 'SQE gera o plano 2027 pela criticidade');
select is((select array_agg(s.criticality order by s.criticality) from public.audits a join public.suppliers s on s.id = a.supplier_id
            where a.plan_id = (select id from public.audit_plans where year = 2027)), array['A', 'A']::char(1)[],
  'Plano 2027: A (12 meses) entram; C auditado em 2026 (36 meses) fica de fora');
select throws_ok(
  $$select public.start_audit((select id from public.audits where plan_id = (select id from public.audit_plans where year = 2027) limit 1))$$,
  'P0001', 'plan_not_approved', 'Regra 14: auditoria de plano não aprovado não inicia');
select lives_ok($$select public.submit_audit_plan((select id from public.audit_plans where year = 2027))$$, 'SQE envia o plano ao SQM');
select throws_ok($$select public.review_audit_plan((select id from public.audit_plans where year = 2027), true, null)$$,
  '42501', 'forbidden', 'SQE não aprova o plano');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.audits), 1, 'Fornecedor não vê auditorias de plano não aprovado');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select lives_ok($$select public.review_audit_plan((select id from public.audit_plans where year = 2027), true, null)$$,
  'SQM aprova o plano');
select pg_temp.logout();
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.audits), 2, 'Com o plano aprovado, o fornecedor vê a auditoria agendada');
select pg_temp.logout();

select * from finish();
rollback;
