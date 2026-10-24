import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { ToneBadge } from "@/components/shared/badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { createTemplate, saveTemplateItem } from "@/lib/actions/audits";
import type { Database } from "@/lib/database.types";
import { TemplateActions } from "./template-actions";
import { ImportItems } from "./import-items";

type Item = Database["public"]["Tables"]["audit_template_items"]["Row"];
const STATUS_TONE: Record<string, string> = { draft: "neutral", active: "success", retired: "neutral" };

export default async function TemplatePage({ params }: PageProps<"/audits/templates/[id]">) {
  await requireProfile(["sqe", "sqm"]);
  const { id } = await params;
  const t = await getTranslations("templates");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: template } = await supabase.from("audit_templates").select("*").eq("id", id).maybeSingle();
  if (!template) notFound();
  const [{ data }, scopes] = await Promise.all([
    supabase.from("audit_template_items").select("*").eq("template_id", id).is("cancelled_at", null).order("sort_order"),
    getLookup("audit_scopes"),
  ]);
  const items = data ?? [];
  const draft = template.status === "draft";
  const path = `/audits/templates/${id}`;
  const groups = new Map<string, Item[]>();
  for (const i of items) groups.set(i.element_code, [...(groups.get(i.element_code) ?? []), i]);

  const fields = (i?: Item): FieldDef[] => [
    { name: "element_code", label: t("element"), required: true, span: 1, defaultValue: i?.element_code, placeholder: template.method === "vda63" ? "P6" : "G" },
    { name: "item_code", label: t("itemCode"), required: true, span: 1, defaultValue: i?.item_code },
    { name: "element_title_pt", label: t("elementTitlePt"), span: 1, defaultValue: i?.element_title_pt },
    { name: "element_title_en", label: t("elementTitleEn"), span: 1, defaultValue: i?.element_title_en },
    { name: "question_pt", label: t("questionPt"), type: "textarea", required: true, defaultValue: i?.question_pt },
    { name: "question_en", label: t("questionEn"), type: "textarea", required: true, defaultValue: i?.question_en },
    { name: "guidance_pt", label: t("guidancePt"), type: "textarea", defaultValue: i?.guidance_pt },
    { name: "guidance_en", label: t("guidanceEn"), type: "textarea", defaultValue: i?.guidance_en },
    { name: "scope_code", label: t("scope"), type: "select", span: 1, placeholder: t("allScopes"),
      options: scopes.map((s) => ({ value: s.code, label: lookupLabel(s, locale) })), defaultValue: i?.scope_code },
    { name: "sort_order", label: t("sortOrder"), type: "number", span: 1, defaultValue: i?.sort_order ?? (items.length + 1) * 10 },
    ...(template.method === "vda63" ? [{ name: "is_star", label: t("isStar"), type: "checkbox" as const, defaultValue: i?.is_star }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={<><span className="font-mono">{template.code}</span> v{template.version}</>}
        description={locale === "en" ? template.name_en : template.name_pt}
        actions={
          <>
            {draft && (
              <RecordDialog trigger={<Button variant="outline"><PencilIcon />{t("name")}</Button>} title={t("name")} hidden={{ id }}
                action={createTemplate} fields={[
                  { name: "name_pt", label: t("namePt"), required: true, defaultValue: template.name_pt },
                  { name: "name_en", label: t("nameEn"), required: true, defaultValue: template.name_en },
                  { name: "notes", label: t("notes"), type: "textarea", defaultValue: template.notes },
                ]} />
            )}
            <TemplateActions templateId={id} status={template.status} />
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ToneBadge tone={STATUS_TONE[template.status]!}>{t(`statuses.${template.status as "draft"}`)}</ToneBadge>
          <span className="text-sm text-muted-foreground">{t(`methods.${template.method as "gwi"}`)} · {t("items")}: {items.length}</span>
        </div>
      </PageHeader>
      {template.notes && <p className="text-sm text-muted-foreground">{template.notes}</p>}
      {!draft && <p className="rounded-md bg-muted p-3 text-sm">{t("readOnlyHint")}</p>}

      {draft && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ImportItems templateId={id} />
          <RecordDialog trigger={<AddButton label={t("addItem")} />} title={t("addItem")} hidden={{ template_id: id }}
            action={saveTemplateItem} fields={fields()} />
        </div>
      )}

      {items.length === 0 ? <EmptyState>—</EmptyState> : [...groups.entries()].map(([el, list]) => (
        <section key={el} className="space-y-2">
          <h2 className="font-medium"><span className="font-mono">{el}</span> {locale === "en" ? list[0]!.element_title_en : list[0]!.element_title_pt}</h2>
          <ul className="divide-y rounded-lg border">
            {list.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0 space-y-1 text-sm">
                  <p>
                    <span className="font-mono text-xs text-muted-foreground">{i.item_code}</span>{" "}
                    {i.is_star && <span className="font-semibold text-amber-600">*</span>} {locale === "en" ? i.question_en : i.question_pt}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locale === "en" ? i.question_pt : i.question_en}
                    {i.scope_code && <> · {t("scope")}: {lookupLabel(scopes.find((s) => s.code === i.scope_code), locale)}</>}
                  </p>
                </div>
                {draft && (
                  <div className="flex shrink-0 flex-wrap justify-end">
                    <RecordDialog trigger={<EditButton label={t("editItem")} />} title={t("editItem")}
                      hidden={{ id: i.id, template_id: id }} action={saveTemplateItem} fields={fields(i)} />
                    <CancelRecordButton table="audit_template_items" id={i.id} path={path} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
