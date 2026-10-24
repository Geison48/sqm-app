import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ScoreResult } from "@/lib/actions/audits";
import { Runner } from "./runner";

export async function generateMetadata() {
  const t = await getTranslations("execute");
  return { title: t("title") };
}

export default async function ExecutePage({ params }: PageProps<"/audits/[id]/execute">) {
  await requireProfile(["sqe", "sqm"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data: audit } = await supabase.from("audits")
    .select("id, number, status, supplier_id, suppliers(legal_name), audit_templates(method)").eq("id", id).maybeSingle();
  if (!audit) notFound();
  const { data: canExecute } = await supabase.rpc("can_execute_audit", { p_audit_id: id });
  if (!canExecute || audit.status !== "in_progress") redirect(`/audits/${id}`);

  const [{ data: answers }, { data: score }] = await Promise.all([
    supabase.from("audit_answers").select("id, element_code, element_title_pt, element_title_en, item_code, question_pt, question_en, is_star, score, result, not_applicable, comment, evidence")
      .eq("audit_id", id).is("cancelled_at", null).order("sort_order"),
    supabase.rpc("audit_score", { p_audit_id: id }),
  ]);
  const answerIds = (answers ?? []).map((a) => a.id);
  const { data: files } = answerIds.length
    ? await supabase.from("attachments").select("id, entity_id, storage_path, file_name, mime_type")
        .eq("entity_table", "audit_answers").in("entity_id", answerIds).is("cancelled_at", null)
    : { data: [] as { id: string; entity_id: string; storage_path: string; file_name: string; mime_type: string | null }[] };
  const images = (files ?? []).filter((f) => f.mime_type?.startsWith("image/"));
  const { data: signed } = images.length
    ? await supabase.storage.from("attachments").createSignedUrls(images.map((f) => f.storage_path), 600)
    : { data: [] as { signedUrl: string }[] };
  const photosByAnswer: Record<string, { id: string; url: string; name: string }[]> = {};
  images.forEach((f, i) => {
    const url = signed?.[i]?.signedUrl;
    if (url) (photosByAnswer[f.entity_id] ??= []).push({ id: f.id, url, name: f.file_name });
  });

  return (
    <Runner
      audit={{ id: audit.id, number: audit.number, supplierId: audit.supplier_id, supplierName: audit.suppliers?.legal_name ?? "",
        method: (audit.audit_templates?.method ?? "vda63") as "vda63" | "gwi" }}
      answers={answers ?? []}
      initialScore={score as ScoreResult | null}
      photos={photosByAnswer}
    />
  );
}
