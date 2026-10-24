import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { NcReport, type NcReportData } from "@/lib/pdf/nc-report";
import { pdfTranslator, type PdfLanguage } from "@/lib/pdf/translator";
import type { StepContent } from "@/lib/eight-d";

// PDF da NC/8D em pt-BR, en ou bilíngue. Os dados vêm com a sessão do usuário:
// a RLS esconde do fornecedor custos internos e dados de outros fornecedores.
export async function GET(request: Request, { params }: RouteContext<"/ncs/[id]/pdf">) {
  const { id } = await params;
  const langParam = new URL(request.url).searchParams.get("lang");
  const lang: PdfLanguage = langParam === "en" || langParam === "both" ? langParam : "pt-BR";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Unauthorized", { status: 401 });

  const { data: nc } = await supabase.from("ncs")
    .select("*, suppliers(legal_name), components(gw_code, description)").eq("id", id).maybeSingle();
  if (!nc) return new Response("Not found", { status: 404 });

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
  const buffer = await renderToBuffer(element);
  const suffix = lang === "both" ? "pt-en" : lang;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nc.number}-${suffix}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
