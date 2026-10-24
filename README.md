# SQM App

Sistema de gestão da qualidade de fornecedores (auditorias, inspeções, NC/8D) para o time de SQE/SQM e o portal dos fornecedores. A especificação completa, que é a fonte da verdade, está em [`SPEC.md`](SPEC.md).

**Stack:** Next.js 16 (App Router) + TypeScript · Tailwind 4 + shadcn/ui · next-intl (pt-BR/en) · Supabase (Postgres + RLS, Auth, Storage, Edge Functions, pg_cron) · Resend · @react-pdf/renderer · Vercel.

## Status das etapas

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1 | Fundação: login, convites, perfis, menu, idiomas, RLS, audit_log, anexos | ✅ |
| 2 | M1 Cadastros | — |
| 3 | M4 NC e 8D | — |
| 4 | M2 Auditorias | — |
| 5 | M3 Inspeções | — |
| 6 | M5 Notificações + M10 Exportação | — |
| 7 | PWA offline, revisão e entrega | — |

---

## Rodando localmente

Pré-requisitos: Node 20+ e Docker (o Supabase local roda em containers).

```bash
npm install
npm run db:start              # sobe o Supabase local (1ª vez baixa as imagens)
npx supabase status -o env    # mostra URL e chaves locais
cp .env.example .env.local    # preencha com os valores do comando acima
npm run db:reset              # aplica migrations + dados fictícios (seed)
npm run dev                   # http://localhost:3000
```

Em `.env.local`, use `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `PUBLISHABLE_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SECRET_KEY` → `SUPABASE_SECRET_KEY`.

### Usuários de teste (somente local, senha `Senha12345`)

| E-mail | Perfil | Observação |
|---|---|---|
| `sqm@sqm.local` | SQM | |
| `sqe@sqm.local` | SQE | responsável pelo Fornecedor A |
| `sqe2@sqm.local` | SQE | responsável pelo Supplier B (idioma en) |
| `qualidade@fornecedor-a.local` | Fornecedor A | |
| `quality@supplier-b.local` | Fornecedor B | idioma en |

Os e-mails enviados localmente (convites, redefinição de senha) **não saem para a internet**: abra o Mailpit em http://127.0.0.1:54324 para vê-los.

### Testes

```bash
npm run test:db     # pgTAP: RLS, isolamento A×B, proibição de DELETE, audit_log (dentro do banco)
npm test            # Vitest: isolamento A×B pela API e Storage + paridade das traduções
npm run lint
npm run typecheck
```

Os testes usam os dados do seed. Rode `npm run db:reset` antes se o banco tiver sido alterado à mão.

---

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | URL do projeto Supabase (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + local | Chave pública (*publishable*). A segurança vem da RLS. |
| `SUPABASE_SECRET_KEY` | Vercel + local | Chave secreta (*secret* / service role). **Só no servidor**, nunca com prefixo `NEXT_PUBLIC_`. Usada para enviar convites. |
| `NEXT_PUBLIC_SITE_URL` | Vercel + local | URL pública do app, ex.: `https://sqm-app.vercel.app`. Usada nos links de e-mail. |
| `NEXT_PUBLIC_AUTH_AZURE_ENABLED` | Vercel + local | `true` mostra o botão "Entrar com Microsoft". Ligue só depois de configurar o provedor Azure. |

Variáveis que entram nas próximas etapas: `RESEND_API_KEY` e `EMAIL_FROM` (etapa 6).

---

## Deploy (Supabase na nuvem + Vercel)

### 1. Supabase

1. Crie um projeto em https://supabase.com/dashboard. Escolha a região **South America (São Paulo)** e guarde a senha do banco.
2. Aplique as migrations a partir do seu computador:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push          # NÃO rode o seed.sql em produção
   ```
3. Em **Authentication → Sign In / Providers**:
   - desligue **Allow new users to sign up** (acesso só por convite);
   - mantenha **Email** ligado;
   - senha: mínimo 8 caracteres, com letras e números.
4. Em **Authentication → URL Configuration**:
   - **Site URL**: a URL da Vercel (ex.: `https://sqm-app.vercel.app`);
   - **Redirect URLs**: `https://sqm-app.vercel.app/**`.
5. Em **Authentication → Emails → Templates**, cole o conteúdo de:
   - `supabase/templates/invite.html` em **Invite user** (assunto: `SQM App — Convite / Invitation`);
   - `supabase/templates/recovery.html` em **Reset password** (assunto: `SQM App — Redefinir senha / Reset password`).
   Os templates escolhem PT ou EN pelo idioma definido no convite.
6. **E-mail:** o envio padrão do Supabase tem limite baixo (poucos e-mails por hora) e serve só para testes. Para produção, configure SMTP próprio em **Authentication → Emails → SMTP Settings**. O Resend entra aqui quando houver um domínio verificado.

### 2. Vercel

1. Importe o repositório em https://vercel.com/new (framework detectado: Next.js).
2. Cadastre as variáveis de ambiente da tabela acima, com os valores de **Project Settings → API Keys** do Supabase.
3. Faça o deploy. Cada push na branch principal gera um novo deploy automático.

### 3. Primeiro SQM

Os outros usuários são convidados pela tela **Usuários**, mas o primeiro SQM é criado pela linha de comando, apontando para o projeto de produção:

```bash
# .env.local apontando para o Supabase de produção (URL, SECRET_KEY e SITE_URL de produção)
npm run create-sqm -- --email maria@empresa.com --name "Maria Silva"
```

O SQM recebe um e-mail, clica no link e define a senha.

### 4. Convidar SQEs e fornecedores

- **SQM** → menu **Usuários** → **Convidar usuário** → escolhe o perfil (SQE, SQM ou Fornecedor), o idioma e, para fornecedor, a empresa.
- **SQE** → pode convidar apenas usuários de fornecedor.
- O convidado recebe o e-mail no idioma escolhido, define a senha e entra. Quem não foi convidado não entra, nem com conta Microsoft.

### 5. Login Microsoft (opcional)

1. No Azure (Entra ID), registre um app com redirect URI `https://<ref>.supabase.co/auth/v1/callback`.
2. No Supabase, em **Authentication → Providers → Azure**, informe Client ID, Secret e a URL `https://login.microsoftonline.com/<tenant-id>`.
3. Na Vercel, defina `NEXT_PUBLIC_AUTH_AZURE_ENABLED=true`.

O tenant da Goldwind pode exigir aprovação do administrador de TI. Enquanto isso, os internos usam e-mail e senha normalmente. Para entrar com Microsoft, a pessoa precisa ter sido convidada com o **mesmo e-mail** da conta Microsoft.

---

## Arquitetura e convenções

- **Segurança no banco:** toda tabela tem RLS. As funções `current_app_role()`, `current_supplier_id()`, `is_internal()`, `can_access_supplier()` e `can_manage_supplier()` concentram as regras. Fornecedor só vê linhas com o próprio `supplier_id`. SQE lê tudo, mas edita só os fornecedores sob sua responsabilidade. SQM edita tudo.
  - A função se chama `current_app_role()`, e não `current_role()`, porque `CURRENT_ROLE` é palavra reservada do PostgreSQL e devolveria o papel do banco em vez do perfil do usuário.
- **Tabela de negócio nova:** crie a tabela e rode `select app.setup_business_table('public.tabela')`. Isso adiciona `created_*`, `updated_*` e `cancelled_*`/`cancel_reason`, liga o `audit_log`, bloqueia DELETE e exige motivo no cancelamento. Para tabelas com `supplier_id`, use `select app.apply_default_supplier_policies('public.tabela')` e ajuste o que for específico.
- **Nada é apagado:** cancelar = `cancelled_at` + `cancel_reason` (mínimo 3 caracteres). Registro cancelado fica congelado.
- **Textos:** todos em `messages/pt-BR.json` e `messages/en.json`. O teste `tests/i18n.test.ts` falha se faltar chave em um dos idiomas.
- **Configurações** ficam em tabelas (`app_settings` e as próximas), editáveis por SQE/SQM.
- **Anexos:** bucket privado `attachments`, com caminho `<supplier_id | internal>/<uuid>/<arquivo>`. `internal_only = true` nunca aparece para o fornecedor.
