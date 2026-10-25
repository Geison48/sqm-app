-- Primeiro acesso: quem entrou pelo link do convite sem definir senha é mandado definir.
begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'convidado@teste.local', '', now(), now()),
       ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'microsoft@teste.local', '', now(), now());
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-0000000000f2', 'ms-123', 'azure', '{"sub":"ms-123"}', now(), now());

create or replace function pg_temp.needs(p_user uuid) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v := public.needs_password();
  reset role;
  return v;
end $$;

insert into public.users (id, full_name, email, role) values ('00000000-0000-4000-8000-0000000000f1', 'Convidado', 'convidado@teste.local', 'sqm'), ('00000000-0000-4000-8000-0000000000f2', 'Microsoft', 'microsoft@teste.local', 'sqe');
create or replace function pg_temp.login_as_mark(p_user uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_password_set();
  reset role;
end $f$;

select is(pg_temp.needs('00000000-0000-4000-8000-0000000000f1'), true, 'Convidado que entrou pelo link sem senha precisa definir a senha');
select is(pg_temp.needs('00000000-0000-4000-8000-000000000002'), false, 'Usuário com senha segue normalmente');
select is(pg_temp.needs('00000000-0000-4000-8000-0000000000f2'), false, 'Quem entra pela Microsoft não precisa de senha');
select pg_temp.login_as_mark('00000000-0000-4000-8000-0000000000f1');
select is(pg_temp.needs('00000000-0000-4000-8000-0000000000f1'), false, 'Depois de definir a senha, não pede mais');
select throws_ok($$set local role anon; select public.needs_password()$$, '42501', null, 'Anônimo não chama a função');

select * from finish();
rollback;
