import { createClient } from "@/lib/supabase/server";
import { parsePdfLanguage, pdfResponse, renderNcPdf } from "@/lib/pdf/reports";

// PDF da NC/8D em pt-BR, en ou bilíngue, com a sessão do usuário (RLS).
export async function GET(request: Request, { params }: RouteContext<"/ncs/[id]/pdf">) {
  const { id } = await params;
  const lang = parsePdfLanguage(new URL(request.url).searchParams.get("lang"));
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Unauthorized", { status: 401 });
  const pdf = await renderNcPdf(supabase, id, lang);
  if (!pdf) return new Response("Not found", { status: 404 });
  return pdfResponse(pdf.buffer, `${pdf.number}-${lang === "both" ? "pt-en" : lang}.pdf`);
}
