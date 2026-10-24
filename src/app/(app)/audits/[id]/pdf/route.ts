import { createClient } from "@/lib/supabase/server";
import { parsePdfLanguage, pdfResponse, renderAuditPdf } from "@/lib/pdf/reports";

// Relatório de auditoria em pt-BR, en ou bilíngue. Sob RLS: o fornecedor só
// obtém o relatório depois de emitido.
export async function GET(request: Request, { params }: RouteContext<"/audits/[id]/pdf">) {
  const { id } = await params;
  const lang = parsePdfLanguage(new URL(request.url).searchParams.get("lang"));
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Unauthorized", { status: 401 });
  const pdf = await renderAuditPdf(supabase, id, lang);
  if (!pdf) return new Response("Not found", { status: 404 });
  return pdfResponse(pdf.buffer, `${pdf.number}-${lang === "both" ? "pt-en" : lang}.pdf`);
}
