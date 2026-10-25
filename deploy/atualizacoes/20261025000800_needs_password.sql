-- SQM App — atualização 20261025000800 (needs_password). Gerado por `npm run build:deploy`.
-- Cole tudo no SQL Editor e clique em Run. Se já foi aplicada, para com aviso e não muda nada.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'supabase_migrations')
     and exists (select 1 from supabase_migrations.schema_migrations where version = '20261025000800') then
    raise exception 'Atualização 20261025000800 já aplicada: nada a fazer.';
  end if;
end $$;

-- =============================================================================
-- Primeiro acesso: quem entrou pelo link do convite (o e-mail padrão do Supabase
-- já devolve a sessão) ainda não escolheu a senha. O app consulta needs_password()
-- e manda a pessoa para "Definir senha" antes de usar o sistema.
-- password_set_at é gravado ao definir a senha ou ao entrar com e-mail e senha.
-- Quem entra pela Microsoft (outro provedor) não precisa de senha.
-- =============================================================================
alter table public.users add column password_set_at timestamptz;

create or replace function public.needs_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p.password_set_at is null
         and not exists (select 1 from auth.identities i where i.user_id = p.id and i.provider <> 'email')
    from public.users p
   where p.id = auth.uid() and p.cancelled_at is null
$$;
revoke execute on function public.needs_password() from public, anon;
grant execute on function public.needs_password() to authenticated;

-- O próprio usuário registra que já tem senha (chamado pelo app ao definir a senha
-- ou ao entrar com e-mail e senha).
create or replace function public.mark_password_set()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users set password_set_at = coalesce(password_set_at, now()) where id = auth.uid()
$$;
revoke execute on function public.mark_password_set() from public, anon;
grant execute on function public.mark_password_set() to authenticated;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values ('20261025000800', 'needs_password') on conflict (version) do nothing;
select 'Atualização 20261025000800 aplicada com sucesso' as resultado;
