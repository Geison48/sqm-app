import type { AuditValues, Change, InspectionValues, OfflineDb } from "./db";

// Fila de sincronização. Regra de conflito (decisão do usuário): por item,
// o último a salvar vence, com aviso. Se outra pessoa alterou o item no
// servidor depois que este aparelho o leu, o envio daqui sobrescreve e um
// aviso fica registrado (o valor anterior continua no log de auditoria).
export type SyncApi = {
  userId: string;
  readRow: (table: "audit_answers" | "inspection_results", id: string) =>
    Promise<{ updated_at: string; updated_by: string | null; by_name: string | null } | null>;
  saveAnswer: (id: string, auditId: string, patch: Partial<AuditValues>) => Promise<{ error?: string }>;
  saveResult: (id: string, inspectionId: string, patch: Partial<InspectionValues>) =>
    Promise<{ error?: string; ok?: boolean | null; auto?: boolean }>;
  uploadPhoto: (packKey: string, itemId: string, file: { blob: Blob; name: string; type: string }) => Promise<{ error?: string }>;
};

export type SyncReport = { sent: number; failed: number; photos: number; conflicts: number };

let running: Promise<SyncReport> | null = null;

/** Envia tudo que está pendente dos pacotes do usuário. Chamadas simultâneas reaproveitam a mesma execução. */
export function syncPending(db: OfflineDb, api: SyncApi): Promise<SyncReport> {
  running ??= run(db, api).finally(() => { running = null; });
  return running;
}

async function run(db: OfflineDb, api: SyncApi): Promise<SyncReport> {
  const report: SyncReport = { sent: 0, failed: 0, photos: 0, conflicts: 0 };
  const packs = await db.packs.where("userId").equals(api.userId).toArray();
  const byKey = new Map(packs.map((p) => [p.key, p]));

  for (const change of await db.changes.toArray()) {
    const pack = byKey.get(change.pack);
    if (!pack) continue;
    const table = change.kind === "audit" ? "audit_answers" : "inspection_results";
    try {
      const row = await api.readRow(table, change.itemId);
      if (!row) {
        await markError(db, change, "errors.forbidden");
        report.failed++;
        continue;
      }
      const item = await db.items.get(change.key);
      if (row.updated_at !== change.baseUpdatedAt && row.updated_by && row.updated_by !== api.userId) {
        await db.conflicts.add({
          pack: pack.key, number: pack.number, item: itemLabel(item?.data), by: row.by_name ?? "—", at: row.updated_at,
          createdAt: new Date().toISOString(), seen: false,
        });
        report.conflicts++;
      }
      const result: { error?: string; ok?: boolean | null; auto?: boolean } = change.kind === "audit"
        ? await api.saveAnswer(change.itemId, pack.id, change.patch as Partial<AuditValues>)
        : await api.saveResult(change.itemId, pack.id, change.patch as Partial<InspectionValues>);
      if (result.error) {
        await markError(db, change, result.error);
        report.failed++;
        continue;
      }
      const fresh = await api.readRow(table, change.itemId);
      await db.transaction("rw", db.items, db.changes, async () => {
        // Só remove da fila se nada mudou no aparelho durante o envio.
        const current = await db.changes.get(change.key);
        if (current && current.changedAt === change.changedAt) await db.changes.delete(change.key);
        else if (current) await db.changes.update(change.key, { baseUpdatedAt: fresh?.updated_at ?? current.baseUpdatedAt, error: null });
        if (item) {
          const values = change.kind === "inspection" && result.ok !== undefined
            ? { ...(item.values as InspectionValues), ok: result.ok ?? null, auto: !!result.auto } : item.values;
          await db.items.update(change.key, { baseUpdatedAt: fresh?.updated_at ?? item.baseUpdatedAt, values });
        }
      });
      report.sent++;
    } catch {
      // Sem conexão no meio do envio: tenta de novo na próxima rodada.
      break;
    }
  }

  for (const photo of await db.photos.where("status").anyOf("pending", "error").toArray()) {
    if (!byKey.has(photo.pack)) continue;
    try {
      const r = await api.uploadPhoto(photo.pack, photo.itemId, photo);
      if (r.error) {
        await db.photos.update(photo.id!, { status: "error", error: r.error });
        report.failed++;
      } else {
        await db.photos.update(photo.id!, { status: "server", error: null });
        report.photos++;
      }
    } catch {
      break;
    }
  }
  return report;
}

async function markError(db: OfflineDb, change: Change, error: string) {
  await db.changes.update(change.key, { error });
}

function itemLabel(data: unknown) {
  const d = data as { item_code?: string; unitIdentifier?: string; name_pt?: string } | undefined;
  if (!d) return "—";
  return d.item_code ?? `${d.unitIdentifier} · ${d.name_pt}`;
}

/** Registra uma alteração local (acumula campos na fila). */
export async function recordChange(db: OfflineDb, itemKeyValue: string, patch: Change["patch"], values: AuditValues | InspectionValues) {
  await db.transaction("rw", db.items, db.changes, async () => {
    const item = await db.items.get(itemKeyValue);
    if (!item) return;
    await db.items.update(itemKeyValue, { values });
    const existing = await db.changes.get(itemKeyValue);
    const kind = item.pack.startsWith("audit:") ? "audit" : "inspection";
    await db.changes.put({
      key: itemKeyValue, pack: item.pack, kind, itemId: item.id,
      patch: { ...(existing?.patch ?? {}), ...patch },
      baseUpdatedAt: existing?.baseUpdatedAt ?? item.baseUpdatedAt,
      changedAt: new Date().toISOString(),
      error: null,
    });
  });
}
