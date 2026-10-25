# Colocar o SQM App no ar (sem instalar nada)

Tudo é feito pelo navegador, copiando e colando os arquivos desta pasta. Reserve cerca de 40 minutos.
Faça na ordem: cada parte usa algo da anterior.

| Arquivo | Para quê |
|---|---|
| `1-banco.sql` | Cria o banco inteiro (tabelas, regras, segurança, rotinas) |
| `2-funcao-notifications.ts` | Função que envia os e-mails e faz o escalonamento |
| `3-segredos.sql` | Liga o agendador à função de e-mail |
| `4-primeiro-sqm.sql` | Cria o primeiro SQM |

Para copiar um arquivo: abra-o no GitHub (`github.com/Geison48/sqm-app/tree/main/deploy`) e clique no ícone **Copy raw file** (dois quadradinhos, no canto superior direito do arquivo).

Anote num bloco de notas, ao longo do caminho: **senha do banco**, **Project URL**, **Publishable key**, **Secret key**, **service_role** e o **endereço do site na Vercel**.

---

## Parte 1 — Criar o projeto no Supabase

1. Abra https://supabase.com/dashboard e clique em **Continue with GitHub** (usa a conta que você já criou).
2. Se pedir uma organização, crie uma (ex.: `SQM`), plano **Free**.
3. Clique em **New project**:
   - **Project name:** `sqm-app`
   - **Database password:** clique em **Generate a password** e **anote** a senha.
   - **Region:** **South America (São Paulo)**
   - Clique em **Create new project** e espere 1–2 minutos até aparecer o painel do projeto.

## Parte 2 — Criar o banco

1. No menu da esquerda, clique em **SQL Editor** → **+ New query** (ou **New SQL snippet**).
2. Copie **todo** o conteúdo de `1-banco.sql` e cole na área de texto.
3. Clique em **Run** (ou Ctrl+Enter). Se aparecer um aviso sobre "destructive operations", confirme em **Run this query**.
4. Deve aparecer embaixo: **SQM App: banco criado com sucesso**.

> Se aparecer erro de extensão (`pg_cron` ou `pg_net`): vá em **Database → Extensions**, ligue **pg_cron** e **pg_net**, e rode o arquivo de novo num **projeto novo** (o arquivo é para rodar uma vez só, num banco vazio).

## Parte 3 — Copiar as chaves do Supabase

1. **Project Settings** (engrenagem, embaixo à esquerda) → **Data API**: copie a **Project URL** (ex.: `https://abcd1234.supabase.co`).
2. **Project Settings → API Keys**:
   - copie a **Publishable key** (começa com `sb_publishable_`);
   - em **Secret keys**, clique para revelar e copie (começa com `sb_secret_`). Se não houver nenhuma, clique em **Add new secret key**;
   - aba **Legacy API Keys**: revele e copie a **service_role** (um texto longo começando com `eyJ`).

## Parte 4 — Publicar o site na Vercel

1. Abra https://vercel.com/signup e entre com **Continue with GitHub**. Plano **Hobby** (grátis).
2. Clique em **Add New… → Project** e, na lista, clique em **Import** ao lado de `sqm-app`.
   (Se o repositório não aparecer, clique em **Adjust GitHub App Permissions** e dê acesso a ele.)
3. Abra **Environment Variables** e adicione uma por uma (nome à esquerda, valor à direita):

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | a Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a Publishable key |
   | `SUPABASE_SECRET_KEY` | a Secret key (`sb_secret_...`) |
   | `NEXT_PUBLIC_SITE_URL` | `https://sqm-app.vercel.app` (ajustamos no passo 5 se for outro) |
   | `NEXT_PUBLIC_AUTH_AZURE_ENABLED` | `false` |

4. Clique em **Deploy** e espere terminar (2–4 minutos). Clique em **Continue to Dashboard**.
5. Em **Domains**, veja o endereço real do site (ex.: `https://sqm-app-xyz.vercel.app`). Se for diferente do que você colocou em `NEXT_PUBLIC_SITE_URL`:
   **Settings → Environment Variables** → edite `NEXT_PUBLIC_SITE_URL` → **Save**; depois **Deployments** → nos três pontinhos do último → **Redeploy**.

## Parte 5 — Configurar o login no Supabase

1. **Authentication → Sign In / Providers**:
   - desligue **Allow new users to sign up** (só entra quem for convidado) → **Save**;
   - confira que **Email** está ligado.
2. **Authentication → URL Configuration**:
   - **Site URL:** o endereço do site na Vercel → **Save**;
   - **Redirect URLs → Add URL:** o endereço do site seguido de `/**` (ex.: `https://sqm-app-xyz.vercel.app/**`) → **Save**.
3. **Modelos de e-mail (opcional):** sem SMTP próprio o Supabase não deixa editar os modelos, e tudo bem: o app funciona com os e-mails padrão (em inglês). Depois de configurar o SMTP (ver aviso abaixo), em **Authentication → Emails → Templates** cole `supabase/templates/invite.html` em **Invite user** (assunto `SQM App — Convite / Invitation`) e `recovery.html` em **Reset Password** (assunto `SQM App — Redefinir senha / Reset password`) para ter os e-mails bilíngues.

> **Limite de e-mails:** o envio padrão do Supabase permite poucos e-mails por hora e serve para testar. Para convidar o time inteiro, configure SMTP próprio em **Authentication → Emails → SMTP Settings** (o Resend fornece um, depois de verificar um domínio).

## Parte 6 — E-mails do app e escalonamento

1. **Edge Functions → Deploy a new function → Via Editor**.
2. Nome da função: `notifications` (exatamente assim).
3. Apague o código de exemplo, cole **todo** o conteúdo de `2-funcao-notifications.ts` e clique em **Deploy function**.
4. Na página da função, aba **Details** (ou **Settings**): desligue **Enforce JWT verification** (Verify JWT) → **Save**.
   (A função confere sozinha a chave enviada pelo agendador.)
5. **Edge Functions → Secrets** → adicione:

   | Nome | Valor |
   |---|---|
   | `SITE_URL` | o endereço do site na Vercel |
   | `EMAIL_FROM` | `SQM App <sqm@seudominio.com>` (domínio verificado no Resend) |
   | `RESEND_API_KEY` | a chave do Resend (`re_...`), quando tiver |

   Sem `RESEND_API_KEY`, os avisos ficam na fila e saem sozinhos quando a chave for cadastrada.
6. **SQL Editor → New query**: cole `3-segredos.sql`, troque `<URL DO PROJETO>` pela Project URL e `<CHAVE SERVICE_ROLE>` pela chave service_role (mantenha as aspas simples) → **Run**. Deve aparecer **Segredos gravados: 2**.

## Parte 7 — Primeiro SQM

1. **Authentication → Users → Add user → Send invitation**: digite o e-mail do SQM → **Send invitation**.
2. **Logo em seguida**, no **SQL Editor**: cole `4-primeiro-sqm.sql`, troque `<NOME COMPLETO>` e `<EMAIL DO SQM>` (nos dois lugares) → **Run**. Deve aparecer **SQM criado: ...**.
3. O SQM abre o e-mail, clica no link, define a senha e entra no site.

## Parte 8 — Conferir

Entre no site como SQM e:
- [ ] veja o menu completo e troque o idioma (PT/EN);
- [ ] em **Configurações**, revise prazos, regras de escalonamento e eventos de e-mail;
- [ ] cadastre um fornecedor e um componente;
- [ ] em **Usuários**, convide um SQE (e o SQE convida os usuários dos fornecedores dele);
- [ ] no celular, abra o site e use **Instalar app** / **Adicionar à Tela de Início**.

Pronto: a cada atualização enviada ao GitHub, a Vercel publica a nova versão sozinha.
Mudanças futuras no banco virão como novos arquivos de migration (o guia de cada atualização dirá o que colar).

---

### Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Link do convite abre e volta para o login | Confira **Site URL** e **Redirect URLs** (Parte 5) e se o `4-primeiro-sqm.sql` foi rodado |
| "Sem acesso" depois de definir a senha | O e-mail do convite e o do `4-primeiro-sqm.sql` precisam ser iguais |
| E-mail de convite não chega | Veja a caixa de spam; o envio padrão do Supabase tem limite por hora (configure SMTP) |
| Avisos do app não chegam por e-mail | Falta `RESEND_API_KEY`/`EMAIL_FROM` (Parte 6) ou o `3-segredos.sql` |
| Site da Vercel dá erro ao abrir | Confira as 5 variáveis da Parte 4 e faça **Redeploy** |

---

## Atualizações do banco (projeto que já está no ar)

Quando uma versão nova do app trouxer mudanças no banco, aparece um arquivo novo em `deploy/atualizacoes/`.
O `1-banco.sql` é **só para projeto novo**; num projeto que já existe, use as atualizações:

1. Abra o arquivo novo em `deploy/atualizacoes/` no GitHub e copie (**Copy raw file**).
2. **SQL Editor → New query**, cole e clique em **Run** (se aparecer o aviso de RLS, escolha **Run without RLS**).
3. Deve aparecer **Atualização ... aplicada com sucesso**. Se aparecer **"já aplicada: nada a fazer"**, ela já tinha sido rodada: tudo certo.

| Atualização | O que muda | Quem precisa rodar |
|---|---|---|
| `20261025000800_needs_password.sql` | Quem entrou pelo link do convite sem escolher senha é levado a "Definir senha" | Projetos criados antes de 25/10/2026 |
