import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { StepContent } from "@/lib/eight-d";
import { NcReport, type NcReportData } from "./nc-report";
import { AuditReport, type AuditReportData } from "./audit-report";
import { pdfTranslator, type PdfLanguage } from "./translator";

type Client = SupabaseClient<Database>;
const MAX_PHOTOS = 24;

// Relatórios em PDF montados com o cliente do usuário (RLS): usados pelas rotas
// /ncs/[id]/pdf e /audits/[id]/pdf e pela exportação ZIP.

/** PDF da NC/8D. A RLS esconde do fornecedor custos internos e dados de outros fornecedores. */
export async function renderNcPdf(supabase: Client, id: string, lang: PdfLanguage) {
  const { data: nc } = await supabase.from("ncs")
    .select("*, suppliers(legal_name), components(gw_code, description)").eq("id", id).maybeSingle();
  if (!nc) return null;

  const lookup = (table: string) =>
    supabase.from(table as "nc_origins").select("code, label_pt, label_en").then((r) => r.data ?? []);
  const [items, steps, containment, rca, costs, lesson, origins, severities, failureModes, dispositions, disciplines, locations] =
    await Promise.all([
      supabase.from("nc_items").select("sn_or_lot, quantity").eq("nc_id", id).is("cancelled_at", null).then((r) => r.data ?? []),
      supabase.from("eight_d_steps").select("discipline, status, content, review_comment, reviewed_at").eq("nc_id", id)
        .order("discipline").then((r) => r.data ?? []),
      supabase.from("containment_actions").select("location_code, sn_or_lot, qty_checked, qty_ok, qty_nok, action_taken")
        .eq("nc_id", id).is("cancelled_at", null).order("created_at").then((r) => r.data ?? []),
      supabase.from("rca_tools").select("tool_type, content").eq("nc_id", id).is("cancelled_at", null).then((r) => r.data ?? []),
      supabase.from("nc_costs").select("description, amount, currency, status, chargeable").eq("nc_id", id)
        .is("cancelled_at", null).order("created_at").then((r) => r.data ?? []),
      supabase.from("lessons_learned").select("failure, root_cause, action").eq("nc_id", id).maybeSingle().then((r) => r.data),
      lookup("nc_origins"), lookup("nc_severities"), lookup("failure_modes"), lookup("dispositions"),
      lookup("eight_d_disciplines"), lookup("containment_locations"),
    ]);

  const data: NcReportData = {
    nc,
    supplier: nc.suppliers?.legal_name ?? "—",
    component: nc.components ? `${nc.components.gw_code} — ${nc.components.description}` : null,
    items,
    steps: steps.map((s) => ({ ...s, content: s.content as StepContent })),
    containment,
    rca: Object.fromEntries(rca.map((r) => [r.tool_type, r.content as Record<string, unknown>])),
    costs: costs.map((c) => ({ ...c, amount: Number(c.amount) })),
    lesson,
    lookups: { origins, severities, failureModes, dispositions, disciplines, locations },
  };

  const element = createElement(NcReport, { data, tr: pdfTranslator(lang) }) as unknown as ReactElement<DocumentProps>;
  return { number: nc.number, buffer: await renderToBuffer(element) };
}

/** Relatório de auditoria (só depois de emitido). */
export async function renderAuditPdf(supabase: Client, id: string, lang: PdfLanguage) {
  const { data: audit } = await supabase.from("audits")
    .select("*, suppliers(legal_name), audit_templates(code, version, method)").eq("id", id).maybeSingle();
  if (!audit || !audit.report_issued_at) return null;

  const [{ data: answers }, { data: findings }, { data: types }, { data: scopes }, { data: users }] = await Promise.all([
    supabase.from("audit_answers").select("id, element_code, element_title_pt, element_title_en, item_code, question_pt, question_en, is_star, score, result, not_applicable, comment")
      .eq("audit_id", id).is("cancelled_at", null).order("sort_order"),
    supabase.from("findings").select("classification, description, requirement, status, action_plan, action_responsible, action_due_date, ncs!findings_nc_id_fkey(number)")
      .eq("audit_id", id).is("cancelled_at", null).order("created_at"),
    supabase.from("audit_types").select("code, label_pt, label_en"),
    supabase.from("audit_scopes").select("code, label_pt, label_en"),
    supabase.from("users").select("id, full_name").in("id", [audit.lead_auditor_id, ...audit.auditor_ids].filter(Boolean) as string[]),
  ]);

  // Fotos das respostas (jpg/png), na ordem do checklist.
  const answerList = answers ?? [];
  const { data: files } = answerList.length
    ? await supabase.from("attachments").select("entity_id, storage_path, mime_type")
        .eq("entity_table", "audit_answers").in("entity_id", answerList.map((a) => a.id)).is("cancelled_at", null)
    : { data: [] as { entity_id: string; storage_path: string; mime_type: string | null }[] };
  const order = new Map(answerList.map((a, i) => [a.id, i]));
  const images = (files ?? [])
    .filter((f) => f.mime_type === "image/jpeg" || f.mime_type === "image/png")
    .sort((a, b) => (order.get(a.entity_id) ?? 0) - (order.get(b.entity_id) ?? 0))
    .slice(0, MAX_PHOTOS);
  const photos: AuditReportData["photos"] = [];
  for (const f of images) {
    const { data: blob } = await supabase.storage.from("attachments").download(f.storage_path);
    if (!blob) continue;
    const answer = answerList[order.get(f.entity_id) ?? 0];
    photos.push({ caption: answer ? `${answer.element_code} ${answer.item_code}` : "", data: Buffer.from(await blob.arrayBuffer()),
      format: f.mime_type === "image/png" ? "png" : "jpg" });
  }

  const names = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const data: AuditReportData = {
    audit: {
      ...audit,
      element_scores: (audit.element_scores ?? {}) as Record<string, number>,
      method: audit.audit_templates?.method ?? null,
    },
    supplier: audit.suppliers?.legal_name ?? "—",
    template: audit.audit_templates ? `${audit.audit_templates.code} v${audit.audit_templates.version}` : "—",
    auditors: [audit.lead_auditor_id, ...audit.auditor_ids].filter(Boolean).map((u) => names.get(u!)).filter(Boolean).join(", "),
    answers: answerList,
    findings: (findings ?? []).map((f) => ({ ...f, nc_number: (f.ncs as { number: string } | null)?.number ?? null })),
    photos,
    lookups: { types: types ?? [], scopes: scopes ?? [] },
  };

  const element = createElement(AuditReport, { data, tr: pdfTranslator(lang) }) as unknown as ReactElement<DocumentProps>;
  return { number: audit.number, buffer: await renderToBuffer(element) };
}

export function pdfResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function parsePdfLanguage(value: string | null): PdfLanguage {
  return value === "en" || value === "both" ? value : "pt-BR";
}
