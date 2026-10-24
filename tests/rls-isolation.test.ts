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

  it("NC: A não vê NCs, 8D, custos ou comentários do B, nem custos e comentários internos", async () => {
    for (const table of ["ncs", "eight_d_steps", "nc_costs", "nc_comments", "nc_items"] as const) {
      const { data } = await userA.from(table).select("supplier_id").eq("supplier_id", SUPPLIER_B);
      expect(data, table).toEqual([]);
    }
    const { data: costs } = await userA.from("nc_costs").select("chargeable");
    expect(costs!.length).toBeGreaterThan(0);
    expect(costs!.every((c) => c.chargeable)).toBe(true);
    const { data: comments } = await userA.from("nc_comments").select("internal");
    expect(comments!.every((c) => !c.internal)).toBe(true);
    expect((await userA.from("lessons_learned").select("id")).data).toEqual([]);
  });

  it("NC: SQE vê o custo interno e o comentário interno", async () => {
    const { data: costs } = await sqe.from("nc_costs").select("chargeable");
    expect(costs!.some((c) => !c.chargeable)).toBe(true);
    const { data: comments } = await sqe.from("nc_comments").select("internal");
    expect(comments!.some((c) => c.internal)).toBe(true);
  });

  it("Auditorias: B não vê auditoria, respostas ou achados do A; fornecedor não vê plano nem modelos", async () => {
    for (const table of ["audits", "audit_answers", "findings"] as const) {
      const { data } = await userB.from(table).select("supplier_id").eq("supplier_id", SUPPLIER_A);
      expect(data, table).toEqual([]);
    }
    expect((await userA.from("audit_plans").select("id")).data).toEqual([]);
    expect((await userA.from("audit_templates").select("id")).data).toEqual([]);
  });

  it("Auditorias: fornecedor só vê respostas depois do relatório emitido", async () => {
    const { data: audits } = await userA.from("audits").select("id, status");
    expect(audits!.every((a) => a.status !== "planned")).toBe(true);
    const { data: answers } = await userA.from("audit_answers").select("audit_id");
    const issued = new Set(audits!.filter((a) => ["completed", "closed"].includes(a.status)).map((a) => a.id));
    expect(answers!.every((a) => issued.has(a.audit_id))).toBe(true);
  });
  it("Inspeções: B não vê peças, inspeções, resultados, reparos, concessões nem períodos do A", async () => {
    for (const table of ["serial_units", "inspections", "inspection_results", "repairs", "waivers", "controlled_shipment_periods"] as const) {
      const { data } = await userB.from(table).select("supplier_id").eq("supplier_id", SUPPLIER_A);
      expect(data, table).toEqual([]);
    }
  });

  it("Inspeções: fornecedor não muda etiqueta direto, não registra inspeção do SQE nem aprova concessão", async () => {
    const { data: units } = await userA.from("serial_units").select("id").limit(1);
    const tagUpdate = await userA.from("serial_units").update({ tag: "green" } as never).eq("id", units![0]!.id);
    expect(tagUpdate.error?.message).toBe("tag_workflow_only");
    const { data: comp } = await userA.from("supplier_components").select("component_id").limit(1);
    const insp = await userA.from("inspections").insert({ supplier_id: SUPPLIER_A, component_id: comp![0]!.component_id, type_code: "final_supplier" } as never);
    expect(insp.error).not.toBeNull();
    const { data: waiver } = await userA.from("waivers").select("id").eq("status", "requested").limit(1);
    const review = await userA.rpc("review_waiver", { p_waiver_id: waiver![0]!.id, p_approve: true, p_comment: null } as never);
    expect(review.error?.message).toBe("forbidden");
  });
  it("Etapa 6: pendências, fila de e-mail e rotinas não vazam nem são disparadas pelo fornecedor", async () => {
    const { data: mine } = await userA.rpc("my_pending_items");
    expect(mine!.length).toBeGreaterThan(0);
    expect(mine!.every((i) => i.supplier_id === SUPPLIER_A)).toBe(true);
    expect((await userA.from("email_outbox").select("id")).data).toEqual([]);
    expect((await sqe.from("email_outbox").select("id")).data).toEqual([]);
    expect((await userA.from("escalation_rules").select("id")).data).toEqual([]);
    for (const fn of ["run_daily_jobs", "claim_email_batch", "export_tables"] as const) {
      const { error } = await userA.rpc(fn as never);
      expect(error, fn).not.toBeNull();
    }
    expect((await sqe.rpc("export_tables")).error?.message).toBe("forbidden");
  });
});
