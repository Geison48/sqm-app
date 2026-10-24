@AGENTS.md

# SQM App — contexto para agentes

Você vai construir o "SQM App", um sistema de gestão da qualidade de fornecedores para um time de 5 SQEs, 1 SQM e ~15 fornecedores. A especificação completa está em SPEC.md: leia inteira antes de qualquer código e siga-a como fonte da verdade.

Stack obrigatória: Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, next-intl (pt-BR e en), Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) com Row Level Security, Resend para e-mail, @react-pdf/renderer para PDF, deploy na Vercel.

## Regras de trabalho

- Construa em etapas pequenas; ao fim de cada etapa, liste o que fez, como testar e o que ficou pendente.
- Todo acesso a dados de fornecedor passa por RLS; nunca confie só no filtro da tela.
- Toda tabela de negócio tem audit_log (quem, quando, antes, depois) e não é apagada, só cancelada com motivo.
- Todos os textos da interface vêm de arquivos de tradução pt-BR e en; nada fixo no código.
- Configurações (prazos, escalonamento, status, checklists, normas) ficam em tabelas, editáveis pelo SQM e pelos SQEs, nunca hardcoded.
- Migrations SQL versionadas em supabase/migrations; seeds de exemplo em supabase/seed.sql.
- Se algo no SPEC.md for ambíguo, pergunte antes de decidir.

## Decisões já tomadas com o usuário (não reabrir)

- **Acesso de internos:** o SQM convida SQE/SQM (perfil definido no convite). Ninguém entra sem convite, nem via Microsoft (`[auth] enable_signup = false`).
- **SQE** convida apenas usuários de fornecedor; **SQM** convida qualquer perfil (`public.can_invite`).
- **Fornecedores estrangeiros existem:** campos `country_code` + `tax_id`; CNPJ obrigatório e validado só quando `country_code = 'BR'` (validação entra na etapa 2).
- **E-mail:** enquanto não houver domínio verificado, convites/redefinição usam o e-mail do Supabase Auth com templates bilíngues (`supabase/templates`). Resend entra depois sem mudar o app.
- **Status/origens/severidades** ficam em tabelas configuráveis com rótulos PT/EN; os códigos usados por regras de negócio (ex.: `controlled_shipment`, `approved`) são fixos e não podem ser removidos, só renomeados.
- **Prazos** em dias corridos, fuso `America/Sao_Paulo` (`app_settings.timezone`).
- **SQM** edita tudo; **SQE** lê todos os fornecedores e edita os que estão sob sua responsabilidade (`suppliers.responsible_sqe_id`).
- **Qualificação inicial** (etapa 2): versão simples, interna (fornecedor não vê). O sistema avisa, mas não bloqueia, homologação sem qualificação aprovada.
- **Certificado atualizado pelo fornecedor** vale na hora, fica no log e notifica o SQE responsável.
- **Componentes:** editam o SQM e o SQE responsável por algum fornecedor vinculado; sem vínculo, quem criou.
- **Alertas de vencimento de certificados:** SQE responsável + usuários do fornecedor.
- **Normas e qualificação são internas:** anexos dessas entidades são forçados `internal_only` no banco.
- **8D (etapa 3):** fornecedor preenche e envia Ds livremente (rascunho); SQE aprova em ordem. Prazos D0–D3 48 h, D4 10 d, D5–D6 20 d, D7–D8 30 d (tabela `eight_d_disciplines`). Só o fornecedor responde as Ds.
- **Modo de falha** é catálogo configurável (`failure_modes`); reincidência = mesmo PN + mesmo modo em `recurrence_window_days`.
- **NC simples:** SQE define disposição, fornecedor responde a ação, SQE aceita (fecha) ou devolve com comentário.
- **Custos:** `chargeable = false` = custo interno, invisível ao fornecedor. Contestação → SQE revisa (volta a "lançado"), cancela ou debita com comentário. Custos continuam editáveis após fechar o 8D.
- **Comentários de NC** podem ser internos; lições aprendidas são internas.
- **Auditorias (etapa 4):** VDA 6.3: EG = soma ÷ (avaliadas × 10); A ≥ 90, B ≥ 80; rebaixa para B se elemento P2–P7 < 80%, pergunta * = 4 ou pergunta = 0; para C se elemento < 70% ou pergunta * = 0. GWI: Conforme/NC menor/NC maior/Obs/N/A; % = (conformes + observações) ÷ aplicáveis; NC maior limita a B. Tudo configurável em `app_settings`.
- **Plano anual:** A 12, B 24, C 36 meses (configurável); só vale após aprovação do SQM; auditorias avulsas podem ser criadas a qualquer momento.
- **Regra 3:** C → "embarque controlado" (mapa configurável); o SQE aplica com justificativa ou descarta.
- **Fornecedor** vê auditorias agendadas; respostas e achados só depois do relatório emitido. NC maior fecha o achado só com o 8D fechado.
- **Questionário VDA oficial é licenciado:** nunca incluir o texto da VDA no repositório; importar pela tela.
- **ExcelJS** no lugar do SheetJS (CDN oficial bloqueado aqui; npm 0.18.5 vulnerável).
- `current_app_role()` em vez de `current_role()` (palavra reservada do Postgres).
- `cacheComponents` desligado no Next 16: todas as telas dependem do usuário logado.

## Convenções técnicas

- Tabela de negócio nova: `select app.setup_business_table('public.x')`, que adiciona colunas padrão, audit_log, bloqueio de DELETE e motivo obrigatório no cancelamento.
- Tabela com `supplier_id`: `select app.apply_default_supplier_policies('public.x')` e depois sobrescrever o que for específico (custos/comentários internos nunca visíveis ao fornecedor).
- Lista configurável nova: `select app.setup_lookup_table('public.x')` (code imutável, `is_system` não cancela, rótulos PT/EN).
- Índices que usam `created_at`/`cancelled_at` vêm **depois** de `setup_business_table` (é ela que cria as colunas).
- Zod nas actions: use `.nullish()` para campos opcionais (campo ausente do formulário chega `undefined`).
- Formulários: `RecordDialog` (campos declarativos, rótulos já traduzidos) + `CancelRecordButton`; anexos com `AttachmentsPanel`.
- Fluxos com regra (status, aprovação) ficam em funções `security definer` com flag `app.nc_workflow`/`app.status_change`; triggers bloqueiam UPDATE direto. Siga esse padrão.
- Formulários das disciplinas do 8D são declarativos em `src/lib/eight-d.ts` (tela, validação e PDF usam a mesma definição).
- Server actions devolvem **chaves de tradução** (`"users.errorForbidden"`), nunca texto.
- Cliente admin (`src/lib/supabase/admin.ts`) ignora RLS: use só depois de checar a permissão com o cliente do usuário (ex.: `rpc("can_invite")`).
- Componentes shadcn ficam em `src/components/ui`. O site do shadcn está bloqueado neste ambiente; copie do repositório oficial (`apps/v4/registry/new-york-v4/ui`) e traduza textos fixos via namespace `ui`.
- O `next dev` às vezes mantém versão antiga de server actions/JSON em memória após muitas edições: se algo "não muda", reinicie o dev server e apague `.next/dev`.
- Depois de mudar o schema: `npm run db:reset && npm run db:types`.
- Antes de concluir uma etapa: `npm run test:db && npm test && npm run lint && npm run typecheck`.
