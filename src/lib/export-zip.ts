import "server-only";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { renderAuditPdf, renderNcPdf } from "@/lib/pdf/reports";
import { ExportIndex, InspectionReport, type InspectionReportData } from "@/lib/pdf/export-docs";
import { pdfTranslator } from "@/lib/pdf/translator";

type Client = SupabaseClient<Database>;
type Lang = "pt-BR" | "en";
export type ExportScope = { supplierId: string; componentId?: string | null; unitId?: string | null };
type Attachment = { id: string; entity_table: string; entity_id: string; storage_bucket: string; storage_path: string;
  file_name: string; category: string | null; created_at: string };

// Nomes de pasta/arquivo seguros para Windows/SharePoint.
const safe = (name: string) =>
  name.replace(/[\\/:*?"<>|#%]+/g, "-").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 80) || "-";

const pdf = (element: unknown) => renderToBuffer(element as ReactElement<DocumentProps>);

/**
 * Pacote ZIP para o SharePoint: fornecedor › componente › SN › tipo de registro,
 * com índice em PDF. Tudo lido com o cliente do usuário (a RLS vale aqui também).
 */
export async function buildExportZip(supabase: Client, scope: ExportScope, lang: Lang, generatedBy: string) {
  const tr = pdfTranslator(lang);
  const { t } = tr;
  const F = (key: string) => safe(t(`exports.folders.${key}`));

  const { data: supplier } = await supabase.from("suppliers").select("id, legal_name").eq("id", scope.supplierId).maybeSingle();
  if (!supplier) return null;

  // Escopo: SN → um componente e uma peça; componente → todas as peças dele; fornecedor → tudo.
  let unitFilter: string | null = null;
  let componentIds: string[];
  if (scope.unitId) {
    const { data: unit } = await supabase.from("serial_units").select("id, component_id").eq("id", scope.unitId)
      .eq("supplier_id", supplier.id).maybeSingle();
    if (!unit) return null;
    unitFilter = unit.id;
    componentIds = [unit.component_id];
  } else if (scope.componentId) {
    componentIds = [scope.componentId];
  } else {
    const { data: links } = await supabase.from("supplier_components").select("component_id").eq("supplier_id", supplier.id).is("cancelled_at", null);
    componentIds = (links ?? []).map((l) => l.component_id);
  }

  const zip = new JSZip();
  const root = safe(supplier.legal_name);
  const entries: { path: string; type: string; record: string; date: string | null }[] = [];
  const used = new Set<string>();
  function add(path: string, data: Buffer | ArrayBuffer | Uint8Array, type: string, record: string, date: string | null) {
    let finalPath = path;
    for (let n = 2; used.has(finalPath.toLowerCase()); n++) finalPath = path.replace(/(\.[^./]+)?$/, ` (${n})$1`);
    used.add(finalPath.toLowerCase());
    zip.file(finalPath, data);
    entries.push({ path: finalPath, type, record, date });
  }

  // Anexos vigentes (a versão mais nova de cada documento).
  async function attachmentsOf(entityTable: string, ids: string[]) {
    if (!ids.length) return [] as Attachment[];
    const { data } = await supabase.from("attachments")
      .select("id, entity_table, entity_id, storage_bucket, storage_path, file_name, category, created_at, supersedes_id")
      .eq("entity_table", entityTable).in("entity_id", ids).is("cancelled_at", null).order("created_at");
    const rows = data ?? [];
    const superseded = new Set(rows.map((r) => r.supersedes_id).filter(Boolean));
    return rows.filter((r) => !superseded.has(r.id)) as Attachment[];
  }
  async function addFiles(folder: string, files: Attachment[], type: string, record: string) {
    for (const f of files) {
      const { data: blob } = await supabase.storage.from(f.storage_bucket).download(f.storage_path);
      if (!blob) continue;
      add(`${folder}/${safe(f.file_name)}`, await blob.arrayBuffer(), type, record, f.created_at);
    }
  }

  // ---------------------------------------------------------------- nível do fornecedor
  if (!scope.componentId && !scope.unitId) {
    const general = `${root}/${F("general")}`;
    await addFiles(`${general}/${F("documents")}`, await attachmentsOf("suppliers", [supplier.id]), t("exports.types.document"), supplier.legal_name);

    const { data: certs } = await supabase.from("certifications").select("id, standard_name, certificate_number, valid_until")
      .eq("supplier_id", supplier.id).is("cancelled_at", null);
    for (const c of certs ?? []) {
      const name = safe([c.standard_name, c.certificate_number].filter(Boolean).join(" ") || c.id);
      await addFiles(`${general}/${F("certificates")}/${name}`, await attachmentsOf("certifications", [c.id]), t("exports.types.certificate"), name);
    }

    const { data: audits } = await supabase.from("audits").select("id, number, planned_start, report_issued_at")
      .eq("supplier_id", supplier.id).is("cancelled_at", null).order("planned_start");
    for (const a of audits ?? []) {
      const folder = `${general}/${F("audits")}/${safe(a.number)}`;
      const report = a.report_issued_at ? await renderAuditPdf(supabase, a.id, lang) : null;
      if (report) add(`${folder}/${safe(a.number)}.pdf`, report.buffer, t("exports.types.auditReport"), a.number, a.report_issued_at);
      await addFiles(folder, await attachmentsOf("audits", [a.id]), t("exports.types.attachment"), a.number);
      const { data: findings } = await supabase.from("findings").select("id").eq("audit_id", a.id).is("cancelled_at", null);
      await addFiles(`${folder}/${F("findings")}`, await attachmentsOf("findings", (findings ?? []).map((f) => f.id)), t("exports.types.attachment"), a.number);
    }
  }

  // ---------------------------------------------------------------- componentes e SNs
  const { data: components } = componentIds.length
    ? await supabase.from("components").select("id, gw_code, description").in("id", componentIds).order("gw_code")
    : { data: [] as { id: string; gw_code: string; description: string }[] };
  const typeLabels = new Map(((await supabase.from("inspection_types").select("code, label_pt, label_en")).data ?? [])
    .map((x) => [x.code, tr.lookup(x)]));

  for (const comp of components ?? []) {
    const compFolder = `${root}/${safe(`${comp.gw_code} ${comp.description}`)}`;
    let unitsQuery = supabase.from("serial_units").select("id, identifier").eq("supplier_id", supplier.id)
      .eq("component_id", comp.id).is("cancelled_at", null).order("identifier");
    if (unitFilter) unitsQuery = unitsQuery.eq("id", unitFilter);
    const { data: units } = await unitsQuery;
    const unitFolder = new Map((units ?? []).map((u) => [u.id, `${compFolder}/${safe(u.identifier)}`]));

    // NCs: na pasta do SN quando ligadas a peças; senão na pasta geral do componente.
    const { data: ncs } = await supabase.from("ncs").select("id, number, opened_at, nc_items(serial_unit_id, cancelled_at)")
      .eq("supplier_id", supplier.id).eq("component_id", comp.id).is("cancelled_at", null).order("number");
    for (const nc of ncs ?? []) {
      const linked = [...new Set((nc.nc_items ?? []).filter((i) => !i.cancelled_at && i.serial_unit_id).map((i) => i.serial_unit_id!))];
      const folders = linked.filter((id) => unitFolder.has(id)).map((id) => `${unitFolder.get(id)}/${F("ncs")}/${safe(nc.number)}`);
      if (!folders.length) {
        if (unitFilter) continue;
        folders.push(`${compFolder}/${F("general")}/${F("ncs")}/${safe(nc.number)}`);
      }
      const report = await renderNcPdf(supabase, nc.id, lang);
      const files = await attachmentsOf("ncs", [nc.id]);
      for (const folder of folders) {
        if (report) add(`${folder}/${safe(nc.number)}.pdf`, report.buffer, t("exports.types.ncReport"), nc.number, nc.opened_at);
        await addFiles(folder, files, t("exports.types.attachment"), nc.number);
      }
    }

    for (const unit of units ?? []) {
      const base = unitFolder.get(unit.id)!;
      await addFiles(`${base}/${F("documents")}`, await attachmentsOf("serial_units", [unit.id]), t("exports.types.document"), unit.identifier);

      // Inspeções em que a peça entrou: PDF + fotos da peça.
      const { data: links } = await supabase.from("inspection_units").select("inspection_id").eq("serial_unit_id", unit.id).is("cancelled_at", null);
      for (const inspectionId of [...new Set((links ?? []).map((l) => l.inspection_id))]) {
        const report = await inspectionReport(supabase, inspectionId, tr, typeLabels);
        if (!report) continue;
        const folder = `${base}/${F("inspections")}`;
        add(`${folder}/${safe(report.data.number)}.pdf`, await pdf(createElement(InspectionReport, { data: report.data, tr })),
          t("exports.types.inspectionReport"), report.data.number, report.data.date);
        const resultIds = report.resultIdsByUnit.get(unit.id) ?? [];
        await addFiles(`${folder}/${safe(report.data.number)}`, await attachmentsOf("inspection_results", resultIds), t("exports.types.photo"), report.data.number);
        await addFiles(`${folder}/${safe(report.data.number)}`, await attachmentsOf("inspections", [inspectionId]), t("exports.types.attachment"), report.data.number);
      }

      // Reparos (fotos antes/depois)
      const { data: repairs } = await supabase.from("repairs").select("id, started_on, description").eq("serial_unit_id", unit.id)
        .is("cancelled_at", null).order("started_on");
      for (const [i, r] of (repairs ?? []).entries()) {
        const folder = `${base}/${F("repairs")}/${String(i + 1).padStart(2, "0")} ${r.started_on}`;
        const files = await attachmentsOf("repairs", [r.id]);
        for (const cat of ["before", "after"] as const) {
          await addFiles(`${folder}/${safe(t(`repairs.${cat}`))}`, files.filter((f) => f.category === cat), t("exports.types.photo"), r.description.slice(0, 40));
        }
        await addFiles(folder, files.filter((f) => f.category !== "before" && f.category !== "after"), t("exports.types.attachment"), r.description.slice(0, 40));
      }

      // Concessões que cobrem a peça (lista de SNs ou uso em inspeção)
      const { data: usedIn } = await supabase.from("inspection_results").select("waiver_id").eq("serial_unit_id", unit.id).not("waiver_id", "is", null);
      const { data: waivers } = await supabase.from("waivers").select("id, number, created_at, serial_unit_ids")
        .eq("supplier_id", supplier.id).eq("component_id", comp.id).is("cancelled_at", null);
      const usedIds = new Set((usedIn ?? []).map((w) => w.waiver_id));
      for (const w of (waivers ?? []).filter((w) => usedIds.has(w.id) || w.serial_unit_ids.includes(unit.id))) {
        await addFiles(`${base}/${F("waivers")}/${safe(w.number)}`, await attachmentsOf("waivers", [w.id]), t("exports.types.attachment"), w.number);
        if (!entries.some((e) => e.record === w.number)) entries.push({ path: `${base}/${F("waivers")}/${safe(w.number)}`, type: t("exports.types.waiver"), record: w.number, date: w.created_at });
      }
    }
  }

  // ---------------------------------------------------------------- índice
  const compLabel = components?.length === 1 && (scope.componentId || scope.unitId) ? ` › ${components[0]!.gw_code}` : "";
  const unitLabel = scope.unitId ? ` › ${(await supabase.from("serial_units").select("identifier").eq("id", scope.unitId).single()).data?.identifier}` : "";
  const now = new Date().toISOString();
  const index = await pdf(createElement(ExportIndex, {
    data: { scope: `${supplier.legal_name}${compLabel}${unitLabel}`, generatedAt: now, generatedBy, entries: [...entries].sort((a, b) => a.path.localeCompare(b.path)) },
    tr,
  }));
  zip.file(`${root}/00 ${safe(t("exports.indexTitle"))}.pdf`, index);

  const stamp = now.slice(0, 10).replaceAll("-", "");
  const filename = `SQM ${root}${compLabel.replace(" › ", " ")}${unitLabel.replace(" › ", " ")} ${stamp}.zip`;
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, filename: safe(filename.replace(/\.zip$/, "")) + ".zip", files: entries.length };
}

async function inspectionReport(supabase: Client, id: string, tr: ReturnType<typeof pdfTranslator>, types: Map<string, string>) {
  const { data: insp } = await supabase.from("inspections")
    .select("id, number, type_code, inspected_on, location, result, status, notes, plan_id, suppliers(legal_name), components(gw_code, description), inspection_plans(revision)")
    .eq("id", id).maybeSingle();
  if (!insp) return null;
  const [{ data: chars }, { data: units }, { data: results }] = await Promise.all([
    supabase.from("inspection_characteristics").select("*").eq("plan_id", insp.plan_id ?? "").order("sort_order"),
    supabase.from("inspection_units").select("result, serial_unit_id, serial_units(identifier)").eq("inspection_id", id).is("cancelled_at", null).order("created_at"),
    supabase.from("inspection_results").select("id, serial_unit_id, characteristic_id, measured_values, measured_text, qty_inspected, qty_nok, ok, comment, waivers(number)")
      .eq("inspection_id", id).is("cancelled_at", null),
  ]);
  const charById = new Map((chars ?? []).map((c) => [c.id, c]));
  const en = tr.locale === "en";
  const resultIdsByUnit = new Map<string, string[]>();
  const data: InspectionReportData = {
    number: insp.number, type: types.get(insp.type_code) ?? insp.type_code, supplier: insp.suppliers?.legal_name ?? "—",
    component: insp.components ? `${insp.components.gw_code} ${insp.components.description}` : "—",
    date: insp.inspected_on, location: insp.location, result: insp.result, status: insp.status, notes: insp.notes,
    plan: insp.inspection_plans?.revision ?? null,
    units: (units ?? []).map((u) => {
      const rows = (results ?? []).filter((r) => r.serial_unit_id === u.serial_unit_id)
        .sort((a, b) => (charById.get(a.characteristic_id)?.sort_order ?? 0) - (charById.get(b.characteristic_id)?.sort_order ?? 0));
      resultIdsByUnit.set(u.serial_unit_id, rows.map((r) => r.id));
      return {
        identifier: u.serial_units?.identifier ?? "—", result: u.result,
        rows: rows.map((r) => {
          const c = charById.get(r.characteristic_id);
          const limits = c && (c.lower_limit != null || c.upper_limit != null)
            ? `[${c.lower_limit ?? "−∞"} … ${c.upper_limit ?? "+∞"}]${c.unit ? ` ${c.unit}` : ""}` : "";
          const qty = r.qty_inspected != null ? `${r.qty_nok ?? 0}/${r.qty_inspected}` : "";
          return {
            characteristic: c ? (en ? c.name_en : c.name_pt) : "—",
            spec: [c?.specification, limits].filter(Boolean).join(" "),
            measured: [(r.measured_values ?? []).join("; "), r.measured_text, qty].filter(Boolean).join(" · "),
            ok: r.ok, waiver: (r.waivers as { number: string } | null)?.number ?? null, comment: r.comment,
          };
        }),
      };
    }),
  };
  return { data, resultIdsByUnit };
}
