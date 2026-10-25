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
