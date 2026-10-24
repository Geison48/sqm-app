import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildExportZip } from "@/lib/export-zip";

export const maxDuration = 300;

// Pacote ZIP (fornecedor › componente › SN › tipo) com índice em PDF, para o SharePoint.
// Só SQE/SQM; os dados vêm com a sessão do usuário (RLS).
export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (profile.role === "supplier") return new Response("Forbidden", { status: 403 });
  const sp = new URL(request.url).searchParams;
  const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  const supplierId = uuid(sp.get("supplier"));
  if (!supplierId) return new Response("Bad request", { status: 400 });
  const lang = sp.get("lang") === "en" ? "en" : sp.get("lang") === "pt-BR" ? "pt-BR" : profile.language;

  const supabase = await createClient();
  const result = await buildExportZip(supabase, { supplierId, componentId: uuid(sp.get("component")), unitId: uuid(sp.get("unit")) },
    lang, profile.fullName);
  if (!result) return new Response("Not found", { status: 404 });
  const ascii = result.filename.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${ascii}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
