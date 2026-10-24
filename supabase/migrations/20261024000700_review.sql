-- =============================================================================
-- Etapa 7 — revisão de RLS e regras de negócio
--   * SQE só altera usuários e anexos de fornecedores sob sua responsabilidade
--     (achado pelo teste automático 08_rls_review: antes valia para qualquer fornecedor).
--   * SQE só convida usuários para fornecedores sob sua responsabilidade.
--   * Regra 13 (parte do MVP): o conteúdo de um anexo não muda; alterar um
--     documento = enviar nova versão (supersedes_id). O ciclo de aprovação com
--     congelamento de documentos é do módulo PPAP (fase 2, prompt 8).
-- =============================================================================

drop policy users_update on public.users;
create policy users_update on public.users for update to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_sqm())
    or ((select public.current_app_role()) = 'sqe' and role = 'supplier' and public.can_manage_supplier(supplier_id))
  )
  with check (
    id = (select auth.uid())
    or (select public.is_sqm())
    or ((select public.current_app_role()) = 'sqe' and role = 'supplier' and public.can_manage_supplier(supplier_id))
  );

create or replace function public.can_invite(p_role public.app_role, p_supplier_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_app_role() = 'sqm' then true
    when public.current_app_role() = 'sqe' then
      p_role = 'supplier'
      and exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.cancelled_at is null)
      and public.can_manage_supplier(p_supplier_id)
    else false
  end
$$;

-- Anexos: interno altera os do fornecedor que gerencia (ou internos sem fornecedor).
drop policy attachments_update on public.attachments;
create policy attachments_update on public.attachments for update to authenticated
  using (
    ((select public.is_internal()) and (supplier_id is null or public.can_manage_supplier(supplier_id)))
    or (supplier_id = (select public.current_supplier_id()) and not internal_only)
  )
  with check (
    ((select public.is_internal()) and (supplier_id is null or public.can_manage_supplier(supplier_id)))
    or (supplier_id = (select public.current_supplier_id()) and not internal_only)
  );

-- Regra 13 (MVP): arquivo e vínculo de um anexo são imutáveis; muda-se só
-- descrição, visibilidade interna e cancelamento. Nova versão = novo anexo.
create or replace function app.tg_attachments_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.storage_bucket, new.storage_path, new.file_name, new.mime_type, new.size_bytes, new.entity_table, new.entity_id,
      new.supplier_id, new.version, new.supersedes_id)
     is distinct from
     (old.storage_bucket, old.storage_path, old.file_name, old.mime_type, old.size_bytes, old.entity_table, old.entity_id,
      old.supplier_id, old.version, old.supersedes_id) then
    raise exception 'attachment_new_version_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger attachments_immutable before update on public.attachments
  for each row execute function app.tg_attachments_immutable();

revoke execute on all functions in schema app from public, anon, authenticated;
