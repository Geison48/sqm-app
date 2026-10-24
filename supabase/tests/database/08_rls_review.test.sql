-- Etapa 7: revisão automática de RLS em TODAS as tabelas do schema public.
-- Tabelas novas entram sozinhas nas verificações (não depende de lista manual).
begin;
select plan(14);

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

-- Tabelas com supplier_id onde o usuário logado enxerga linha de OUTRO fornecedor.
create or replace function pg_temp.leaks(p_own uuid) returns setof text language plpgsql as $$
declare
  t text;
  n bigint;
begin
  for t in
    select c.table_name from information_schema.columns c
      join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'supplier_id'
  loop
    execute format('select count(*) from public.%I where supplier_id is distinct from %L and supplier_id is not null', t, p_own) into n;
    if n > 0 then return next t || ' (' || n || ')'; end if;
  end loop;
end $$;

-- Tabelas com supplier_id onde o usuário consegue ALTERAR linha de outro fornecedor.
create or replace function pg_temp.writable(p_other uuid) returns setof text language plpgsql as $$
declare
  t text;
  n bigint;
begin
  for t in
    select c.table_name from information_schema.columns c
      join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'supplier_id'
  loop
    begin
      execute format('update public.%I set supplier_id = supplier_id where supplier_id = %L', t, p_other);
      get diagnostics n = row_count;
      if n > 0 then return next t || ' (' || n || ')'; end if;
    exception when others then
      null; -- bloqueado por gatilho/permissão: ok
    end;
  end loop;
end $$;

-- ================================================================ estrutura
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity$$,
  'Toda tabela do schema public tem RLS ligada');
select is_empty($$select tablename || ':' || policyname from pg_policies where schemaname = 'public'
                  and ('anon' = any (roles) or 'public' = any (roles))$$,
  'Nenhuma política vale para usuário anônimo');
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relkind = 'r'
                    and exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'cancelled_at')
                    and not exists (select 1 from pg_trigger g where g.tgrelid = c.oid and g.tgname = 'prevent_delete')$$,
  'Toda tabela de negócio bloqueia DELETE (regra 16)');
select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relkind = 'r'
                    and exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'cancelled_at')
                    and not exists (select 1 from pg_trigger g where g.tgrelid = c.oid and g.tgname = 'audit_log')$$,
  'Toda tabela de negócio grava audit_log (regra 16)');

-- ================================================================ leitura e escrita por fornecedor
select pg_temp.login_as('00000000-0000-4000-8000-0000000000a1');
select is_empty($$select * from pg_temp.leaks('10000000-0000-4000-8000-00000000000a')$$,
  'Fornecedor A não lê nenhuma linha de outro fornecedor, em nenhuma tabela');
select is_empty($$select * from pg_temp.writable('10000000-0000-4000-8000-00000000000b')$$,
  'Fornecedor A não altera nenhuma linha do fornecedor B, em nenhuma tabela');
select is_empty($$select 1 from public.nc_costs where not chargeable$$, 'Fornecedor não vê custo interno');
select is_empty($$select 1 from public.nc_comments where internal$$, 'Fornecedor não vê comentário interno');
select is_empty($$select 1 from public.attachments where internal_only$$, 'Fornecedor não vê anexo interno');
select is_empty($$select 1 from public.users where role = 'supplier' and supplier_id <> '10000000-0000-4000-8000-00000000000a'$$,
  'Fornecedor não vê usuários de outro fornecedor');
select is_empty($$select 'audit_log' from public.audit_log union all select 'audit_plans' from public.audit_plans
                  union all select 'audit_templates' from public.audit_templates union all select 'qualifications' from public.qualifications
                  union all select 'lessons_learned' from public.lessons_learned union all select 'standards' from public.standards
                  union all select 'email_outbox' from public.email_outbox union all select 'escalation_rules' from public.escalation_rules
                  union all select 'nc_counters' from public.nc_counters union all select 'doc_counters' from public.doc_counters$$,
  'Fornecedor não lê tabelas internas (log, plano, modelos, qualificação, lições, normas, fila, regras, contadores)');
select pg_temp.logout();

select pg_temp.login_as('00000000-0000-4000-8000-0000000000b1');
select is_empty($$select * from pg_temp.leaks('10000000-0000-4000-8000-00000000000b')$$,
  'Fornecedor B não lê nenhuma linha de outro fornecedor, em nenhuma tabela');
select is_empty($$select * from pg_temp.writable('10000000-0000-4000-8000-00000000000a')$$,
  'Fornecedor B não altera nenhuma linha do fornecedor A, em nenhuma tabela');
select pg_temp.logout();

-- SQE só altera fornecedores sob sua responsabilidade (SQE2 = B).
select pg_temp.login_as('00000000-0000-4000-8000-000000000003');
select is_empty($$select * from pg_temp.writable('10000000-0000-4000-8000-00000000000a')$$,
  'SQE não altera dados de fornecedor que não é dele');
select pg_temp.logout();

select * from finish();
rollback;
