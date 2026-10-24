import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;
const PAGE = 1000;

function csvCell(v: unknown) {
  if (v == null) return "";
  const text = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Exportação completa da base (backup/migração), só SQM. A permissão é checada
// no banco (export_tables) com o cliente do usuário; a leitura usa o cliente
// admin para incluir também linhas que a RLS esconde até do SQM (ex.: notificações de outros).
export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  const supabase = await createClient();
  const { data: tables, error } = await supabase.rpc("export_tables");
  if (error || !tables) return new Response("Forbidden", { status: 403 });

  const admin = createAdminClient() as unknown as SupabaseClient;
  const dump: Record<string, Record<string, unknown>[]> = {};
  for (const table of tables as unknown as string[]) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error: readError } = await admin.from(table).select("*").range(from, from + PAGE - 1);
      if (readError) return new Response(`Error reading ${table}`, { status: 500 });
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    dump[table] = rows;
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const meta = { exported_at: new Date().toISOString(), exported_by: profile.email, tables: Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, v.length])) };
  let body: Uint8Array;
  let type: string;
  let filename: string;
  if (format === "json") {
    body = new TextEncoder().encode(JSON.stringify({ ...meta, data: dump }, null, 1));
    type = "application/json";
    filename = `sqm-database-${stamp}.json`;
  } else {
    const zip = new JSZip();
    zip.file("_meta.json", JSON.stringify(meta, null, 2));
    for (const [table, rows] of Object.entries(dump)) {
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const lines = [columns.join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))];
      zip.file(`${table}.csv`, "﻿" + lines.join("\r\n"));
    }
    body = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    type = "application/zip";
    filename = `sqm-database-csv-${stamp}.zip`;
  }
  return new Response(body as BodyInit, {
    headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" },
  });
}
