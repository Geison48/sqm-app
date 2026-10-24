# SQM App

Sistema de gestão da qualidade de fornecedores (auditorias, inspeções, NC/8D) para o time de SQE/SQM e o portal dos fornecedores. A especificação completa, que é a fonte da verdade, está em [`SPEC.md`](SPEC.md).

**Stack:** Next.js 16 (App Router) + TypeScript · Tailwind 4 + shadcn/ui · next-intl (pt-BR/en) · Supabase (Postgres + RLS, Auth, Storage, Edge Functions, pg_cron) · Resend · @react-pdf/renderer · Vercel.

## Status das etapas

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1 | Fundação: login, convites, perfis, menu, idiomas, RLS, audit_log, anexos | ✅ |
| 2 | M1 Cadastros: fornecedores, status com histórico, plantas, contatos, certificados, subfornecedores, componentes, normas, qualificação inicial, alertas de vencimento, notificações in-app, configurações | ✅ |
| 3 | M4 NC e 8D: abertura com sugestão de 8D, NC simples, 8D por disciplina com versões, contenção, RCA (Ishikawa, 5 Porquês 3 pernas, É/Não é), prazos, custos com aceite/contestação, comentários internos, fechamento com eficácia e lição aprendida, PDF PT/EN/bilíngue | ✅ |
| 4 | M2 Auditorias: modelos versionados (VDA 6.3 e GWI) com importação Excel/CSV, plano anual pela criticidade com aprovação do SQM, calendário e Gantt, execução item a item no celular com fotos, cálculo de nota e classificação A/B/C, achados (NC maior → 8D), resposta do fornecedor, verificação de eficácia, sugestão de status, relatório PDF PT/EN/bilíngue | ✅ |
| 5 | M3 Inspeções: planos de inspeção por componente (limites, 100% ou AQL manual), SN/lotes com etiqueta verde/amarela/vermelha (regra 9), autoinspeção do fornecedor, inspeção do SQE e de recebimento, NOK automático pelos limites, fotos por característica, NC pré-preenchida a partir do NOK, reparos com fotos antes/depois, rejeição final, concessões/desvios que expiram sozinhos (regra 10), períodos de embarque controlado, linha do tempo do SN | ✅ |
| 6 | M5 Notificações e escalonamento: e-mail por evento no idioma do destinatário (Resend; Mailpit no local), fila `email_outbox`, prazo chegando, escalonamento configurável (vencimento → fornecedor; +3 → SQE e contato de Qualidade; +7 → SQM e contato de Direção, um aviso por nível, regra 8), resumo diário do SQE, preferência de e-mail; "Minhas pendências" por perfil com carga por SQE. M10: ZIP fornecedor › componente › SN › tipo com índice em PDF e relatórios (NC, auditoria, inspeção); base completa em JSON/CSV (só SQM) | ✅ |
| 7 | PWA instalável (Serwist) com execução offline de auditoria e inspeção (IndexedDB/Dexie, fila de sincronização, indicador de pendências, conflito por item: o último vence, com aviso); teste por regra de negócio; revisão automática de RLS em todas as tabelas (corrigiu escrita de SQE em usuários/anexos de fornecedor alheio); varredura de traduções em 124 telas PT/EN | ✅ |

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

O seed também traz planos de inspeção para GW-BLD-0001 e GW-CST-0101, as pás BLD-2026-0430/0431 (verdes), 0432 (amarela, em reparo) e 0433 (aguardando autoinspeção), o lote LOT-HUB-2610 do B, uma concessão do A aguardando decisão e uma aprovada do B. Também traz dois modelos de checklist ativos (GWI e VDA 6.3 de exemplo), o plano 2026 aprovado, a auditoria VDA do fornecedor A concluída (88,6% → B) com dois achados e a auditoria GWI do C agendada. Também traz 3 NCs: um 8D do fornecedor A em andamento (D0–D2 aprovadas, D3 com o SQE, D4 em rascunho, com custo cobrável, custo interno e comentário interno), uma NC simples do fornecedor B e um 8D crítico atrasado. Também traz 3 fornecedores (A homologado, B homologado condicional, C em qualificação), 5 componentes, 3 normas com requisitos e certificados com validade relativa à data de hoje (vencendo em 25 e 55 dias e um já vencido), para exercitar os alertas.

Os e-mails enviados localmente (convites, redefinição de senha e os avisos do app) **não saem para a internet**: abra o Mailpit em http://127.0.0.1:54324 para vê-los. No ambiente local, o pg_cron já chama a Edge Function `notifications` (os segredos do Vault vêm do seed). Para rodar a rotina diária na hora:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/notifications \
  -H "Authorization: Bearer $(npx supabase status -o env | grep ^SERVICE_ROLE_KEY | cut -d'"' -f2)" \
  -d '{"task":"daily"}'
```

### Testes

```bash
npm run test:db     # pgTAP (257): regras de negócio 1–16, RLS de todas as tabelas, isolamento A×B, DELETE bloqueado, audit_log
npm test            # Vitest (40): isolamento pela API e Storage, traduções, e-mails, fila offline
npm run lint
npm run typecheck
```

Os testes usam os dados do seed. Rode `npm run db:reset` antes se o banco tiver sido alterado à mão.

### Uso offline (celular)

O app é um PWA: no Chrome/Android use **Instalar app**; no iPhone, **Compartilhar → Adicionar à Tela de Início**. O service worker só é ativado no build de produção (`npm run build && npm start`); no `npm run dev` ele fica desligado.

1. Com sinal, abra a auditoria (em andamento) ou a inspeção (com as peças já incluídas) e toque em **Levar offline**.
2. Sem sinal, abra **No aparelho (offline)** no menu (ou qualquer endereço do app: sem conexão ele cai nessa tela). Dá para responder itens, medir, marcar OK/NOK, comentar e tirar fotos. Iniciar, incluir peça e concluir exigem conexão.
3. O cabeçalho mostra **N pendentes de envio**. Ao voltar a conexão, o envio é automático (ou **Enviar agora**). Se outra pessoa alterou o mesmo item nesse meio-tempo, a sua versão vence e aparece o aviso **Itens sobrescritos** (a versão anterior fica no log de auditoria).

Os dados ficam no IndexedDB do aparelho só para os pacotes baixados; as outras páginas não são guardadas em cache. Use **Remover do aparelho** quando terminar (só funciona sem pendências).

---

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | URL do projeto Supabase (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + local | Chave pública (*publishable*). A segurança vem da RLS. |
| `SUPABASE_SECRET_KEY` | Vercel + local | Chave secreta (*secret* / service role). **Só no servidor**, nunca com prefixo `NEXT_PUBLIC_`. Usada para enviar convites. |
| `NEXT_PUBLIC_SITE_URL` | Vercel + local | URL pública do app, ex.: `https://sqm-app.vercel.app`. Usada nos links de e-mail. |
| `NEXT_PUBLIC_AUTH_AZURE_ENABLED` | Vercel + local | `true` mostra o botão "Entrar com Microsoft". Ligue só depois de configurar o provedor Azure. |

Os e-mails do app (eventos, escalonamento, resumo diário) saem pela Edge Function `notifications`, que tem os próprios segredos no Supabase (veja o passo 7 do deploy): `RESEND_API_KEY`, `EMAIL_FROM` e `SITE_URL`.

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

7. **E-mails do app (Edge Function + pg_cron):**
   ```bash
   npx supabase functions deploy notifications
   npx supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="SQM App <sqm@seudominio.com>" SITE_URL=https://sqm-app.vercel.app
   ```
   No **SQL Editor**, guarde no Vault a URL do projeto e a service key, que o pg_cron usa para chamar a função:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<service_role key ou secret key>', 'service_role_key');
   ```
   Confirme também que as extensões **pg_cron** e **pg_net** estão ligadas. As rotinas ficam assim: `daily-notifications` às 06:00 de Brasília (escalonamento, prazo chegando e resumo diário) e `send-emails` a cada 5 minutos (envio da fila). Sem `RESEND_API_KEY`, os e-mails ficam na fila com erro e são reenviados quando a chave for configurada.

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

## Critérios de aceite do MVP

| Critério (SPEC) | Onde é verificado |
|---|---|
| Fornecedor A não vê nada do B, nem pela URL | `08_rls_review` (varre todas as tabelas), `01_supplier_isolation`, `tests/rls-isolation.test.ts`, e2e (404 em URL do B) |
| Fornecedor não vê custos nem comentários internos | `07_business_rules` R1, `08_rls_review`, PDF do fornecedor sem custo interno (e2e etapa 3) |
| Convite chega por e-mail e o primeiro acesso define a senha | e2e etapa 1 (Mailpit) |
| Toda a interface em PT e EN, inclusive PDFs e e-mails | `tests/i18n.test.ts` (paridade), varredura de 124 telas sem chave crua, PDFs PT/EN/bilíngue, `tests/email-render.test.ts` |
| Status sem justificativa é bloqueado e fica no histórico | `07_business_rules` R2, `02_master_data` |
| Certificado com validade em 30 dias gera alerta | `02_master_data`, e-mail no Mailpit (etapa 6) |
| Plano anual pela criticidade, só vale após aprovação do SQM | `07_business_rules` R14, `04_audits` |
| VDA 6.3 calcula % e A/B/C | `04_audits` |
| Checklist offline no celular, com fotos, sincroniza ao voltar | `tests/offline-sync.test.ts`, e2e etapa 7 (build de produção, rede desligada) |
| NC maior abre 8D automaticamente | `07_business_rules` R4, `04_audits` |
| Relatório de auditoria em PDF PT, EN e bilíngue | e2e etapa 4 (`pdftotext`) |
| Plano de ação do fornecedor; achado só fecha após eficácia | `07_business_rules` R11, `04_audits`, e2e etapa 4 |
| Inspeção lista só peças verdes; NOK abre NC preenchida | `07_business_rules` R9, `05_inspections`, e2e etapa 5 |
| Concessão expira sozinha | `07_business_rules` R10, `05_inspections` |
| Embarque controlado só por ação manual do SQE | `07_business_rules` R2/R3, `05_inspections` |
| Cada D aprovada/reprovada; reprovação exige comentário e gera versão | `07_business_rules` R6, `03_nc_8d` |
| D vencida → e-mail ao fornecedor; +3 SQE; +7 SQM | `06_notifications`, e2e etapa 6 (Mailpit) |
| 8D não fecha sem PFMEA/PC, eficácia e lição aprendida | `07_business_rules` R7, `03_nc_8d` |
| Fornecedor aceita ou contesta custo pelo portal | `07_business_rules` R12, e2e etapa 3 |
| ZIP por SN organizado em pastas, com índice em PDF | e2e etapa 6 |
| Nada é apagado, só cancelado com motivo; tudo no log | `07_business_rules` R16, `08_rls_review` (todas as tabelas de negócio) |

**Regras 13 e 15:** no MVP, documento anexado não é sobrescrito (alterar = nova versão) e a importação de planilha passa por pré-visualização e confirmação do SQE, num modelo em rascunho. O ciclo completo de aprovação de documentos (PPAP) e a importação de arquivos do fornecedor com IA são da fase 2 (prompts 8 e 11 do SPEC).

---

## Arquitetura e convenções

- **Segurança no banco:** toda tabela tem RLS. As funções `current_app_role()`, `current_supplier_id()`, `is_internal()`, `can_access_supplier()` e `can_manage_supplier()` concentram as regras. Fornecedor só vê linhas com o próprio `supplier_id`. SQE lê tudo, mas edita só os fornecedores sob sua responsabilidade. SQM edita tudo.
  - A função se chama `current_app_role()`, e não `current_role()`, porque `CURRENT_ROLE` é palavra reservada do PostgreSQL e devolveria o papel do banco em vez do perfil do usuário.
- **Tabela de negócio nova:** crie a tabela e rode `select app.setup_business_table('public.tabela')`. Isso adiciona `created_*`, `updated_*` e `cancelled_*`/`cancel_reason`, liga o `audit_log`, bloqueia DELETE e exige motivo no cancelamento. Para tabelas com `supplier_id`, use `select app.apply_default_supplier_policies('public.tabela')` e ajuste o que for específico.
- **Nada é apagado:** cancelar = `cancelled_at` + `cancel_reason` (mínimo 3 caracteres). Registro cancelado fica congelado.
- **Textos:** todos em `messages/pt-BR.json` e `messages/en.json`. O teste `tests/i18n.test.ts` falha se faltar chave em um dos idiomas.
- **Configurações** ficam em tabelas (`app_settings` e as próximas), editáveis por SQE/SQM.
- **Status do fornecedor:** só muda pela função `change_supplier_status` (justificativa obrigatória, histórico em `supplier_status_history`). UPDATE direto na coluna é bloqueado.
- **CNPJ:** obrigatório e validado quando o país é BR, inclusive no formato alfanumérico (Receita Federal, a partir de 07/2026). Fica gravado sem pontuação.
- **Alertas de vencimento:** `app.generate_certificate_expiry_alerts()` roda todo dia às 06:00 (Brasília) via pg_cron e também na hora em que um certificado é cadastrado ou alterado. Gera um alerta por faixa (padrão 60/30/7 dias, configurável) e um de vencido, para o SQE responsável e os usuários do fornecedor, sem duplicar. Em produção, confirme que a extensão **pg_cron** está ligada em **Database → Extensions** antes de rodar `db push`.
- **NC e 8D:** status, aprovação de disciplinas, fechamento e resposta de custos só mudam pelas funções `save_8d_step`, `review_8d_step`, `close_8d`, `convert_nc_to_8d`, `respond_simple_nc`, `review_simple_nc` e `respond_nc_cost`, que aplicam as regras 5 a 8 e 12. UPDATE direto nessas colunas é bloqueado. A view `nc_overview` (com RLS do usuário) calcula o próximo prazo e com quem está a pendência.
- **Auditorias:** nota e classificação são calculadas no banco por `audit_score()`, a mesma função usada na tela e na conclusão. Regras VDA 6.3 e GWI e o mapa da regra 3 ficam em `app_settings` (tela Configurações). Fluxos: `start_audit`, `complete_audit`, `resolve_audit_status_suggestion`, `respond_finding`, `review_finding`, `verify_finding`, `generate_audit_plan`, `submit_audit_plan` e `review_audit_plan` (somente SQM).
- **Notificações e e-mail:** `app.notify()` grava o aviso no app; um gatilho coloca na fila `email_outbox` quando o evento tem e-mail ligado (`notification_events`) e o usuário não desligou os e-mails. Contatos do fornecedor sem login (Qualidade, Direção) entram na fila direto, no idioma do país do fornecedor. A Edge Function `supabase/functions/notifications` monta o texto com as mesmas traduções da interface (`npm run sync:messages` copia `messages/*.json` para `_shared/messages.json`; o teste acusa se esquecer) e envia por Resend ou, no local, pelo Mailpit.
- **Escalonamento (regra 8):** `app.supplier_owed_items()` lista só o que está com o fornecedor (Ds não enviadas ou reprovadas, NC simples sem resposta, plano de ação de achado, custo lançado). O que aguarda o SQE nunca escala. Os níveis ficam em `escalation_rules` (tela Configurações) e cada nível dispara uma vez por pendência e prazo (prazo prorrogado começa de novo).
- **Minhas pendências e resumo diário:** usam a mesma função `app.pending_items_for(usuário)`. SQE vê os fornecedores sob sua responsabilidade, SQM vê todos (com carga por SQE) e o fornecedor vê só o que deve.
- **Exportação:** `/exports/zip` monta o pacote com o cliente do usuário (RLS) e as funções de `src/lib/pdf/reports.ts`, as mesmas das telas. `/exports/database` só funciona para o SQM (checado no banco por `export_tables()`). Ela lê com o cliente admin para incluir tudo, inclusive notificações de outros usuários. Os arquivos anexados não entram nesse backup; para eles, use o ZIP.
- **Offline (PWA):** `src/app/sw.ts` (Serwist, servido por `/serwist/sw.js`) guarda os arquivos do app e a tela `/offline`; as demais páginas são só rede. `src/lib/offline/` tem o banco local (Dexie), o download dos pacotes e a fila (`sync.ts`), que envia pelas mesmas server actions da tela online (`saveAnswer`, `saveResult`, `registerAttachment`), então RLS e gatilhos valem igual. A avaliação OK/NOK offline é só prévia (`evaluate.ts` repete a regra do banco).
- **Revisão de RLS:** `08_rls_review.test.sql` percorre todas as tabelas: RLS ligada, nenhuma política para anônimo, DELETE bloqueado e audit_log em toda tabela de negócio, e nenhum fornecedor (ou SQE de outro fornecedor) lê ou altera linha alheia. Tabela nova entra sozinha no teste.
- **Inspeções (regras 9 e 10):** a etiqueta do SN (`serial_units.tag`) só muda pelas funções do banco. Abrir reparo deixa a peça amarela, e concluir o reparo deixa sem etiqueta. A autoinspeção aprovada deixa verde, e qualquer NOK sem concessão deixa vermelha. O SQE só inclui peças verdes (`add_inspection_unit`). As funções são `complete_inspection`, `complete_repair`, `scrap_unit`, `review_waiver` e `apply_waiver`, que consome a quantidade da concessão. `app.expire_waivers()` roda todo dia às 00:05 (Brasília) e expira concessões vencidas. A NC aberta a partir de um NOK guarda o vínculo com a peça (`nc_items.serial_unit_id`).
- **Embarque controlado:** os períodos (`controlled_shipment_periods`) abrem e fecham sozinhos quando o status do fornecedor entra ou sai de `controlled_shipment` por `change_supplier_status`, com a mesma justificativa. Não há outra forma de criar período.
- **Numeração:** `app.next_number('INS'|'WVR')` gera números sequenciais por ano (INS-2026-0001), sem buracos por concorrência.
- **Questionário VDA 6.3:** o seed traz só perguntas de exemplo, escritas para teste. O questionário oficial é licenciado pela VDA QMC: importe-o em **Auditorias → Modelos → Importar planilha**, a partir da planilha modelo.
- **Planilhas:** a importação usa ExcelJS. O SheetJS da especificação só é distribuído atualizado pelo CDN próprio, bloqueado no ambiente de desenvolvimento, e a versão do npm tem falhas conhecidas.
- **PDF:** `GET /ncs/<id>/pdf?lang=pt-BR|en|both` gera o relatório com a sessão do usuário. Para o fornecedor, custos internos e comentários internos não aparecem.
- **Notificações:** a tabela `notifications` guarda o código do evento e os parâmetros; o texto é montado na interface no idioma de quem lê.
- **Anexos:** bucket privado `attachments`, com caminho `<supplier_id | internal>/<uuid>/<arquivo>`. `internal_only = true` nunca aparece para o fornecedor.
