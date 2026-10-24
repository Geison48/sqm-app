-- Etapa 2 (M1 Cadastros): regra 2, permissões por perfil, CNPJ e alertas.
begin;
select plan(31);

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

-- IDs do seed
-- SQM 01 · SQE 02 (resp. A e C) · SQE2 03 (resp. B) · usuário A a1 · usuário B b1

-- ------------------------------------------------------------ regra 2: status
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');

select throws_ok(
  $$update public.suppliers set status_code = 'blocked' where id = '10000000-0000-4000-8000-00000000000a'$$,
  'P0001', 'status_requires_justification',
  'Status não muda por UPDATE direto (sem justificativa)');

select throws_ok(
  $$select public.change_supplier_status('10000000-0000-4000-8000-00000000000a', 'controlled_shipment', '  ')$$,
  '23514', 'justification_required',
  'Mudança de status sem justificativa é bloqueada');

select lives_ok(
  $$select public.change_supplier_status('10000000-0000-4000-8000-00000000000a', 'controlled_shipment',
            'Reincidência de delaminação em 3 lotes')$$,
  'SQE responsável muda o status com justificativa');

select is(
  (select status_code from public.suppliers where id = '10000000-0000-4000-8000-00000000000a'),
  'controlled_shipment', 'Status atualizado');

select ok(exists(
  select 1 from public.supplier_status_history
   where supplier_id = '10000000-0000-4000-8000-00000000000a'
     and from_status = 'approved' and to_status = 'controlled_shipment'
     and justification = 'Reincidência de delaminação em 3 lotes'
     and created_by = '00000000-0000-4000-8000-000000000002'),
  'Histórico registra de/para, justificativa e quem');

select throws_ok(
  $$select public.change_supplier_status('10000000-0000-4000-8000-00000000000b', 'blocked', 'Tentativa indevida')$$,
  '42501', 'forbidden',
  'SQE não muda status de fornecedor de outro SQE');

select throws_ok(
  $$update public.suppliers set responsible_sqe_id = '00000000-0000-4000-8000-000000000003'
     where id = '10000000-0000-4000-8000-00000000000a'$$,
  '42501', 'only_sqm_can_reassign',
  'SQE não transfere a responsabilidade do fornecedor');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$select public.change_supplier_status('10000000-0000-4000-8000-00000000000a', 'approved', 'Quero voltar a homologado')$$,
  '42501', 'forbidden',
  'Fornecedor não muda o próprio status');
select ok(
  (select count(*) from public.supplier_status_history where supplier_id = '10000000-0000-4000-8000-00000000000a') >= 2,
  'Fornecedor vê o histórico de status da própria empresa');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select lives_ok(
  $$select public.change_supplier_status('10000000-0000-4000-8000-00000000000b', 'blocked', 'Decisão da gestão SQM')$$,
  'SQM muda status de qualquer fornecedor');
select throws_ok(
  $$update public.supplier_statuses set cancelled_at = now(), cancel_reason = 'não uso' where code = 'blocked'$$,
  'P0001', 'lookup_system_item',
  'Status de sistema não pode ser cancelado');
select lives_ok(
  $$update public.supplier_statuses set label_pt = 'Bloqueado (sem compras)' where code = 'blocked'$$,
  'Rótulo de status de sistema pode ser renomeado');
select pg_temp.logout();

-- ------------------------------------------------------------ CNPJ
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select throws_ok(
  $$insert into public.suppliers (legal_name, country_code, tax_id, responsible_sqe_id)
    values ('CNPJ inválido Ltda', 'BR', '11.222.333/0001-82', '00000000-0000-4000-8000-000000000002')$$,
  '23514', 'cnpj_invalid', 'CNPJ com dígito errado é rejeitado');
select throws_ok(
  $$insert into public.suppliers (legal_name, country_code, responsible_sqe_id)
    values ('Sem CNPJ Ltda', 'BR', '00000000-0000-4000-8000-000000000002')$$,
  '23514', 'cnpj_required', 'Fornecedor brasileiro exige CNPJ');
select lives_ok(
  $$insert into public.suppliers (legal_name, country_code, tax_id, responsible_sqe_id)
    values ('Alfanumérico Ltda', 'BR', '12.ABC.345/01DE-35', '00000000-0000-4000-8000-000000000002')$$,
  'CNPJ alfanumérico válido é aceito');
select is(
  (select tax_id from public.suppliers where legal_name = 'Alfanumérico Ltda'),
  '12ABC34501DE35', 'CNPJ gravado normalizado');
select lives_ok(
  $$insert into public.suppliers (legal_name, country_code, responsible_sqe_id)
    values ('Overseas Inc.', 'US', '00000000-0000-4000-8000-000000000002')$$,
  'Fornecedor estrangeiro não exige CNPJ');
select throws_ok(
  $$insert into public.suppliers (legal_name, country_code, tax_id, responsible_sqe_id)
    values ('De outro SQE', 'US', 'X1', '00000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'SQE não cria fornecedor em nome de outro SQE');
select pg_temp.logout();

-- ------------------------------------------------------------ portal do fornecedor
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select lives_ok(
  $$insert into public.contacts (supplier_id, role_code, full_name, email)
    values ('10000000-0000-4000-8000-00000000000a', 'logistics', 'Novo Contato', 'log@fornecedor-a.local')$$,
  'Fornecedor cadastra contato da própria empresa');
select throws_ok(
  $$insert into public.contacts (supplier_id, role_code, full_name)
    values ('10000000-0000-4000-8000-00000000000b', 'quality', 'Intruso')$$,
  '42501', null, 'Fornecedor não cadastra contato em outra empresa');
select throws_ok(
  $$insert into public.plants (supplier_id, name) values ('10000000-0000-4000-8000-00000000000a', 'Planta nova')$$,
  '42501', null, 'Fornecedor não altera plantas (só contatos e certificados)');
select results_eq(
  'select gw_code from public.components order by gw_code',
  $$values ('GW-BLD-0001'::text), ('GW-BLD-0002'::text)$$,
  'Fornecedor vê só os componentes vinculados a ele');
select is_empty('select 1 from public.standards', 'Fornecedor não vê a biblioteca de normas');
select is_empty('select 1 from public.qualifications', 'Fornecedor não vê qualificação (avaliação interna)');

update public.certifications set valid_until = current_date + 1095, certificate_number = 'BR-QMS-12345-R1'
 where supplier_id = '10000000-0000-4000-8000-00000000000a' and standard_name = 'ISO 9001:2015';
select pg_temp.logout();

select ok(exists(
  select 1 from public.notifications
   where recipient_id = '00000000-0000-4000-8000-000000000002'
     and event_code = 'certificate_updated_by_supplier'),
  'SQE é notificado quando o fornecedor atualiza certificado');

-- ------------------------------------------------------------ componentes
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
update public.components set description = 'hack' where gw_code = 'GW-BLD-0001';
select pg_temp.logout();
select isnt(
  (select description from public.components where gw_code = 'GW-BLD-0001'), 'hack',
  'SQE sem fornecedor vinculado não edita o componente');

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
update public.components set drawing_revision = 'E' where gw_code = 'GW-BLD-0001';
select pg_temp.logout();
select is(
  (select drawing_revision from public.components where gw_code = 'GW-BLD-0001'), 'E',
  'SQE responsável por fornecedor vinculado edita o componente');

-- ------------------------------------------------------------ alertas
select is(app.generate_certificate_expiry_alerts(), 0, 'Rotina de alertas é idempotente (não duplica)');

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
insert into public.certifications (supplier_id, standard_name, valid_until)
values ('10000000-0000-4000-8000-00000000000a', 'ISO 45001:2018', current_date + 30);
select pg_temp.logout();
select ok(exists(
  select 1 from public.notifications
   where event_code = 'certificate_expiring' and params ->> 'certificate' = 'ISO 45001:2018'
     and params ->> 'threshold' = '30'
     and recipient_id = '00000000-0000-4000-8000-0000000000a1'),
  'Certificado com validade em 30 dias gera alerta (critério de aceite)');

select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select ok(
  (select bool_and(recipient_id = '00000000-0000-4000-8000-0000000000a1') from public.notifications),
  'Cada usuário vê só as próprias notificações');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
insert into public.attachments (entity_table, entity_id, supplier_id, storage_path, file_name, internal_only)
values ('qualifications', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000c',
        '10000000-0000-4000-8000-00000000000c/q/risco.pdf', 'risco.pdf', false);
select pg_temp.logout();
select ok(
  (select internal_only from public.attachments where storage_path = '10000000-0000-4000-8000-00000000000c/q/risco.pdf'),
  'Anexo de qualificação é sempre interno (nunca visível ao fornecedor)');

select * from finish();
rollback;
