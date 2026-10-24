import Dexie, { type EntityTable } from "dexie";

// Banco local (IndexedDB) da execução offline de auditorias e inspeções.
// Um "pacote" é uma auditoria ou inspeção levada para o aparelho.
export type PackKind = "audit" | "inspection";

export type AuditMeta = { method: "vda63" | "gwi" };
export type InspectionMeta = { inspectedOn: string; location: string | null };

export type Pack = {
  key: string;            // "audit:<id>" | "inspection:<id>"
  kind: PackKind;
  id: string;
  userId: string;
  number: string;
  title: string;          // fornecedor (e componente, na inspeção)
  supplierId: string;
  downloadedAt: string;
  meta: AuditMeta | InspectionMeta;
};

export type AuditValues = {
  score: number | null; result: string | null; not_applicable: boolean; comment: string | null; evidence: string | null;
};
export type AuditItemData = {
  element_code: string; element_title_pt: string | null; element_title_en: string | null; item_code: string;
  question_pt: string; question_en: string; is_star: boolean;
};
export type InspectionValues = {
  measured: string; qty_inspected: number | null; qty_nok: number | null; ok: boolean | null; comment: string | null;
  auto: boolean; waiver: string | null;
};
export type InspectionItemData = {
  unitId: string; unitIdentifier: string; unitKind: string;
  name_pt: string; name_en: string; specification: string | null; lower: number | null; upper: number | null; unit: string | null;
  sampling: string; sampleSize: number | null; accept: number | null; critical: boolean;
};

export type Item = {
  key: string;            // "<packKey>|<id>"
  pack: string;
  id: string;             // audit_answers.id | inspection_results.id
  order: number;
  data: AuditItemData | InspectionItemData;
  values: AuditValues | InspectionValues;
  baseUpdatedAt: string;  // updated_at do servidor na última leitura/sincronização
};

// Alteração pendente de envio (uma por item; campos acumulados).
export type Change = {
  key: string;            // = Item.key
  pack: string;
  kind: PackKind;
  itemId: string;
  patch: Partial<AuditValues & InspectionValues>;
  baseUpdatedAt: string;
  changedAt: string;
  error: string | null;
};

export type Photo = {
  id?: number;
  pack: string;
  itemId: string;
  name: string;
  type: string;
  blob: Blob;
  status: "server" | "pending" | "error";
  error: string | null;
  createdAt: string;
};

export type Conflict = {
  id?: number;
  pack: string;
  number: string;
  item: string;           // código/nome do item
  by: string;             // quem alterou no servidor
  at: string;
  createdAt: string;
  seen: boolean;
};

export class OfflineDb extends Dexie {
  packs!: EntityTable<Pack, "key">;
  items!: EntityTable<Item, "key">;
  changes!: EntityTable<Change, "key">;
  photos!: EntityTable<Photo, "id">;
  conflicts!: EntityTable<Conflict, "id">;

  constructor(name = "sqm-offline") {
    super(name);
    this.version(1).stores({
      packs: "key, kind, userId",
      items: "key, pack",
      changes: "key, pack",
      photos: "++id, pack, itemId, status",
      conflicts: "++id, pack",
    });
  }
}

let instance: OfflineDb | null = null;
export function offlineDb() {
  instance ??= new OfflineDb();
  return instance;
}

export const packKey = (kind: PackKind, id: string) => `${kind}:${id}`;
export const itemKey = (pack: string, id: string) => `${pack}|${id}`;
