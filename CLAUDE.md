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
- `current_app_role()` em vez de `current_role()` (palavra reservada do Postgres).
- `cacheComponents` desligado no Next 16: todas as telas dependem do usuário logado.

## Convenções técnicas

- Tabela de negócio nova: `select app.setup_business_table('public.x')`, que adiciona colunas padrão, audit_log, bloqueio de DELETE e motivo obrigatório no cancelamento.
- Tabela com `supplier_id`: `select app.apply_default_supplier_policies('public.x')` e depois sobrescrever o que for específico (custos/comentários internos nunca visíveis ao fornecedor).
- Lista configurável nova: `select app.setup_lookup_table('public.x')` (code imutável, `is_system` não cancela, rótulos PT/EN).
- Índices que usam `created_at`/`cancelled_at` vêm **depois** de `setup_business_table` (é ela que cria as colunas).
- Zod nas actions: use `.nullish()` para campos opcionais (campo ausente do formulário chega `undefined`).
- Formulários: `RecordDialog` (campos declarativos, rótulos já traduzidos) + `CancelRecordButton`; anexos com `AttachmentsPanel`.
- Server actions devolvem **chaves de tradução** (`"users.errorForbidden"`), nunca texto.
- Cliente admin (`src/lib/supabase/admin.ts`) ignora RLS: use só depois de checar a permissão com o cliente do usuário (ex.: `rpc("can_invite")`).
- Componentes shadcn ficam em `src/components/ui`. O site do shadcn está bloqueado neste ambiente; copie do repositório oficial (`apps/v4/registry/new-york-v4/ui`) e traduza textos fixos via namespace `ui`.
- Depois de mudar o schema: `npm run db:reset && npm run db:types`.
- Antes de concluir uma etapa: `npm run test:db && npm test && npm run lint && npm run typecheck`.
