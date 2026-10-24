import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { itemKey, packKey, type Item, type OfflineDb, type Pack, type Photo } from "./db";

type Client = SupabaseClient<Database>;
const SHELL_CACHE = "sqm-offline-shell";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

// Guarda a tela /offline no cache do service worker (abre sem sinal).
export async function cacheOfflineShell() {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(SHELL_CACHE);
    await cache.add(new Request("/offline", { credentials: "same-origin", cache: "reload" }));
  } catch {
    // Sem service worker/cache (ex.: navegação privada): os dados continuam no IndexedDB.
  }
}

async function downloadPhotos(supabase: Client, entityTable: string, ids: string[]) {
  if (!ids.length) return [];
  const { data: files } = await supabase.from("attachments").select("entity_id, storage_path, file_name, mime_type, size_bytes")
    .eq("entity_table", entityTable).in("entity_id", ids).is("cancelled_at", null);
  const images = (files ?? []).filter((f) => f.mime_type?.startsWith("image/") && (f.size_bytes ?? 0) <= MAX_PHOTO_BYTES);
  const out: Omit<Photo, "pack">[] = [];
  for (const f of images) {
    const { data: blob } = await supabase.storage.from("attachments").download(f.storage_path);
    if (blob) out.push({ itemId: f.entity_id, name: f.file_name, type: f.mime_type ?? "image/jpeg", blob, status: "server", error: null, createdAt: new Date().toISOString() });
  }
  return out;
}

// Grava o pacote preservando o que ainda não foi enviado deste aparelho.
async function savePack(db: OfflineDb, pack: Pack, items: Item[], photos: Omit<Photo, "pack">[]) {
  await db.transaction("rw", [db.packs, db.items, db.changes, db.photos], async () => {
    const pending = new Map((await db.changes.where("pack").equals(pack.key).toArray()).map((c) => [c.key, c]));
    const previous = new Map((await db.items.where("pack").equals(pack.key).toArray()).map((i) => [i.key, i]));
    await db.items.where("pack").equals(pack.key).delete();
    await db.items.bulkPut(items.map((i) => {
      const change = pending.get(i.key);
      return change ? { ...i, values: previous.get(i.key)?.values ?? i.values } : i;
    }));
    await db.photos.where("pack").equals(pack.key).and((p) => p.status === "server").delete();
    await db.photos.bulkAdd(photos.map((p) => ({ ...p, pack: pack.key })));
    await db.packs.put(pack);
  });
}

export async function downloadAudit(db: OfflineDb, supabase: Client, auditId: string, userId: string) {
  const { data: audit } = await supabase.from("audits")
    .select("id, number, status, supplier_id, suppliers(legal_name), audit_templates(method)").eq("id", auditId).maybeSingle();
  if (!audit || audit.status !== "in_progress") return { error: "offline.notAvailable" };
  const { data: canExecute } = await supabase.rpc("can_execute_audit", { p_audit_id: auditId });
  if (!canExecute) return { error: "errors.forbidden" };
  const { data: answers, error } = await supabase.from("audit_answers")
    .select("id, element_code, element_title_pt, element_title_en, item_code, question_pt, question_en, is_star, score, result, not_applicable, comment, evidence, updated_at")
    .eq("audit_id", auditId).is("cancelled_at", null).order("sort_order");
  if (error || !answers) return { error: "common.genericError" };

  const key = packKey("audit", auditId);
  const photos = await downloadPhotos(supabase, "audit_answers", answers.map((a) => a.id));
  await savePack(db, {
    key, kind: "audit", id: auditId, userId, number: audit.number, title: audit.suppliers?.legal_name ?? "",
    supplierId: audit.supplier_id, downloadedAt: new Date().toISOString(),
    meta: { method: (audit.audit_templates?.method ?? "vda63") as "vda63" | "gwi" },
  }, answers.map((a, order) => ({
    key: itemKey(key, a.id), pack: key, id: a.id, order, baseUpdatedAt: a.updated_at,
    data: { element_code: a.element_code, element_title_pt: a.element_title_pt, element_title_en: a.element_title_en, item_code: a.item_code,
      question_pt: a.question_pt, question_en: a.question_en, is_star: a.is_star },
    values: { score: a.score, result: a.result, not_applicable: a.not_applicable, comment: a.comment, evidence: a.evidence },
  })), photos);
  await cacheOfflineShell();
  return { ok: true as const };
}

export async function downloadInspection(db: OfflineDb, supabase: Client, inspectionId: string, userId: string) {
  const { data: insp } = await supabase.from("inspections")
    .select("id, number, status, supplier_id, plan_id, inspected_on, location, suppliers(legal_name), components(gw_code)").eq("id", inspectionId).maybeSingle();
  if (!insp || insp.status !== "in_progress") return { error: "offline.notAvailable" };
  const { data: canEdit } = await supabase.rpc("can_edit_inspection", { p_inspection_id: inspectionId });
  if (!canEdit) return { error: "errors.forbidden" };
  const [{ data: chars }, { data: units }, { data: results }] = await Promise.all([
    supabase.from("inspection_characteristics").select("*").eq("plan_id", insp.plan_id ?? "").order("sort_order"),
    supabase.from("inspection_units").select("serial_unit_id, created_at, serial_units(identifier, kind)").eq("inspection_id", inspectionId)
      .is("cancelled_at", null).order("created_at"),
    supabase.from("inspection_results").select("id, serial_unit_id, characteristic_id, measured_values, qty_inspected, qty_nok, ok, auto_evaluated, comment, updated_at, waivers(number)")
      .eq("inspection_id", inspectionId).is("cancelled_at", null),
  ]);
  if (!chars || !units || !results) return { error: "common.genericError" };
  const charById = new Map(chars.map((c) => [c.id, c]));
  const unitOrder = new Map(units.map((u, i) => [u.serial_unit_id, i]));

  const key = packKey("inspection", inspectionId);
  const items: Item[] = results
    .filter((r) => charById.has(r.characteristic_id) && unitOrder.has(r.serial_unit_id))
    .map((r) => {
      const c = charById.get(r.characteristic_id)!;
      const u = units[unitOrder.get(r.serial_unit_id)!]!;
      return {
        key: itemKey(key, r.id), pack: key, id: r.id, baseUpdatedAt: r.updated_at,
        order: unitOrder.get(r.serial_unit_id)! * 1000 + c.sort_order,
        data: { unitId: r.serial_unit_id, unitIdentifier: u.serial_units?.identifier ?? "—", unitKind: u.serial_units?.kind ?? "serial",
          name_pt: c.name_pt, name_en: c.name_en, specification: c.specification, lower: c.lower_limit, upper: c.upper_limit, unit: c.unit,
          sampling: c.sampling, sampleSize: c.sample_size, accept: c.accept_number, critical: c.is_critical },
        values: { measured: (r.measured_values ?? []).join(" "), qty_inspected: r.qty_inspected, qty_nok: r.qty_nok, ok: r.ok,
          auto: r.auto_evaluated, comment: r.comment, waiver: (r.waivers as { number: string } | null)?.number ?? null },
      };
    });
  const photos = await downloadPhotos(supabase, "inspection_results", items.map((i) => i.id));
  await savePack(db, {
    key, kind: "inspection", id: inspectionId, userId, number: insp.number,
    title: [insp.suppliers?.legal_name, insp.components?.gw_code].filter(Boolean).join(" · "),
    supplierId: insp.supplier_id, downloadedAt: new Date().toISOString(),
    meta: { inspectedOn: insp.inspected_on, location: insp.location },
  }, items, photos);
  await cacheOfflineShell();
  return { ok: true as const };
}

/** Remove o pacote do aparelho (só quando não há nada pendente). */
export async function removePack(db: OfflineDb, key: string) {
  const pending = await db.changes.where("pack").equals(key).count()
    + await db.photos.where("pack").equals(key).and((p) => p.status !== "server").count();
  if (pending > 0) return { error: "offline.removeBlocked" };
  await db.transaction("rw", [db.packs, db.items, db.photos, db.conflicts], async () => {
    await db.items.where("pack").equals(key).delete();
    await db.photos.where("pack").equals(key).delete();
    await db.conflicts.where("pack").equals(key).delete();
    await db.packs.delete(key);
  });
  return { ok: true as const };
}
