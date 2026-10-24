-- =============================================================================
-- SQM App — transforma o usuário convidado no painel no PRIMEIRO SQM.
-- Antes: Authentication → Users → Add user → Send invitation, com o e-mail do SQM.
-- 1. Troque o e-mail e o nome abaixo (e 'pt-BR' por 'en' se a pessoa preferir inglês).
-- 2. Cole no SQL Editor e clique em Run LOGO depois do convite (antes de a pessoa clicar no e-mail).
-- Os demais usuários (SQEs e fornecedores) são convidados pela tela "Usuários" do app.
-- =============================================================================
insert into public.users (id, full_name, email, role, language, invited_at)
select u.id, '<NOME COMPLETO>', lower(u.email), 'sqm', 'pt-BR', now()
  from auth.users u
 where lower(u.email) = lower('<EMAIL DO SQM>');

select case when count(*) = 1 then 'SQM criado: ' || max(email)
            else 'Nenhum usuário encontrado: confira o e-mail e se o convite foi enviado' end as resultado
  from public.users where role = 'sqm' and lower(email) = lower('<EMAIL DO SQM>');
