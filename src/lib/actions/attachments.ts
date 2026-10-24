"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorKey } from "@/lib/db-errors";
import type { ActionState } from "@/lib/action-state";

const ENTITY_TABLES = [
  "suppliers", "certifications", "components", "standards", "qualifications", "qualification_steps", "sub_suppliers",
  "ncs",
] as const;

const registerSchema = z.object({
  entityTable: z.enum(ENTITY_TABLES),
  entityId: z.uuid(),
  supplierId: z.uuid().nullable(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  internalOnly: z.boolean(),
  supersedesId: z.uuid().nullable(),
  description: z.string().nullable(),
  path: z.string().startsWith("/"),
});

// O arquivo já foi enviado ao Storage pelo navegador (RLS do Storage); aqui
// registramos a linha em attachments, também sob RLS.
export async function registerAttachment(input: z.input<typeof registerSchema>): Promise<ActionState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: "common.genericError" };
  const a = parsed.data;
  const supabase = await createClient();

  let version = 1;
  if (a.supersedesId) {
    const { data: previous } = await supabase.from("attachments").select("version").eq("id", a.supersedesId).maybeSingle();
    if (!previous) return { error: "errors.forbidden" };
    version = previous.version + 1;
  }

  const { error } = await supabase.from("attachments").insert({
    entity_table: a.entityTable,
    entity_id: a.entityId,
    supplier_id: a.supplierId,
    storage_path: a.storagePath,
    file_name: a.fileName,
    mime_type: a.mimeType,
    size_bytes: a.sizeBytes,
    internal_only: a.internalOnly,
    supersedes_id: a.supersedesId,
    description: a.description,
    version,
  });
  if (error) return { error: dbErrorKey(error) };

  revalidatePath(a.path);
  return { success: "attachments.uploaded" };
}

// Link temporário (60 s) gerado com a sessão do usuário: a RLS do Storage decide.
export async function getAttachmentUrl(id: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("attachments").select("storage_bucket, storage_path, file_name").eq("id", id).maybeSingle();
  if (!row) return { error: "errors.forbidden" };
  const { data, error } = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, 60, { download: row.file_name });
  if (error || !data) return { error: "errors.forbidden" };
  return { url: data.signedUrl };
}
