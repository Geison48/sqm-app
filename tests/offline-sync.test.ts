import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { OfflineDb, itemKey, type AuditValues, type InspectionItemData, type InspectionValues } from "../src/lib/offline/db";
import { recordChange, syncPending, type SyncApi } from "../src/lib/offline/sync";
import { evaluateLocally } from "../src/lib/offline/evaluate";

const ME = "user-me";
const PACK = "audit:a1";
const blank: AuditValues = { score: null, result: null, not_applicable: false, comment: null, evidence: null };
let db: OfflineDb;
let n = 0;

beforeEach(async () => {
  db = new OfflineDb(`test-${++n}`);
  await db.packs.put({ key: PACK, kind: "audit", id: "a1", userId: ME, number: "AUD-1", title: "Fornecedor A", supplierId: "s1",
    downloadedAt: "2026-10-24T10:00:00Z", meta: { method: "vda63" } });
  for (const id of ["q1", "q2"]) {
    await db.items.put({ key: itemKey(PACK, id), pack: PACK, id, order: 0, baseUpdatedAt: "2026-10-24T10:00:00Z",
      data: { element_code: "P5", element_title_pt: null, element_title_en: null, item_code: `5.${id}`, question_pt: "?", question_en: "?", is_star: false },
      values: blank });
  }
});

function fakeApi(server: Record<string, { updated_at: string; updated_by: string | null }>, opts: { failSave?: string; offline?: boolean } = {}) {
  const saved: Record<string, unknown>[] = [];
  const api: SyncApi = {
    userId: ME,
    async readRow(_table, id) {
      if (opts.offline) throw new TypeError("Failed to fetch");
      const row = server[id];
      return row ? { ...row, by_name: row.updated_by === ME ? null : "Outra Pessoa" } : null;
    },
    async saveAnswer(id, _auditId, patch) {
      if (opts.failSave) return { error: opts.failSave };
      saved.push({ id, ...patch });
      server[id] = { updated_at: `2026-10-24T12:00:0${saved.length}Z`, updated_by: ME };
      return {};
    },
    async saveResult() { return {}; },
    async uploadPhoto() { return {}; },
  };
  return { api, saved };
}

describe("fila offline", () => {
  it("acumula as alterações do mesmo item numa entrada só", async () => {
    await recordChange(db, itemKey(PACK, "q1"), { score: 8 }, { ...blank, score: 8 });
    await recordChange(db, itemKey(PACK, "q1"), { comment: "ok" }, { ...blank, score: 8, comment: "ok" });
    const changes = await db.changes.toArray();
    expect(changes).toHaveLength(1);
    expect(changes[0]!.patch).toEqual({ score: 8, comment: "ok" });
    expect((await db.items.get(itemKey(PACK, "q1")))!.values).toMatchObject({ score: 8, comment: "ok" });
  });

  it("envia ao voltar a conexão e limpa a fila, sem conflito quando ninguém mexeu", async () => {
    await recordChange(db, itemKey(PACK, "q1"), { score: 10 }, { ...blank, score: 10 });
    const { api, saved } = fakeApi({ q1: { updated_at: "2026-10-24T10:00:00Z", updated_by: "x" } });
    const report = await syncPending(db, api);
    expect(report).toMatchObject({ sent: 1, failed: 0, conflicts: 0 });
    expect(saved).toEqual([{ id: "q1", score: 10 }]);
    expect(await db.changes.count()).toBe(0);
    expect((await db.items.get(itemKey(PACK, "q1")))!.baseUpdatedAt).toBe("2026-10-24T12:00:01Z");
  });

  it("conflito por item: o último a salvar vence e fica um aviso", async () => {
    await recordChange(db, itemKey(PACK, "q1"), { score: 4 }, { ...blank, score: 4 });
    await recordChange(db, itemKey(PACK, "q2"), { score: 8 }, { ...blank, score: 8 });
    const { api, saved } = fakeApi({
      q1: { updated_at: "2026-10-24T11:00:00Z", updated_by: "other" },   // outra pessoa alterou depois do download
      q2: { updated_at: "2026-10-24T10:00:00Z", updated_by: "other" },
    });
    const report = await syncPending(db, api);
    expect(report).toMatchObject({ sent: 2, conflicts: 1 });
    expect(saved.map((s) => s.id)).toEqual(["q1", "q2"]);
    const [conflict] = await db.conflicts.toArray();
    expect(conflict).toMatchObject({ number: "AUD-1", item: "5.q1", by: "Outra Pessoa", seen: false });
  });

  it("alteração minha feita online depois do download não é conflito", async () => {
    await recordChange(db, itemKey(PACK, "q1"), { score: 6 }, { ...blank, score: 6 });
    const { api } = fakeApi({ q1: { updated_at: "2026-10-24T11:00:00Z", updated_by: ME } });
    expect((await syncPending(db, api)).conflicts).toBe(0);
  });

  it("sem conexão: nada é perdido e a fila continua", async () => {
    await recordChange(db, itemKey(PACK, "q1"), { score: 6 }, { ...blank, score: 6 });
    const { api } = fakeApi({}, { offline: true });
    expect(await syncPending(db, api)).toMatchObject({ sent: 0 });
    expect(await db.changes.count()).toBe(1);
  });

  it("recusado pelo servidor (ex.: auditoria já concluída): fica pendente com o erro", async () => {
    await recordChange(db, itemKey(PACK, "q1"), { score: 6 }, { ...blank, score: 6 });
    const { api } = fakeApi({ q1: { updated_at: "2026-10-24T10:00:00Z", updated_by: null } }, { failSave: "errors.forbidden" });
    expect(await syncPending(db, api)).toMatchObject({ failed: 1 });
    expect((await db.changes.toArray())[0]!.error).toBe("errors.forbidden");
  });

  it("fotos tiradas sem sinal são enviadas depois", async () => {
    await db.photos.add({ pack: PACK, itemId: "q1", name: "f.jpg", type: "image/jpeg", blob: new Blob(["x"]), status: "pending", error: null, createdAt: "" });
    const { api } = fakeApi({});
    expect((await syncPending(db, api)).photos).toBe(1);
    expect((await db.photos.toArray())[0]!.status).toBe("server");
  });

  it("pacote de outro usuário no mesmo aparelho não é enviado com a minha sessão", async () => {
    await db.packs.update(PACK, { userId: "someone-else" });
    await recordChange(db, itemKey(PACK, "q1"), { score: 6 }, { ...blank, score: 6 });
    const { api, saved } = fakeApi({ q1: { updated_at: "2026-10-24T10:00:00Z", updated_by: null } });
    await syncPending(db, api);
    expect(saved).toHaveLength(0);
  });
});

describe("prévia da avaliação (mesma regra do banco)", () => {
  const c: InspectionItemData = { unitId: "u", unitIdentifier: "SN", unitKind: "serial", name_pt: "Espessura", name_en: "Thickness",
    specification: null, lower: 41.5, upper: 42.5, unit: "mm", sampling: "100", sampleSize: null, accept: null, critical: true };
  const v: InspectionValues = { measured: "", qty_inspected: null, qty_nok: null, ok: null, comment: null, auto: false, waiver: null };
  it("fora do limite → NOK automático", () => {
    expect(evaluateLocally(c, { ...v, measured: "42.0 42.9" })).toEqual({ ok: false, auto: true, qty_nok: 1 });
    expect(evaluateLocally(c, { ...v, measured: "42,0; 42.1" })).toEqual({ ok: true, auto: true, qty_nok: 0 });
  });
  it("AQL: NOK até Ac é aceito", () => {
    const aql = { ...c, lower: null, upper: null, sampling: "aql", sampleSize: 13, accept: 1 };
    expect(evaluateLocally(aql, { ...v, qty_inspected: 13, qty_nok: 1 }).ok).toBe(true);
    expect(evaluateLocally(aql, { ...v, qty_inspected: 13, qty_nok: 2 }).ok).toBe(false);
  });
  it("sem medição: vale a marcação manual", () => {
    expect(evaluateLocally({ ...c, lower: null, upper: null }, { ...v, ok: false })).toEqual({ ok: false, auto: false, qty_nok: null });
  });
});
