"use client";

import { createClient } from "@/lib/supabase/client";
import { saveAnswer } from "@/lib/actions/audits";
import { saveResult } from "@/lib/actions/inspections";
import { registerAttachment } from "@/lib/actions/attachments";
import { offlineDb } from "@/lib/offline/db";
import type { SyncApi } from "@/lib/offline/sync";

// Implementação real da fila: as mesmas server actions da tela online (RLS e regras do banco valem igual).
export function browserSyncApi(userId: string): SyncApi {
  const supabase = createClient();
  return {
    userId,
    async readRow(table, id) {
      const { data, error } = await supabase.from(table).select("updated_at, updated_by").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      let byName: string | null = null;
      if (data.updated_by && data.updated_by !== userId) {
        byName = (await supabase.from("users").select("full_name").eq("id", data.updated_by).maybeSingle()).data?.full_name ?? null;
      }
      return { updated_at: data.updated_at, updated_by: data.updated_by, by_name: byName };
    },
    async saveAnswer(id, auditId, patch) {
      return saveAnswer({
        id, auditId,
        ...(patch.score !== undefined ? { score: patch.score as 0 | null } : {}),
        ...(patch.result !== undefined ? { result: patch.result as "conform" | null } : {}),
        ...(patch.not_applicable !== undefined ? { not_applicable: patch.not_applicable } : {}),
        ...(patch.comment !== undefined ? { comment: patch.comment } : {}),
        ...(patch.evidence !== undefined ? { evidence: patch.evidence } : {}),
      });
    },
    async saveResult(id, inspectionId, patch) {
      return saveResult({
        id, inspectionId,
        ...(patch.measured !== undefined ? { measured: patch.measured } : {}),
        ...(patch.qty_inspected !== undefined ? { qty_inspected: patch.qty_inspected } : {}),
        ...(patch.qty_nok !== undefined ? { qty_nok: patch.qty_nok } : {}),
        ...(patch.ok !== undefined ? { ok: patch.ok } : {}),
        ...(patch.comment !== undefined ? { comment: patch.comment } : {}),
      });
    },
    async uploadPhoto(packKey, itemId, file) {
      const pack = await offlineDb().packs.get(packKey);
      if (!pack) return { error: "offline.notFound" };
      const path = `${pack.supplierId}/${crypto.randomUUID()}/${file.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file.blob, { contentType: file.type || undefined });
      if (error) {
        if (/fetch|network/i.test(error.message)) throw error;
        return { error: "errors.uploadFailed" };
      }
      const r = await registerAttachment({
        entityTable: pack.kind === "audit" ? "audit_answers" : "inspection_results", entityId: itemId, supplierId: pack.supplierId,
        storagePath: path, fileName: file.name, mimeType: file.type || null, sizeBytes: file.blob.size, internalOnly: false,
        supersedesId: null, description: null, path: "/offline",
      });
      return r?.error ? { error: r.error } : {};
    },
  };
}
