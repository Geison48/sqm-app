import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { AuditReport, type AuditReportData } from "@/lib/pdf/audit-report";
import { pdfTranslator, type PdfLanguage } from "@/lib/pdf/translator";

const MAX_PHOTOS = 24;

// Relatório de auditoria em pt-BR, en ou bilíngue. Sob RLS: o fornecedor só
// obtém o relatório depois de emitido.
export async function GET(request: Request, { params }: RouteContext<"/audits/[id]/pdf">) {
  const { id } = await params;
  const langParam = new URL(request.url).searchParams.get("lang");
  const lang: PdfLanguage = langParam === "en" || langParam === "both" ? langParam : "pt-BR";
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Unauthorized", { status: 401 });

  const { data: audit } = await supabase.from("audits")
    .select("*, suppliers(legal_name), audit_templates(code, version, method)").eq("id", id).maybeSingle();
  if (!audit || !audit.report_issued_at) return new Response("Not found", { status: 404 });

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
  const buffer = await renderToBuffer(element);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${audit.number}-${lang === "both" ? "pt-en" : lang}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
