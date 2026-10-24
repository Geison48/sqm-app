-- Regra 1 / critério de aceite: usuário do fornecedor A não vê dados do fornecedor B.
-- Executar com: npx supabase test db
begin;
select plan(20);

-- Simula uma requisição autenticada de um usuário (mesmo caminho da API).
create or replace function pg_temp.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------- fornecedor A
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');

select is(public.current_app_role(), 'supplier'::public.app_role, 'A: perfil é supplier');
select is(public.current_supplier_id(), '10000000-0000-4000-8000-00000000000a'::uuid, 'A: current_supplier_id é A');

select results_eq(
  'select id from public.suppliers',
  $$values ('10000000-0000-4000-8000-00000000000a'::uuid)$$,
  'A: lista de fornecedores contém só A');

select is_empty(
  $$select 1 from public.suppliers where id = '10000000-0000-4000-8000-00000000000b'$$,
  'A: buscar B pelo id (URL direta) não retorna nada');

select is_empty(
  $$select 1 from public.attachments where supplier_id = '10000000-0000-4000-8000-00000000000b'$$,
  'A: não vê anexos de B');

select is_empty(
  $$select 1 from public.attachments where internal_only$$,
  'A: não vê anexos internos, nem do próprio fornecedor');

select is(
  (select count(*)::int from public.attachments), 1,
  'A: vê exatamente o próprio anexo público');

select is_empty(
  $$select 1 from public.users where supplier_id = '10000000-0000-4000-8000-00000000000b'$$,
  'A: não vê usuários de B');

select is_empty(
  'select 1 from public.audit_log',
  'A: não lê o log de auditoria');

select throws_ok(
  $$insert into public.attachments (entity_table, entity_id, supplier_id, storage_path, file_name)
    values ('suppliers', '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b',
            '10000000-0000-4000-8000-00000000000b/x/hack.pdf', 'hack.pdf')$$,
  '42501', null,
  'A: não consegue gravar anexo em nome de B');

-- UPDATE em linha invisível não afeta nada.
update public.suppliers set legal_name = 'hack' where id = '10000000-0000-4000-8000-00000000000b';
select pg_temp.logout();
select is(
  (select legal_name from public.suppliers where id = '10000000-0000-4000-8000-00000000000b'),
  'Supplier B Castings Co.',
  'A: tentativa de alterar B não tem efeito');

-- ---------------------------------------------------------------- fornecedor B
select pg_temp.login_as('00000000-0000-4000-8000-0000000000b1');

select results_eq(
  'select id from public.suppliers',
  $$values ('10000000-0000-4000-8000-00000000000b'::uuid)$$,
  'B: lista de fornecedores contém só B');

select is_empty(
  $$select 1 from public.attachments where supplier_id = '10000000-0000-4000-8000-00000000000a'$$,
  'B: não vê anexos de A');

select pg_temp.logout();

-- ---------------------------------------------------------------- SQE e SQM
select pg_temp.login_as('00000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.suppliers), 3, 'SQE: lê todos os fornecedores');
select is((select count(*)::int from public.attachments), 3, 'SQE: vê anexos internos');

-- SQE edita só os fornecedores sob sua responsabilidade (A é dele, B não).
update public.suppliers set legal_name = 'Fornecedor A Compósitos S.A.'
 where id = '10000000-0000-4000-8000-00000000000a';
update public.suppliers set legal_name = 'hack' where id = '10000000-0000-4000-8000-00000000000b';
select pg_temp.logout();
select is(
  (select legal_name from public.suppliers where id = '10000000-0000-4000-8000-00000000000a'),
  'Fornecedor A Compósitos S.A.', 'SQE: edita fornecedor sob sua responsabilidade');
select is(
  (select legal_name from public.suppliers where id = '10000000-0000-4000-8000-00000000000b'),
  'Supplier B Castings Co.', 'SQE: não edita fornecedor de outro SQE');

-- ---------------------------------------------------------------- regra 16 + log
select pg_temp.login_as('00000000-0000-4000-8000-000000000001');
select throws_ok(
  $$delete from public.suppliers where id = '10000000-0000-4000-8000-00000000000a'$$,
  '42501', null,
  'SQM: DELETE é negado (só cancelamento com motivo)');

select throws_ok(
  $$update public.suppliers set cancelled_at = now() where id = '10000000-0000-4000-8000-00000000000a'$$,
  '23514', null,
  'Cancelar sem motivo é bloqueado');

select ok(
  exists(select 1 from public.audit_log
          where table_name = 'suppliers'
            and record_id = '10000000-0000-4000-8000-00000000000a'
            and action = 'update'
            and before ->> 'legal_name' = 'Fornecedor A Compósitos Ltda'
            and after  ->> 'legal_name' = 'Fornecedor A Compósitos S.A.'
            and actor_id = '00000000-0000-4000-8000-000000000002'),
  'audit_log registrou quem, antes e depois da alteração');

select * from finish();
rollback;
