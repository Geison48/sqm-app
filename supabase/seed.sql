-- =============================================================================
-- SQM App — dados FICTÍCIOS para desenvolvimento local e testes.
-- Nunca rodar em produção. Senha de todos os usuários: Senha12345
-- =============================================================================

-- Usuários de autenticação (equivalente a ter aceitado o convite).
create or replace function pg_temp.seed_auth_user(p_id uuid, p_email text, p_name text, p_lang text)
returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('Senha12345', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_name, 'language', p_lang),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text,
          jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
end $$;

select pg_temp.seed_auth_user('00000000-0000-4000-8000-000000000001', 'sqm@sqm.local',        'Marina SQM',        'pt-BR');
select pg_temp.seed_auth_user('00000000-0000-4000-8000-000000000002', 'sqe@sqm.local',        'Sérgio SQE',        'pt-BR');
select pg_temp.seed_auth_user('00000000-0000-4000-8000-000000000003', 'sqe2@sqm.local',       'Eva SQE',           'en');
select pg_temp.seed_auth_user('00000000-0000-4000-8000-0000000000a1', 'qualidade@fornecedor-a.local', 'Ana Fornecedor A', 'pt-BR');
select pg_temp.seed_auth_user('00000000-0000-4000-8000-0000000000b1', 'quality@supplier-b.local',     'Bob Supplier B',  'en');

-- Perfis internos (precisam existir antes de serem SQE responsáveis).
insert into public.users (id, full_name, email, role, language, created_by) values
  ('00000000-0000-4000-8000-000000000001', 'Marina SQM', 'sqm@sqm.local',  'sqm', 'pt-BR', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002', 'Sérgio SQE', 'sqe@sqm.local',  'sqe', 'pt-BR', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000003', 'Eva SQE',    'sqe2@sqm.local', 'sqe', 'en',    '00000000-0000-4000-8000-000000000001');

-- Fornecedores fictícios A, B e C.
insert into public.suppliers (id, legal_name, trade_name, country_code, tax_id, criticality, status_code, website, responsible_sqe_id, created_by) values
  ('10000000-0000-4000-8000-00000000000a', 'Fornecedor A Compósitos Ltda', 'A Compósitos', 'BR', '11.222.333/0001-81', 'A', 'approved',
   'https://fornecedor-a.example', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-00000000000b', 'Supplier B Castings Co.', 'B Castings', 'CN', '91310000MA1FL0000X', 'A', 'conditionally_approved',
   'https://supplier-b.example', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-00000000000c', 'Fornecedor C Estruturas Metálicas S.A.', 'C Estruturas', 'BR', '11.444.777/0001-61', 'B', 'in_qualification',
   null, '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001');

-- Usuários dos fornecedores.
insert into public.users (id, full_name, email, role, language, supplier_id, created_by) values
  ('00000000-0000-4000-8000-0000000000a1', 'Ana Fornecedor A', 'qualidade@fornecedor-a.local', 'supplier', 'pt-BR',
   '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-0000000000b1', 'Bob Supplier B',   'quality@supplier-b.local',     'supplier', 'en',
   '10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-000000000003');

-- Um anexo de cada fornecedor e um anexo interno, para os testes de isolamento.
insert into public.attachments (entity_table, entity_id, supplier_id, storage_path, file_name, mime_type, internal_only, created_by) values
  ('suppliers', '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a',
   '10000000-0000-4000-8000-00000000000a/seed/certificado-iso9001.pdf', 'certificado-iso9001.pdf', 'application/pdf', false,
   '00000000-0000-4000-8000-000000000002'),
  ('suppliers', '10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a',
   'internal/seed/avaliacao-interna-a.pdf', 'avaliacao-interna-a.pdf', 'application/pdf', true,
   '00000000-0000-4000-8000-000000000002'),
  ('suppliers', '10000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b',
   '10000000-0000-4000-8000-00000000000b/seed/iso9001-certificate.pdf', 'iso9001-certificate.pdf', 'application/pdf', false,
   '00000000-0000-4000-8000-000000000003');

-- -----------------------------------------------------------------------------
-- Etapa 2: cadastros
-- -----------------------------------------------------------------------------
insert into public.plants (supplier_id, name, address_line, city, state, postal_code, country_code, is_main, created_by) values
  ('10000000-0000-4000-8000-00000000000a', 'Planta Joinville', 'Rua das Pás, 100', 'Joinville', 'SC', '89200-000', 'BR', true, '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000a', 'Planta Camaçari', 'Via Industrial, 2000', 'Camaçari', 'BA', '42800-000', 'BR', false, '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000b', 'Foundry No. 2', '88 Industrial Rd', 'Taicang', 'Jiangsu', '215400', 'CN', true, '00000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-00000000000c', 'Fábrica Sorocaba', 'Av. Metalúrgica, 55', 'Sorocaba', 'SP', '18087-000', 'BR', true, '00000000-0000-4000-8000-000000000002');

insert into public.contacts (supplier_id, role_code, full_name, job_title, email, phone, is_primary, created_by) values
  ('10000000-0000-4000-8000-00000000000a', 'quality',    'Ana Fornecedor A', 'Gerente da Qualidade', 'qualidade@fornecedor-a.local', '+55 47 3000-0001', true,  '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000a', 'commercial', 'Carlos Vendas',    'Key account',          'comercial@fornecedor-a.local', '+55 47 3000-0002', false, '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000a', 'director',   'Diana Diretora',   'Diretora industrial',  'direcao@fornecedor-a.local',   '+55 47 3000-0003', false, '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000b', 'quality',    'Bob Supplier B',   'Quality Manager',      'quality@supplier-b.local',     '+86 512 0000 0001', true, '00000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-00000000000b', 'director',   'Wang Li',          'General Manager',      'gm@supplier-b.local',          '+86 512 0000 0002', false, '00000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-00000000000c', 'quality',    'Cecília Qualidade','Coordenadora SGQ',     'qualidade@fornecedor-c.local', '+55 15 3000-0001', true,  '00000000-0000-4000-8000-000000000002');

insert into public.standards (id, code, title_pt, title_en, revision, application, issuer, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'ISO 9001', 'Sistemas de gestão da qualidade — Requisitos', 'Quality management systems — Requirements', '2015', 'system', 'ISO', '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'VDA 6.3', 'Auditoria de processo', 'Process audit', '2023', 'process', 'VDA QMC', '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000003', 'GWI-QP-001', 'Procedimento de inspeção de recebimento de pás', 'Blade incoming inspection procedure', 'C', 'product', 'GWI', '00000000-0000-4000-8000-000000000001');

insert into public.standard_requirements (standard_id, item_code, text_pt, text_en, kind, sort_order, created_by) values
  ('20000000-0000-4000-8000-000000000001', '7.2',   'Competência: a organização determina e assegura a competência das pessoas.', 'Competence: the organization determines and ensures the competence of people.', 'audit', 10, '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '8.4',   'Controle de processos, produtos e serviços providos externamente.', 'Control of externally provided processes, products and services.', 'audit', 20, '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '10.2',  'Não conformidade e ação corretiva.', 'Nonconformity and corrective action.', 'audit', 30, '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'P6.4.1','Os parâmetros de processo estão definidos e são monitorados?', 'Are the process parameters defined and monitored?', 'audit', 10, '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'P6.2.3','Os produtos não conformes são segregados e identificados?', 'Are nonconforming products segregated and identified?', 'audit', 20, '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000003', '5.1',   'Inspeção visual da superfície: sem trincas, bolhas ou delaminação.', 'Visual surface inspection: no cracks, bubbles or delamination.', 'inspection', 10, '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000003', '5.2',   'Espessura do laminado na raiz conforme desenho (± 0,5 mm).', 'Root laminate thickness per drawing (± 0.5 mm).', 'inspection', 20, '00000000-0000-4000-8000-000000000001');

insert into public.components (id, gw_code, description, drawing_revision, criticality, control_plan_ref, created_by) values
  ('30000000-0000-4000-8000-000000000001', 'GW-BLD-0001', 'Casca de pá — raiz (laminado)',      'D', 'A', 'PC-A-0001 rev 3', '00000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000002', 'GW-BLD-0002', 'Longarina de pá (spar cap)',          'B', 'A', 'PC-A-0002 rev 1', '00000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000003', 'GW-CST-0101', 'Cubo do rotor fundido',               'F', 'A', 'CP-B-0101 rev 5', '00000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000004', 'GW-CST-0102', 'Carcaça do mancal principal',         'C', 'B', null,              '00000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000005', 'GW-TWR-0201', 'Flange de torre',                     'A', 'B', null,              '00000000-0000-4000-8000-000000000002');

insert into public.supplier_components (supplier_id, component_id, supplier_part_number, created_by) values
  ('10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000001', 'AC-ROOT-01', '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000002', 'AC-SPAR-02', '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-000000000003', 'BC-HUB-77',  '00000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-000000000004', 'BC-MBH-12',  '00000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-00000000000c', '30000000-0000-4000-8000-000000000005', null,         '00000000-0000-4000-8000-000000000002');

insert into public.component_standards (component_id, standard_id, created_by) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');

insert into public.sub_suppliers (id, supplier_id, name, country_code, material, created_by) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'Resinas Sul Ltda', 'BR', 'Resina epóxi de infusão', '00000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-00000000000a', 'GlassFab Tecidos', 'BR', 'Tecido de fibra de vidro biaxial', '00000000-0000-4000-8000-000000000002');

insert into public.sub_supplier_components (supplier_id, sub_supplier_id, component_id, created_by) values
  ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002');

-- Validades relativas a hoje para exercitar os alertas (60/30/7 dias e vencido).
insert into public.certifications (supplier_id, sub_supplier_id, standard_id, standard_name, certificate_number, issuer, scope, issued_on, valid_until, created_by) values
  ('10000000-0000-4000-8000-00000000000a', null, '20000000-0000-4000-8000-000000000001', 'ISO 9001:2015', 'BR-QMS-12345', 'Bureau Exemplo', 'Fabricação de componentes de pás eólicas', current_date - 1070, current_date + 25,  '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-000000000001', null, 'ISO 14001:2015', 'RS-EMS-778', 'Certificadora Sul', null, current_date - 900, current_date + 200, '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-00000000000b', null, '20000000-0000-4000-8000-000000000001', 'ISO 9001:2015', 'CN-QMS-99881', 'Example Cert Ltd', 'Casting and machining', current_date - 800, current_date + 300, '00000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-00000000000b', null, null, 'IATF 16949:2016', 'CN-IATF-5521', 'Example Cert Ltd', 'Casting', current_date - 1100, current_date - 3, '00000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-00000000000c', null, '20000000-0000-4000-8000-000000000001', 'ISO 9001:2015', 'BR-QMS-55555', 'Bureau Exemplo', 'Caldeiraria e usinagem', current_date - 1040, current_date + 55, '00000000-0000-4000-8000-000000000002');

-- Qualificação em andamento do fornecedor C (cria as 3 etapas automaticamente).
insert into public.qualifications (id, supplier_id, purchasing_contact, created_by) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000c', 'Paulo Compras', '00000000-0000-4000-8000-000000000002');
update public.qualification_steps
   set result = 'approved', performed_on = current_date - 20, score = 82, comments = 'Autoavaliação recebida e revisada.',
       updated_by = '00000000-0000-4000-8000-000000000002'
 where qualification_id = '50000000-0000-4000-8000-000000000001' and step_code = 'self_assessment';

-- -----------------------------------------------------------------------------
-- Etapa 3: NCs e 8D
-- -----------------------------------------------------------------------------
-- NC 1: 8D em andamento no fornecedor A (D0–D2 aprovadas, D3 com o SQE, D4 em rascunho)
insert into public.ncs (id, supplier_id, component_id, type, origin_code, severity_code, failure_mode_code, title, description,
                        detected_on, detected_location, quantity_affected, created_by)
values ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000001',
        '8d', 'receiving_plant', 'major', 'delamination', 'Delaminação na raiz da pá',
        'Delaminação de ~120 mm na região da raiz detectada no ultrassom de recebimento.', current_date - 5,
        'Recebimento planta Camaçari', 2, '00000000-0000-4000-8000-000000000002');
update public.ncs set opened_at = now() - interval '5 days' where id = '60000000-0000-4000-8000-000000000001';
update public.eight_d_steps s
   set due_at = n.opened_at + make_interval(hours => d.deadline_hours)
  from public.ncs n, public.eight_d_disciplines d
 where s.nc_id = n.id and d.code = s.discipline and n.id = '60000000-0000-4000-8000-000000000001';

insert into public.nc_items (nc_id, supplier_id, sn_or_lot, quantity, created_by) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'BLD-2026-0412', 1, '00000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'BLD-2026-0415', 1, '00000000-0000-4000-8000-000000000002');

update public.eight_d_steps set status = 'approved', current_version = 1, submitted_at = now() - interval '4 days',
       reviewed_at = now() - interval '4 days', reviewed_by = '00000000-0000-4000-8000-000000000002',
       content = case discipline
         when 'D0' then '{"emergency_actions":"Bloqueio das pás em estoque e no pátio.","notes":""}'::jsonb
         when 'D1' then '{"leader":"Ana Fornecedor A","members":[{"name":"Ana Fornecedor A","function":"Qualidade","company":"Fornecedor A"},{"name":"João Processo","function":"Engenharia de processo","company":"Fornecedor A"}]}'::jsonb
         else '{"what":"Delaminação na raiz","where":"Região da raiz, lado sucção","when":"Recebimento, lote 2026-04","who":"Inspeção de recebimento GW","how_many":"2 pás","how_detected":"Ultrassom phased array"}'::jsonb
       end
 where nc_id = '60000000-0000-4000-8000-000000000001' and discipline in ('D0', 'D1', 'D2');
insert into public.eight_d_step_versions (step_id, nc_id, supplier_id, discipline, version, content, submitted_by, submitted_at,
                                          decision, reviewed_by, reviewed_at, created_by)
select id, nc_id, supplier_id, discipline, 1, content, '00000000-0000-4000-8000-0000000000a1', now() - interval '4 days',
       'approved', '00000000-0000-4000-8000-000000000002', now() - interval '4 days', '00000000-0000-4000-8000-0000000000a1'
  from public.eight_d_steps where nc_id = '60000000-0000-4000-8000-000000000001' and discipline in ('D0', 'D1', 'D2');

insert into public.containment_actions (nc_id, supplier_id, location_code, sn_or_lot, qty_checked, qty_ok, qty_nok, action_taken, responsible, done_on, created_by) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'supplier', 'Lote 2026-04', 6, 5, 1, 'Ultrassom 100% das pás em estoque', 'Ana', current_date - 3, '00000000-0000-4000-8000-0000000000a1'),
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'gw_stock', 'BLD-2026-0412 / 0415', 2, 0, 2, 'Segregadas e identificadas em vermelho', 'Sérgio', current_date - 4, '00000000-0000-4000-8000-0000000000a1');

update public.eight_d_steps set status = 'submitted', current_version = 1, submitted_at = now() - interval '2 days',
       content = '{"summary":"Estoque no fornecedor e na GW verificado 100%; trânsito sem peças do lote.","all_stock_covered":true}'::jsonb
 where nc_id = '60000000-0000-4000-8000-000000000001' and discipline = 'D3';
insert into public.eight_d_step_versions (step_id, nc_id, supplier_id, discipline, version, content, submitted_by, submitted_at, created_by)
select id, nc_id, supplier_id, discipline, 1, content, '00000000-0000-4000-8000-0000000000a1', now() - interval '2 days', '00000000-0000-4000-8000-0000000000a1'
  from public.eight_d_steps where nc_id = '60000000-0000-4000-8000-000000000001' and discipline = 'D3';

update public.eight_d_steps set status = 'draft',
       content = '{"occurrence_root_cause":"Tempo de infusão abaixo do especificado após troca de resina.","non_detection_root_cause":""}'::jsonb
 where nc_id = '60000000-0000-4000-8000-000000000001' and discipline = 'D4';
insert into public.rca_tools (eight_d_step_id, nc_id, supplier_id, tool_type, content, created_by)
select id, nc_id, supplier_id, 'ishikawa',
       '{"method":["Tempo de infusão reduzido"],"machine":["Bomba de vácuo com vazamento"],"material":["Lote novo de resina"],"manpower":[],"measurement":[],"environment":["Temperatura baixa no galpão"]}'::jsonb,
       '00000000-0000-4000-8000-0000000000a1'
  from public.eight_d_steps where nc_id = '60000000-0000-4000-8000-000000000001' and discipline = 'D4';

insert into public.nc_costs (nc_id, supplier_id, cost_type_code, description, quantity, unit_amount, chargeable, created_by) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'tests', 'Ultrassom adicional (2 pás)', 2, 3500, true, '00000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'hours', 'Horas internas de engenharia (não cobrar)', 16, 180, false, '00000000-0000-4000-8000-000000000002');

insert into public.nc_comments (nc_id, supplier_id, body, internal, created_by) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'Favor enviar laudo do ultrassom das 6 pás em estoque.', false, '00000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'Considerar embarque controlado se D4 atrasar.', true, '00000000-0000-4000-8000-000000000002');

-- NC 2: NC simples no fornecedor B
insert into public.ncs (id, supplier_id, component_id, type, origin_code, severity_code, failure_mode_code, title, description,
                        disposition_code, disposition_notes, created_by)
values ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-000000000004',
        'simple', 'supplier_inspection', 'minor', 'porosity', 'Porosidade superficial na carcaça',
        'Porosidade superficial fora do padrão visual em 1 carcaça (face do flange).', 'rework',
        'Retrabalho conforme procedimento de reparo de fundidos aprovado.', '00000000-0000-4000-8000-000000000003');

-- NC 3: 8D crítica, aberta há 3 dias, sem resposta (D0–D3 vencidas)
insert into public.ncs (id, supplier_id, component_id, type, origin_code, severity_code, failure_mode_code, title, description,
                        customer_affected, created_by)
values ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-000000000002',
        '8d', 'field_customer', 'critical', 'crack', 'Trinca na longarina em campo',
        'Trinca longitudinal na longarina detectada em inspeção de campo (parque eólico).', true, '00000000-0000-4000-8000-000000000002');
update public.ncs set opened_at = now() - interval '3 days' where id = '60000000-0000-4000-8000-000000000003';
update public.eight_d_steps s
   set due_at = n.opened_at + make_interval(hours => d.deadline_hours)
  from public.ncs n, public.eight_d_disciplines d
 where s.nc_id = n.id and d.code = s.discipline and n.id = '60000000-0000-4000-8000-000000000003';

-- -----------------------------------------------------------------------------
-- Etapa 4: modelos, plano 2026 e auditorias
-- Perguntas de EXEMPLO escritas para teste. O questionário oficial VDA 6.3 é
-- licenciado pela VDA QMC e deve ser importado pela tela de modelos.
-- -----------------------------------------------------------------------------
insert into public.audit_templates (id, code, name_pt, name_en, method, version, status, notes, created_by) values
  ('70000000-0000-4000-8000-000000000001', 'GWI-PROC', 'Auditoria de processo GWI', 'GWI process audit', 'gwi', 1, 'draft',
   'Modelo de exemplo.', '00000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000002', 'VDA63-EX', 'VDA 6.3 (exemplo de estrutura)', 'VDA 6.3 (structure example)', 'vda63', 1, 'draft',
   'Perguntas de exemplo — importar o questionário licenciado.', '00000000-0000-4000-8000-000000000001');

insert into public.audit_template_items (template_id, element_code, element_title_pt, element_title_en, item_code, question_pt, question_en, is_star, scope_code, sort_order, created_by)
select '70000000-0000-4000-8000-000000000001', e, tp, te, c, qp, qe, false, sc, so, '00000000-0000-4000-8000-000000000001'
from (values
  ('G', 'Gestão', 'Management', 'G.1', 'Há indicadores de qualidade definidos e analisados mensalmente?', 'Are quality KPIs defined and reviewed monthly?', null, 10),
  ('G', 'Gestão', 'Management', 'G.2', 'As ações corretivas de NCs anteriores estão implementadas?', 'Are corrective actions from previous NCs implemented?', null, 20),
  ('G', 'Gestão', 'Management', 'G.3', 'Os operadores têm qualificação registrada para a operação?', 'Are operators qualified and recorded for the operation?', null, 30),
  ('R', 'Recebimento', 'Receiving', 'R.1', 'Os certificados de material são conferidos no recebimento?', 'Are material certificates checked at receiving?', 'raw_material', 40),
  ('R', 'Recebimento', 'Receiving', 'R.2', 'Materiais com validade (resina, adesivo) são controlados por FIFO e prazo?', 'Are shelf-life materials (resin, adhesive) controlled by FIFO and expiry?', 'raw_material', 50),
  ('I', 'Infusão', 'Infusion', 'I.1', 'Tempo e temperatura de infusão são registrados por peça?', 'Are infusion time and temperature recorded per part?', 'infusion', 60),
  ('I', 'Infusão', 'Infusion', 'I.2', 'O teste de vácuo é feito e registrado antes da infusão?', 'Is the vacuum test performed and recorded before infusion?', 'infusion', 70),
  ('P', 'Reparos', 'Repairs', 'P.1', 'Reparos seguem procedimento aprovado pela GW?', 'Do repairs follow a GW-approved procedure?', 'repairs', 80),
  ('P', 'Reparos', 'Repairs', 'P.2', 'Peças em reparo são identificadas (etiqueta amarela)?', 'Are parts under repair identified (yellow tag)?', 'repairs', 90),
  ('F', 'Inspeção final', 'Final inspection', 'F.1', 'O plano de inspeção vigente está disponível no posto?', 'Is the current inspection plan available at the station?', 'final_inspection', 100),
  ('F', 'Inspeção final', 'Final inspection', 'F.2', 'Os instrumentos de medição estão calibrados?', 'Are measuring instruments calibrated?', 'final_inspection', 110)
) v(e, tp, te, c, qp, qe, sc, so);

insert into public.audit_template_items (template_id, element_code, element_title_pt, element_title_en, item_code, question_pt, question_en, is_star, scope_code, sort_order, created_by)
select '70000000-0000-4000-8000-000000000002', e, tp, te, c, qp, qe, st, null, so, '00000000-0000-4000-8000-000000000001'
from (values
  ('P2', 'Gestão do projeto', 'Project management', '2.1', '[Exemplo] Existe gestão de projeto com responsáveis definidos?', '[Example] Is there project management with defined responsibilities?', false, 10),
  ('P2', 'Gestão do projeto', 'Project management', '2.2', '[Exemplo] Os recursos do projeto estão planejados?', '[Example] Are project resources planned?', false, 20),
  ('P3', 'Planejamento do produto e processo', 'Product and process planning', '3.1', '[Exemplo] Os requisitos do cliente foram analisados?', '[Example] Have customer requirements been analysed?', true, 30),
  ('P3', 'Planejamento do produto e processo', 'Product and process planning', '3.2', '[Exemplo] A viabilidade foi avaliada?', '[Example] Has feasibility been assessed?', false, 40),
  ('P4', 'Realização do produto e processo', 'Product and process realisation', '4.1', '[Exemplo] A FMEA de processo está atualizada?', '[Example] Is the process FMEA up to date?', true, 50),
  ('P4', 'Realização do produto e processo', 'Product and process realisation', '4.2', '[Exemplo] O plano de controle está liberado?', '[Example] Is the control plan released?', false, 60),
  ('P5', 'Gestão de fornecedores', 'Supplier management', '5.1', '[Exemplo] Os subfornecedores são avaliados?', '[Example] Are sub-suppliers assessed?', false, 70),
  ('P5', 'Gestão de fornecedores', 'Supplier management', '5.2', '[Exemplo] Os requisitos são desdobrados aos subfornecedores?', '[Example] Are requirements cascaded to sub-suppliers?', true, 80),
  ('P6', 'Análise do processo / produção', 'Process analysis / production', '6.1', '[Exemplo] Os parâmetros de processo estão definidos e monitorados?', '[Example] Are process parameters defined and monitored?', true, 90),
  ('P6', 'Análise do processo / produção', 'Process analysis / production', '6.2', '[Exemplo] Produtos não conformes são segregados?', '[Example] Are nonconforming products segregated?', true, 100),
  ('P6', 'Análise do processo / produção', 'Process analysis / production', '6.3', '[Exemplo] Os meios de medição são adequados?', '[Example] Are measuring means adequate?', false, 110),
  ('P6', 'Análise do processo / produção', 'Process analysis / production', '6.4', '[Exemplo] Embalagem e identificação estão corretas?', '[Example] Are packaging and identification correct?', false, 120),
  ('P7', 'Suporte ao cliente', 'Customer care', '7.1', '[Exemplo] Reclamações são tratadas com método estruturado?', '[Example] Are complaints handled with a structured method?', true, 130),
  ('P7', 'Suporte ao cliente', 'Customer care', '7.2', '[Exemplo] Os requisitos de garantia são atendidos?', '[Example] Are warranty requirements met?', false, 140)
) v(e, tp, te, c, qp, qe, st, so);

-- Ações feitas como os usuários reais (as funções checam permissão por auth.uid()).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select public.activate_template('70000000-0000-4000-8000-000000000001');
select public.activate_template('70000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
select public.generate_audit_plan(2026);
select public.submit_audit_plan((select id from public.audit_plans where year = 2026));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select public.review_audit_plan((select id from public.audit_plans where year = 2026), true, null);

-- Auditoria do A (VDA 6.3) concluída em setembro, com dois achados.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
update public.audits set template_id = '70000000-0000-4000-8000-000000000002', planned_start = '2026-09-15', planned_end = '2026-09-16',
       scope_codes = '{infusion,final_inspection}', title = 'Auditoria de processo anual — pás'
 where supplier_id = '10000000-0000-4000-8000-00000000000a';
select public.start_audit(id) from public.audits where supplier_id = '10000000-0000-4000-8000-00000000000a';
update public.audit_answers set score = case item_code when '4.1' then 6 when '6.2' then 4 when '6.3' then 6 when '2.2' then 8 else 10 end,
       comment = case item_code when '6.2' then 'Peças NOK sem identificação no pátio.' else null end
 where audit_id = (select id from public.audits where supplier_id = '10000000-0000-4000-8000-00000000000a');
insert into public.findings (audit_id, answer_id, classification, description, requirement)
select a.id, x.id, 'minor_nc', 'Peças não conformes no pátio sem etiqueta vermelha.', 'VDA 6.3 6.2'
  from public.audits a join public.audit_answers x on x.audit_id = a.id and x.item_code = '6.2'
 where a.supplier_id = '10000000-0000-4000-8000-00000000000a';
insert into public.findings (audit_id, classification, description)
select id, 'improvement', 'Digitalizar o registro de temperatura da cura.' from public.audits where supplier_id = '10000000-0000-4000-8000-00000000000a';
select public.complete_audit(id, 'Processo estável; atenção à segregação de não conformes.')
  from public.audits where supplier_id = '10000000-0000-4000-8000-00000000000a';
update public.audits set actual_start = '2026-09-15', actual_end = '2026-09-16'
 where supplier_id = '10000000-0000-4000-8000-00000000000a';

-- Auditoria do C (GWI) agendada para novembro.
update public.audits set template_id = '70000000-0000-4000-8000-000000000001', planned_start = '2026-11-10', planned_end = '2026-11-11',
       scope_codes = '{raw_material,final_inspection}'
 where supplier_id = '10000000-0000-4000-8000-00000000000c';
select set_config('request.jwt.claims', '', false);
