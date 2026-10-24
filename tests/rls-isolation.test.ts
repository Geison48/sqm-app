/**
 * Regra 1 / critério de aceite: o usuário do fornecedor A não vê nenhum dado do
 * fornecedor B, nem acessando direto pela API (equivalente a "digitar a URL").
 *
 * Roda contra o Supabase local com os dados de supabase/seed.sql:
 *   npx supabase start && npx supabase db reset && npm test
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../src/lib/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;

const SUPPLIER_A = "10000000-0000-4000-8000-00000000000a";
const SUPPLIER_B = "10000000-0000-4000-8000-00000000000b";
const FILE_A = `${SUPPLIER_A}/seed/certificado-iso9001.pdf`;
const FILE_B = `${SUPPLIER_B}/seed/iso9001-certificate.pdf`;
const FILE_INTERNAL = "internal/seed/avaliacao-interna-a.pdf";

async function signIn(email: string) {
  const client = createClient<Database>(URL, KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: "Senha12345" });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return client;
}

let userA: SupabaseClient<Database>;
let userB: SupabaseClient<Database>;
let sqe: SupabaseClient<Database>;

beforeAll(async () => {
  // Arquivos físicos dos anexos do seed (upsert: o teste pode rodar várias vezes).
  const admin = createClient<Database>(URL, SECRET, { auth: { persistSession: false } });
  for (const path of [FILE_A, FILE_B, FILE_INTERNAL]) {
    const { error } = await admin.storage
      .from("attachments")
      .upload(path, new Blob(["%PDF-1.4 teste"], { type: "application/pdf" }), { upsert: true });
    if (error) throw error;
  }
  [userA, userB, sqe] = await Promise.all([
    signIn("qualidade@fornecedor-a.local"),
    signIn("quality@supplier-b.local"),
    signIn("sqe@sqm.local"),
  ]);
});

describe("isolamento entre fornecedores (RLS)", () => {
  it("A lista apenas o próprio fornecedor", async () => {
    const { data, error } = await userA.from("suppliers").select("id");
    expect(error).toBeNull();
    expect(data!.map((s) => s.id)).toEqual([SUPPLIER_A]);
  });

  it("A não lê o fornecedor B nem pedindo pelo id", async () => {
    const { data } = await userA.from("suppliers").select("*").eq("id", SUPPLIER_B);
    expect(data).toEqual([]);
  });

  it("A não vê anexos de B nem anexos internos", async () => {
    const { data } = await userA.from("attachments").select("supplier_id, internal_only");
    expect(data!.length).toBe(1);
    expect(data!.every((a) => a.supplier_id === SUPPLIER_A && !a.internal_only)).toBe(true);
  });

  it("A não vê usuários de B", async () => {
    const { data } = await userA.from("users").select("supplier_id").eq("supplier_id", SUPPLIER_B);
    expect(data).toEqual([]);
  });

  it("A não lê o log de auditoria", async () => {
    const { data } = await userA.from("audit_log").select("id");
    expect(data).toEqual([]);
  });

  it("A baixa o próprio arquivo, mas não o de B nem o interno", async () => {
    const own = await userA.storage.from("attachments").download(FILE_A);
    expect(own.error).toBeNull();
    const other = await userA.storage.from("attachments").download(FILE_B);
    expect(other.data).toBeNull();
    const internal = await userA.storage.from("attachments").download(FILE_INTERNAL);
    expect(internal.data).toBeNull();
  });

  it("A não consegue enviar arquivo para a pasta de B", async () => {
    const { error } = await userA.storage
      .from("attachments")
      .upload(`${SUPPLIER_B}/hack/x.pdf`, new Blob(["x"], { type: "application/pdf" }));
    expect(error).not.toBeNull();
  });

  it("A não consegue alterar nem gravar dados em nome de B", async () => {
    const upd = await userA.from("suppliers").update({ legal_name: "hack" }).eq("id", SUPPLIER_B).select();
    expect(upd.data ?? []).toEqual([]);
    const ins = await userA.from("attachments").insert({
      entity_table: "suppliers",
      entity_id: SUPPLIER_B,
      supplier_id: SUPPLIER_B,
      storage_path: `${SUPPLIER_B}/hack/y.pdf`,
      file_name: "y.pdf",
    });
    expect(ins.error?.code).toBe("42501");
  });

  it("A não consegue se promover a SQM", async () => {
    const { data: me } = await userA.auth.getUser();
    const { error } = await userA.from("users").update({ role: "sqm" }).eq("id", me.user!.id);
    expect(error).not.toBeNull();
  });

  it("B também só enxerga B", async () => {
    const { data } = await userB.from("suppliers").select("id");
    expect(data!.map((s) => s.id)).toEqual([SUPPLIER_B]);
  });

  it("SQE lê todos os fornecedores", async () => {
    const { data } = await sqe.from("suppliers").select("id");
    expect(data!.map((s) => s.id)).toEqual(expect.arrayContaining([SUPPLIER_A, SUPPLIER_B]));
  });

  it("ninguém apaga registros (regra 16)", async () => {
    const { error } = await sqe.from("suppliers").delete().eq("id", SUPPLIER_A);
    expect(error).not.toBeNull();
    const { data } = await sqe.from("suppliers").select("id").eq("id", SUPPLIER_A);
    expect(data!.length).toBe(1);
  });

  it("A não lê contatos, certificados, plantas nem subfornecedores de B", async () => {
    for (const table of ["contacts", "certifications", "plants", "sub_suppliers", "supplier_status_history"] as const) {
      const { data } = await userA.from(table).select("supplier_id").eq("supplier_id", SUPPLIER_B);
      expect(data, table).toEqual([]);
    }
  });

  it("A não vê normas, qualificação nem componentes de B", async () => {
    expect((await userA.from("standards").select("id")).data).toEqual([]);
    expect((await userA.from("qualifications").select("id")).data).toEqual([]);
    const { data } = await userA.from("components").select("gw_code");
    expect(data!.every((c) => c.gw_code.startsWith("GW-BLD"))).toBe(true);
  });

  it("A só vê as próprias notificações e não muda o próprio status", async () => {
    const { data: me } = await userA.auth.getUser();
    const { data } = await userA.from("notifications").select("recipient_id");
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((n) => n.recipient_id === me.user!.id)).toBe(true);
    const { error } = await userA.rpc("change_supplier_status", {
      p_supplier_id: SUPPLIER_A,
      p_status: "approved",
      p_justification: "tentativa do fornecedor",
    });
    expect(error?.code).toBe("42501");
  });
});
