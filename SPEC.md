# SQM App — Especificação e Prompts

Oct 24, 2026 · @Geison

## Visão geral

O SQM App é uma aplicação web e mobile (PWA) para gestão da qualidade de fornecedores: auditorias, inspeções, não conformidades com 8D/RCA, e depois APQP/PPAP e scorecard. O MVP cobre cadastros, auditorias, inspeções e NC/8D e deve estar rodando na próxima semana.

| Item | Definição |
|---|---|
| Usuários | 5 SQEs, 1 SQM e ~15 fornecedores (portal externo) |
| Idiomas | Português e inglês, troca pelo usuário; relatórios gerados em PT, EN ou bilíngue |
| Plataforma | Web responsiva + PWA instalável no celular, com modo offline na execução de auditorias e inspeções |
| Construção | Feita por você, com IA (Claude Code ou similar), uso paralelo ao ambiente GWI |
| Integrações | Nenhuma direta. Exportação de pacotes (ZIP com PDFs e anexos organizados por fornecedor/SN) para upload manual no SharePoint |
| Normas | Biblioteca configurável (IATF/AIAG, VDA 6.3, ISO 9001, procedimentos GWI e outras), vinculada a produto/componente |
| Fase 1 (MVP) | Cadastros, auditorias, inspeções, NC simples e 8D completo, notificações por e-mail |
| Fase 2 | APQP/PPAP/FAI, PCN, scorecard, dashboards completos, relatório semanal, reuniões, IA |

**Atenção à confidencialidade.** O sistema vai guardar dados da Goldwind e dos fornecedores (relatórios de auditoria, NCs, custos, desenhos) fora do ambiente GWI. Antes de colocar dados reais, vale confirmar com sua chefia/TI e checar NDAs e a política interna de uso de sistemas externos. O app já nasce preparado para isso: dados isolados por fornecedor, criptografia, log de auditoria e exportação completa para migrar se precisar.

## Perfis e permissões

Três perfis no MVP. O fornecedor só enxerga os próprios dados, garantido no banco (Row Level Security), não só na tela.

| Recurso | SQE | SQM | Fornecedor |
|---|---|---|---|
| Login | Microsoft (SSO) ou e-mail | Microsoft (SSO) ou e-mail | Convite por e-mail + senha |
| Cadastro de fornecedor, PN, normas | Cria e edita os seus | Tudo | Vê a própria ficha, atualiza contatos e certificados |
| Plano anual de auditorias | Propõe | Aprova | Vê as auditorias dele |
| Executar auditoria / inspeção | Sim | Sim | Registra autoinspeção e reparos |
| Abrir NC / 8D | Sim | Sim | Não abre; responde |
| Responder 8D, plano de ação | Não | Não | Sim, por D, com anexos ou importação Excel/PDF |
| Aprovar cada D, eficácia, fechar | Sim | Sim | Não |
| Concessão / desvio | Aprova | Aprova | Solicita |
| Status do fornecedor (embarque controlado etc.) | Altera, com justificativa | Altera | Vê |
| Custos da NC | Lança | Lança | Aceita ou contesta |
| Documentos aprovados (congelados) | Único que altera | Vê | Vê, envia nova revisão |
| Dashboards | Os seus fornecedores | Time inteiro, carga por SQE | O que deve e prazos |
| Configurações (normas, checklists, prazos, pesos) | Sim | Sim | Não |

Cada SQE pode ver todos os fornecedores (leitura), mas edita os que estão sob sua responsabilidade. Toda alteração fica registrada em log (quem, quando, valor antes e depois).

## Módulos e requisitos funcionais

Os módulos M1 a M5 e M10 formam o MVP; M6 a M9 e M11 entram na fase 2.

### M1. Cadastros (MVP)

- Fornecedor: razão social, CNPJ, plantas/endereços, contatos por função (qualidade, comercial, direção), certificações com número, norma e validade, SQE responsável, criticidade (A/B/C) e status.
- Status do fornecedor: em qualificação, homologado, homologado condicional, embarque controlado, bloqueado, desqualificado. Toda mudança exige justificativa e fica no histórico.
- Componente / part number: código GW, descrição, revisão de desenho, fornecedor(es), criticidade, normas aplicáveis, plano de controle vigente.
- Subfornecedores (sub-tier): fabricante, material/insumo fornecido, certificações, vinculado ao fornecedor e ao componente.
- Biblioteca de normas: código, título, revisão, aplicação (produto, processo, sistema), arquivo anexo e requisitos/itens que podem ser puxados para checklists e planos de inspeção. Cresce com o tempo, sem mudar código.
- Qualificação inicial: registro da avaliação feita pelo SQE com Compras (autoavaliação do fornecedor, auditoria de potencial, análise de risco) até mudar o status para homologado.
- Alertas de vencimento: certificados, auditoria anual, documentos com validade e PPAP a revalidar, com aviso em 60, 30 e 7 dias.

### M2. Auditorias (MVP)

- Tipos: potencial, sistema, processo (anual GWI), produto, extraordinária (por NC ou reclamação), follow-up, documental remota e embarque controlado.
- Plano anual: gerado automaticamente pela criticidade (regra configurável, ex.: A = anual, B = a cada 2 anos), editável pelo SQE, aprovado pelo SQM, visto em calendário e Gantt.
- Checklist: modelos GWI e VDA 6.3 (pontuação 0-4-6-8-10, % e classificação A/B/C), montado pelo escopo da auditoria (ex.: recebimento de matéria-prima, infusão, reparos) puxando itens da biblioteca de normas. Modelos versionados.
- Execução: no celular/tablet, offline, com foto, comentário e evidência por item; sincroniza ao voltar a conexão. Suporte a auditoria de vários dias e mais de um auditor (fase 2 se apertar o prazo).
- Achados: NC maior, NC menor, observação, oportunidade de melhoria. NC maior abre 8D automaticamente; demais viram ação com responsável e prazo.
- Relatório: PDF automático em PT, EN ou bilíngue, com pontuação, achados, fotos e plano de ação; enviado ao fornecedor pelo portal e por e-mail.
- Resposta do fornecedor: plano de ação por achado no portal, ou importação de Excel/PDF no formato do fornecedor (IA extrai e mapeia; SQE confirma antes de gravar).
- Fechamento: verificação de eficácia por achado; resultado da auditoria pode sugerir mudança de status do fornecedor (ex.: classificação C → embarque controlado), sempre confirmada pelo SQE.

### M3. Inspeções (MVP)

- Tipos: inspeção final no fornecedor, recebimento, embarque controlado, reinspeção/contenção de estoque, autoinspeção do fornecedor.
- Plano de inspeção por PN: características (dimensional, visual, funcional), especificação, método, instrumento, amostragem (100% ou AQL), vindas da biblioteca de normas e do plano de controle do PPAP.
- Registro por número de série ou lote: resultado por característica (OK/NOK, valor medido), fotos, inspetor, data, local.
- Status da peça: etiqueta verde (aprovada pelo fornecedor, pronta para o SQE), amarela (em reparo), vermelha (rejeitada). O SQE só inspeciona peças verdes.
- Reparos: registro por peça com descrição, fotos antes/depois e quem fez.
- Concessão / desvio (waiver): pedido do fornecedor com justificativa, características afetadas, quantidade ou SNs, validade; aprovação do SQE ou SQM.
- Embarque controlado: só registro de entrada e saída, por decisão manual do SQE, com motivo e histórico das inspeções no período.
- Sem fluxo formal de liberação de embarque no sistema.
- Rastreabilidade por SN: cada SN reúne inspeções, reparos, concessões, NCs e documentos (PIT/FAT, certificados, relatórios), exportável em pacote para o SharePoint.

### M4. Não conformidades e 8D (MVP)

- Origens: auditoria, inspeção no fornecedor, recebimento/planta, campo/cliente final, mudança não notificada. NC da planta é lançada pelo SQE, com anexos.
- Severidade: crítica, maior, menor, definida pelo SQE na abertura.
- Dois níveis: NC simples (descrição, disposição, ação, fechamento) e 8D completo. O SQE decide; o sistema sugere 8D para severidade crítica/maior, reincidência ou cliente final afetado.
- 8D por disciplina: D0 a D8, cada D enviado pelo fornecedor e aprovado ou reprovado pelo SQE com comentário. Histórico de versões de cada D.
- Prazos padrão (configuráveis): D3 contenção em 48 h, D4 causa raiz em 10 dias, D5–D6 em 20 dias, D8 em 30 dias; eficácia por tempo ou por quantidade de lotes/peças sem reincidência.
- Contenção (D3): por local (fornecedor, trânsito, estoque GW, planta, campo) e por SN/lote, com quantidade verificada, OK e NOK.
- Disposição: retrabalho, reparo, sucata, devolução, uso como está (concessão).
- Ferramentas de RCA guiadas: Ishikawa (6M), 5 Porquês em 3 pernas (ocorrência, não detecção, sistêmica), É/Não É. Ou anexo/importação do arquivo do fornecedor.
- Custos da NC: itens (testes, retrabalho, horas, frete, parada de linha), total, aceite ou contestação do fornecedor pelo portal, status de débito.
- Retroalimentação: fechar o 8D exige indicar a nova revisão de PFMEA e Plano de Controle (ou justificar por que não muda) e gera registro na base de lições aprendidas.

### M5. Notificações e escalonamento (MVP)

- E-mail em cada evento: NC aberta, D enviado, D aprovado/reprovado, prazo chegando, prazo vencido, auditoria agendada, relatório disponível, documento reprovado.
- Escalonamento por atraso: dia do vencimento → fornecedor; +3 dias → SQE e contato de qualidade do fornecedor; +7 dias → SQM e direção do fornecedor. Regra configurável.
- Caixa de notificações dentro do app e resumo diário por e-mail para o SQE.

### M6. APQP / PPAP / FAI (fase 2)

- Projetos APQP por componente/fornecedor com as 5 fases e gates aprovados pelo SQE.
- Pacote PPAP configurável: 18 elementos AIAG + itens próprios GWI (PIT, FAI, plano de controle, PFMEA, fluxograma, MSA, capabilidade, dimensional, certificados de material). Nível de submissão definido pela criticidade.
- FAI dentro do PPAP, com itens pendentes (responsável, prazo, evidência) controlados até o fechamento.
- Ciclo de documento: fornecedor envia → SQE revisa → aprova ou reprova com comentário → nova revisão. Histórico de revisões. Após a aprovação final, o pacote congela e só o SQE altera.
- PCN: fornecedor notifica mudança (processo, planta, subfornecedor, material, retomada após parada) e isso abre re-PPAP.

### M7. Indicadores e scorecard (fase 2)

- KPIs: NCs por severidade, tempo médio de fechamento do 8D, % de 8D em atraso, reincidência, nota de auditoria, custo da não qualidade, status do APQP/PPAP no prazo. Sem PPM. Quantidades digitadas pelo SQE.
- Scorecard mensal por fornecedor com pesos configuráveis e classificação A/B/C, visível ao fornecedor.
- Dashboards por perfil (SQE, SQM, fornecedor). No MVP, só uma lista de pendências por perfil.

### M8. Visitas e relatório semanal (fase 2)

- Registro de visita (data, fornecedor, objetivo, participantes, resumo, vínculos com auditorias, inspeções e NCs).
- Geração automática do Business Trip Report / Visit Summary semanal em inglês (PPTX e PDF), um slide por semana, semana atual primeiro.

### M9. Reuniões com fornecedor (fase 2)

- Registro de reunião (follow-up, deployment, revisão periódica), participantes, pauta, decisões e ações com responsável e prazo; ata em PDF PT/EN gerada pelo sistema.

### M10. Documentos e exportação (MVP)

- Anexos em qualquer registro (PDF, imagem, Excel, Word), com versão.
- Exportação em ZIP organizada por fornecedor › componente › SN › tipo de registro, com índice em PDF, pronta para subir no SharePoint.
- Exportação completa da base (CSV/JSON) para backup ou migração.

### M11. Inteligência artificial (fase 2)

- Importação de arquivos do fornecedor (8D, plano de ação, relatório) em Excel/PDF: extração e mapeamento para os campos, com confirmação do SQE.
- Pré-análise do 8D: aponta causa raiz fraca ("falha do operador", "falta de treinamento"), ação que não ataca a causa, contenção que não cobre todo o estoque, D7 sem evidência.
- Busca na base de lições aprendidas por falha, componente e fornecedor.

## Modelo de dados

Todas as tabelas têm id (UUID), created_at, updated_at, created_by e, quando pertencem a um fornecedor, supplier_id para o isolamento por RLS. Textos de configuração (normas, checklists, status) têm campos _pt e _en.

| Entidade | Campos principais | Relações |
|---|---|---|
| users | nome, e-mail, perfil (sqe, sqm, supplier), idioma | supplier_id quando fornecedor |
| suppliers | razão social, CNPJ, criticidade, status, SQE responsável | plants, contacts, certifications, components |
| supplier_status_history | status anterior, novo, justificativa, quem, quando | supplier |
| plants / contacts / certifications | endereço; função; norma, número, validade, arquivo | supplier |
| sub_suppliers | nome, insumo, certificações | supplier, component |
| components | código GW, descrição, revisão de desenho, criticidade | suppliers (N:N), standards (N:N) |
| standards | código, título, revisão, aplicação, arquivo | standard_requirements |
| standard_requirements | item, texto PT/EN, tipo (auditoria, inspeção) | standard |
| audit_templates / audit_template_items | tipo, versão, método de pontuação; pergunta, requisito, peso | standard_requirements |
| audit_plans | ano, status (rascunho, aprovado), aprovado por | audits |
| audits | tipo, escopo, datas, auditores, nota, classificação, status | supplier, plan, template, findings |
| audit_answers | item, pontuação, comentário, fotos | audit |
| findings | classificação, descrição, ação, responsável, prazo, eficácia | audit, nc (opcional) |
| inspection_plans / inspection_characteristics | PN, revisão; característica, especificação, método, amostragem | component, standard_requirements |
| inspections | tipo, local, data, inspetor, resultado | supplier, component, serial_units |
| inspection_results | característica, valor, OK/NOK, fotos | inspection, serial_unit |
| serial_units | SN ou lote, etiqueta (verde, amarela, vermelha) | component, supplier |
| repairs / waivers | descrição, fotos; justificativa, validade, aprovação | serial_unit |
| controlled_shipment_periods | início, fim, motivo, decisão do SQE | supplier |
| ncs | origem, severidade, tipo (simples, 8D), descrição, status | supplier, component, serial_units, finding |
| eight_d_steps | disciplina (D0–D8), conteúdo, versão, status, comentário do SQE | nc |
| containment_actions | local, SN/lote, qtd verificada, OK, NOK | nc |
| rca_tools | tipo (ishikawa, 5why_3legs, is_isnot), conteúdo JSON | eight_d_step |
| nc_costs | item, valor, status (lançado, aceito, contestado, debitado) | nc |
| lessons_learned | falha, causa, ação, componente, palavras-chave | nc |
| attachments | arquivo, tipo, versão, entidade e id de origem | qualquer registro |
| notifications / escalation_rules | evento, destinatário, enviado em; gatilho, dias, nível | qualquer registro |
| audit_log | tabela, registro, campo, antes, depois, quem, quando | qualquer registro |

Fase 2 acrescenta apqp_projects, apqp_gates, ppap_packages, ppap_elements, document_revisions, fai_items, pcns, scorecards, visits, meetings e meeting_actions.

## Regras de negócio

Estas regras valem para todos os módulos e devem ser testadas no MVP.

1. O fornecedor nunca vê dados de outro fornecedor, nem custos internos, comentários marcados como internos ou notas de outros fornecedores.
2. Toda mudança de status do fornecedor exige justificativa e fica no histórico; entrada e saída de embarque controlado são sempre decisão manual do SQE.
3. A nota da auditoria pode sugerir mudança de status (ex.: classificação C → embarque controlado), mas só o SQE confirma.
4. Achado classificado como NC maior abre automaticamente uma NC do tipo 8D, vinculada ao achado.
5. O sistema sugere 8D (em vez de NC simples) para severidade crítica ou maior, reincidência do mesmo modo de falha no mesmo PN em 12 meses, ou cliente final afetado. A decisão é do SQE.
6. Cada disciplina do 8D só avança depois de aprovada pelo SQE. Uma D reprovada volta ao fornecedor com comentário obrigatório e nova versão.
7. O 8D só fecha com: D7 indicando a revisão de PFMEA e Plano de Controle (ou justificativa), eficácia verificada e registro em lições aprendidas.
8. Prazos e escalonamento seguem as regras configuradas; a contagem é em dias corridos e o escalonamento não é disparado enquanto a D estiver aguardando análise do SQE.
9. O SQE só inspeciona peças com etiqueta verde. Peça com reparo aberto fica amarela até o fornecedor registrar a conclusão.
10. Concessão/desvio tem validade (data, quantidade ou SNs) e expira sozinha.
11. Achados de auditoria só fecham após verificação de eficácia pelo SQE.
12. Custos de NC lançados ficam visíveis ao fornecedor, que aceita ou contesta com justificativa; contestação volta para o SQE decidir.
13. Documentos aprovados ficam congelados; só o SQE altera, e toda alteração gera nova revisão.
14. O plano anual de auditorias só vale depois de aprovado pelo SQM.
15. Importação de arquivo do fornecedor (Excel/PDF) nunca grava direto: o SQE revisa a extração e confirma.
16. Registros não são apagados, só cancelados com motivo; tudo fica no log de auditoria.

## Stack recomendada

Recomendo Next.js + Supabase + Vercel: é a combinação que ferramentas de IA geram com menos erro, tem plano gratuito para começar e resolve login, banco, arquivos e isolamento por fornecedor sem servidor próprio.

| Camada | Escolha | Por quê |
|---|---|---|
| Front-end | Next.js (App Router) + TypeScript | Web e mobile no mesmo código |
| Interface | Tailwind CSS + shadcn/ui | Componentes prontos, visual limpo |
| Idiomas | next-intl (PT/EN) | Troca de idioma por usuário |
| Banco | Supabase (PostgreSQL) com Row Level Security | Fornecedor isolado no próprio banco |
| Login | Supabase Auth: Microsoft (Azure) + e-mail/senha por convite | SSO para internos, convite para fornecedor |
| Arquivos | Supabase Storage, buckets privados com URL assinada | Fotos e anexos protegidos |
| Rotinas | Supabase Edge Functions + pg_cron | Prazos, alertas e escalonamento diários |
| Offline | PWA (Serwist) + IndexedDB (Dexie) | Auditoria e inspeção sem sinal na fábrica |
| PDF | @react-pdf/renderer | Relatórios PT/EN |
| E-mail | Resend | Notificações transacionais |
| Excel / PPTX | SheetJS (import/export) e pptxgenjs | Importar planilhas do fornecedor, gerar relatório semanal |
| IA (fase 2) | API do Claude | Extração de arquivos e pré-análise do 8D |
| Hospedagem | Vercel | Deploy automático a cada alteração |

Dois cuidados:

- SSO Microsoft: o tenant da Goldwind pode bloquear apps externos sem aprovação do admin. Se bloquear, internos usam e-mail/senha ou link mágico, sem mudar o resto.
- Offline: é a parte mais trabalhosa. No MVP, o offline cobre só preencher checklist e inspeção e tirar fotos; abrir NC e responder 8D exigem conexão.

## Plano de fases

O MVP sai em 7 etapas de um dia cada, uma por prompt. A fase 2 só começa depois que os critérios de aceite passarem.

*(cronograma do MVP · 7 etapas e um gate — figura no documento original)*

Uma semana é apertada para tudo isso. Se atrasar, proteja a ordem: NC/8D e auditorias primeiro, porque são a maior dor; inspeções e offline podem escorregar alguns dias sem travar o uso. Comece com dados fictícios e só carregue dados reais depois do teste de isolamento entre fornecedores.

## Prompts por fase

Exporte este documento como Markdown e salve na raiz do projeto como SPEC.md. Rode um prompt por vez, teste, faça commit e só então siga para o próximo. Cada prompt manda a IA ler o SPEC.md, então você não precisa colar a especificação de novo.

### Prompt 0 — Contexto mestre (cole uma vez, ou salve como CLAUDE.md)

```
Você vai construir o "SQM App", um sistema de gestão da qualidade de fornecedores para um time de 5 SQEs, 1 SQM e ~15 fornecedores. A especificação completa está em SPEC.md: leia inteira antes de qualquer código e siga-a como fonte da verdade.

Stack obrigatória: Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, next-intl (pt-BR e en), Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) com Row Level Security, Resend para e-mail, @react-pdf/renderer para PDF, deploy na Vercel.

Regras de trabalho:
- Construa em etapas pequenas; ao fim de cada etapa, liste o que fez, como testar e o que ficou pendente.
- Todo acesso a dados de fornecedor passa por RLS; nunca confie só no filtro da tela.
- Toda tabela de negócio tem audit_log (quem, quando, antes, depois) e não é apagada, só cancelada com motivo.
- Todos os textos da interface vêm de arquivos de tradução pt-BR e en; nada fixo no código.
- Configurações (prazos, escalonamento, status, checklists, normas) ficam em tabelas, editáveis pelo SQM e pelos SQEs, nunca hardcoded.
- Migrations SQL versionadas em supabase/migrations; seeds de exemplo em supabase/seed.sql.
- Se algo no SPEC.md for ambíguo, pergunte antes de decidir.
```

### Prompt 1 — Fundação (dia 1)

```
Etapa 1: fundação do projeto, conforme SPEC.md seções "Perfis e permissões", "Modelo de dados" e "Stack recomendada".

1. Crie o projeto Next.js com TypeScript, Tailwind, shadcn/ui e next-intl (pt-BR padrão, en).
2. Configure Supabase: auth com e-mail/senha e provedor Microsoft (Azure); tabela users com perfil (sqe, sqm, supplier), idioma e supplier_id.
3. Fluxo de convite: SQM ou SQE convida usuário de fornecedor por e-mail; o convidado define a senha no primeiro acesso.
4. Layout: menu lateral por perfil, troca de idioma, página inicial "Minhas pendências" (vazia por enquanto).
5. Helpers de RLS: funções SQL current_role() e current_supplier_id(); política padrão em que fornecedor só lê/escreve linhas com o próprio supplier_id.
6. Tabelas audit_log e attachments genéricas, com trigger de auditoria reutilizável.
7. Testes: um teste automatizado provando que um usuário de fornecedor não consegue ler dados de outro fornecedor.
8. Deploy na Vercel com variáveis de ambiente documentadas no README.
```

### Prompt 2 — Cadastros (dia 2)

```
Etapa 2: módulo M1 Cadastros do SPEC.md.

Implemente CRUD com listagem, busca e filtros para: suppliers (com plants, contacts, certifications), sub_suppliers, components (N:N com suppliers e standards), standards e standard_requirements (textos pt/en, upload do arquivo da norma).

- Status do fornecedor com histórico e justificativa obrigatória (supplier_status_history).
- Criticidade A/B/C em fornecedor e componente.
- Ficha do fornecedor em abas: dados, plantas, contatos, certificações, componentes, subfornecedores, histórico de status, anexos.
- Fornecedor logado vê só a própria ficha e pode atualizar contatos e certificados.
- Alertas de vencimento de certificados (60, 30, 7 dias) gravados em notifications (o envio de e-mail vem na etapa 6).
- Seed com 3 fornecedores fictícios, 5 componentes e 3 normas para teste.
```

### Prompt 3 — Não conformidades e 8D (dia 3)

```
Etapa 3: módulo M4 NC e 8D do SPEC.md, respeitando as regras de negócio 5, 6, 7, 8, 12 e 16.

- Abertura de NC pelo SQE/SQM: origem, severidade, tipo (simples ou 8D), fornecedor, componente, SNs/lotes, descrição, fotos e anexos. Sugestão automática de 8D conforme regra 5.
- NC simples: descrição, disposição, ação, fechamento.
- 8D: uma tela por disciplina D0–D8. Fornecedor preenche e envia cada D; SQE aprova ou reprova com comentário obrigatório; cada envio gera nova versão.
- D3 contenção: tabela por local e SN/lote com quantidade verificada, OK e NOK.
- D4 RCA: formulários guiados de Ishikawa (6M), 5 Porquês em 3 pernas (ocorrência, não detecção, sistêmica) e É/Não É, salvos em JSON; alternativa de anexar arquivo.
- Disposição: retrabalho, reparo, sucata, devolução, uso como está.
- Prazos padrão configuráveis por D (D3 48 h, D4 10 dias, D5-D6 20 dias, D8 30 dias), com indicador de no prazo / vencendo / vencido.
- Custos da NC: itens, total, aceite ou contestação pelo fornecedor.
- Fechamento exige revisão de PFMEA/Plano de Controle (ou justificativa), eficácia verificada (por data ou por quantidade de lotes) e registro em lessons_learned.
- Lista de NCs com filtros por fornecedor, status, severidade e atraso. Fornecedor vê só as dele.
- PDF do 8D em pt, en ou bilíngue.
```

### Prompt 4 — Auditorias (dia 4)

```
Etapa 4: módulo M2 Auditorias do SPEC.md, regras 3, 4, 11 e 14.

- audit_templates versionados: modelo GWI e modelo VDA 6.3 (pontuação 0-4-6-8-10, cálculo de % e classificação A/B/C conforme VDA 6.3). Itens podem ser puxados de standard_requirements.
- Plano anual: gerar automaticamente pela criticidade (regra configurável), editar, enviar para aprovação do SQM; visão em calendário e Gantt.
- Criar auditoria: tipo (potencial, sistema, processo, produto, extraordinária, follow-up, documental remota, embarque controlado), escopo, datas, auditores; montar checklist a partir do template e do escopo.
- Execução em tela pensada para celular: item a item, pontuação, comentário, várias fotos pela câmera.
- Achados: NC maior, NC menor, observação, oportunidade. NC maior cria NC tipo 8D automaticamente (regra 4).
- Relatório PDF pt/en/bilíngue com nota, classificação, achados, fotos e plano de ação.
- Fornecedor responde plano de ação por achado no portal; SQE verifica eficácia e fecha.
- Ao concluir, se a classificação disparar a regra 3, mostrar sugestão de mudança de status para o SQE confirmar.
```

### Prompt 5 — Inspeções (dia 5)

```
Etapa 5: módulo M3 Inspeções do SPEC.md, regras 9 e 10.

- inspection_plans por componente com características (tipo, especificação, tolerância, método, instrumento, amostragem 100% ou AQL), puxando itens de standard_requirements.
- serial_units por SN ou lote, com etiqueta verde, amarela ou vermelha.
- Autoinspeção do fornecedor: registra resultado e reparos e marca a peça como verde quando pronta.
- Inspeção do SQE (final no fornecedor, recebimento, embarque controlado, reinspeção/contenção): só lista peças verdes; resultado por característica (valor, OK/NOK, fotos). NOK oferece abrir NC já preenchida.
- Reparos por peça com fotos antes/depois.
- Concessão/desvio: fornecedor solicita, SQE ou SQM aprova, com validade que expira sozinha.
- Embarque controlado: registro manual de entrada/saída pelo SQE com motivo; histórico das inspeções no período.
- Página do SN: linha do tempo com inspeções, reparos, concessões, NCs e documentos.
```

### Prompt 6 — Notificações, escalonamento e exportação (dia 6)

```
Etapa 6: módulos M5 e M10 do SPEC.md.

- Envio de e-mail via Resend para cada evento listado em M5, no idioma do destinatário, com link direto para o registro.
- escalation_rules configuráveis; Edge Function diária via pg_cron aplicando: vencimento → fornecedor; +3 dias → SQE e qualidade do fornecedor; +7 dias → SQM e direção do fornecedor. Não escalonar quando a pendência estiver com o SQE (regra 8).
- Caixa de notificações no app e resumo diário por e-mail para cada SQE.
- Exportação ZIP por fornecedor, componente ou SN, organizada em pastas fornecedor/componente/SN/tipo, com índice em PDF, para upload manual no SharePoint.
- Exportação completa da base em CSV/JSON (só SQM).
- Painel "Minhas pendências" por perfil: SQE (NCs, Ds a analisar, auditorias e inspeções da semana, vencimentos), SQM (time inteiro e carga por SQE), fornecedor (o que deve e prazos).
```

### Prompt 7 — Offline, revisão e entrega (dia 7)

```
Etapa 7: fechamento do MVP.

1. Transforme o app em PWA instalável (Serwist). Execução de auditoria e de inspeção funciona offline: dados e fotos em IndexedDB (Dexie), fila de sincronização ao voltar a conexão, indicador de "pendente de envio" e tratamento de conflito (o último a salvar vence, com aviso).
2. Revise toda a seção "Regras de negócio" do SPEC.md e escreva um teste para cada regra; corrija o que falhar.
3. Revise as políticas RLS de todas as tabelas e confirme que fornecedor não vê custos internos nem comentários internos.
4. Revise traduções: nenhuma tela com texto fixo ou chave faltando em en.
5. Atualize o README com instalação, variáveis de ambiente, como criar o primeiro SQM e como convidar fornecedores.
```

### Fase 2 — prompts resumidos

- **Prompt 8 — APQP/PPAP/FAI:** implemente o módulo M6 do SPEC.md: projetos APQP com 5 fases e gates aprovados pelo SQE; pacote PPAP configurável (18 elementos AIAG + itens GWI) com nível pela criticidade; FAI com itens pendentes; ciclo de revisão de documentos com congelamento após aprovação final (regra 13); PCN abrindo re-PPAP.
- **Prompt 9 — Indicadores e scorecard:** implemente o módulo M7: KPIs (sem PPM), scorecard mensal com pesos configuráveis e classificação A/B/C visível ao fornecedor, dashboards por perfil.
- **Prompt 10 — Visitas, relatório semanal e reuniões:** implemente M8 e M9: registro de visitas e reuniões, ata em PDF pt/en com ações, e geração do Business Trip Report semanal em inglês (PPTX via pptxgenjs, um slide por semana, semana atual no slide 1).
- **Prompt 11 — IA:** implemente M11 com a API do Claude: importação de Excel/PDF do fornecedor com extração para os campos e confirmação do SQE (regra 15); pré-análise do 8D apontando causa raiz fraca, ação que não ataca a causa e contenção incompleta; busca em lições aprendidas.

## Critérios de aceite do MVP

O MVP está pronto quando estes testes passam com dois fornecedores fictícios (A e B) e um SQE, um SQM e um usuário de cada fornecedor.

- [ ] Usuário do fornecedor A não vê nenhum dado do fornecedor B, nem digitando a URL direto
- [ ] Fornecedor não vê custos internos nem comentários marcados como internos
- [ ] Convite de fornecedor chega por e-mail e o primeiro acesso define a senha
- [ ] Toda a interface funciona em PT e EN, inclusive PDFs e e-mails
- [ ] Mudança de status do fornecedor sem justificativa é bloqueada e fica no histórico
- [ ] Certificado com validade em 30 dias gera alerta
- [ ] Plano anual é gerado pela criticidade e só vale após aprovação do SQM
- [ ] Auditoria VDA 6.3 calcula % e classificação A/B/C corretamente
- [ ] Checklist preenchido offline no celular, com fotos, sincroniza ao voltar a conexão
- [ ] NC maior em auditoria abre 8D automaticamente
- [ ] Relatório de auditoria sai em PDF PT, EN e bilíngue
- [ ] Fornecedor responde plano de ação e o achado só fecha após eficácia verificada
- [ ] Inspeção lista só peças com etiqueta verde; NOK abre NC já preenchida
- [ ] Concessão expira sozinha na data de validade
- [ ] Entrada e saída de embarque controlado só por ação manual do SQE
- [ ] Cada D do 8D é aprovada ou reprovada; reprovação exige comentário e gera nova versão
- [ ] D vencida dispara e-mail ao fornecedor; +3 dias escala ao SQE; +7 dias ao SQM
- [ ] 8D não fecha sem PFMEA/Plano de Controle, eficácia e lição aprendida
- [ ] Fornecedor aceita ou contesta custo de NC pelo portal
- [ ] Exportação ZIP por SN sai organizada em pastas, com índice em PDF
- [ ] Nenhum registro pode ser apagado, só cancelado com motivo; tudo aparece no log
