import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BanIcon, WrenchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { RecordDialog } from "@/components/shared/record-dialog";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { UnitTag } from "@/components/shared/unit-tag";
import { ToneBadge } from "@/components/shared/badges";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookup, lookupLabel } from "@/lib/lookups";
import { completeRepair, openRepair, scrapUnit } from "@/lib/actions/inspections";

const DOT: Record<string, string> = { success: "bg-emerald-500", danger: "bg-red-500", warning: "bg-amber-400", info: "bg-sky-500" };

type Event = { at: string; kind: string; text: string; href?: string; tone: string };

// Página do SN: rastreabilidade completa (inspeções, reparos, concessões, NCs, documentos).
export default async function UnitPage({ params }: PageProps<"/inspections/units/[id]">) {
  const profile = await requireProfile();
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();
  const { data: unit } = await supabase.from("serial_units")
    .select("*, suppliers(legal_name), components(gw_code, description)").eq("id", id).maybeSingle();
  if (!unit) notFound();

  const [{ data: canWrite }, { data: canManage }, types, { data: insp }, { data: repairs }, { data: waivers }, { data: ncItems }] = await Promise.all([
    supabase.rpc("can_write_supplier_row", { p_supplier_id: unit.supplier_id }),
    supabase.rpc("can_manage_supplier", { p_supplier_id: unit.supplier_id }),
    getLookup("inspection_types", true),
    supabase.from("inspection_units").select("result, inspections(id, number, type_code, status, created_at, completed_at)").eq("serial_unit_id", id),
    supabase.from("repairs").select("*").eq("serial_unit_id", id).is("cancelled_at", null).order("created_at"),
    supabase.from("waivers").select("id, number, status, created_at, serial_unit_ids, inspection_results(serial_unit_id)")
      .eq("supplier_id", unit.supplier_id).eq("component_id", unit.component_id),
    supabase.from("nc_items").select("ncs(id, number, title, opened_at)").or(`serial_unit_id.eq.${id},sn_or_lot.ilike.${unit.identifier}`),
  ]);

  const events: Event[] = [{ at: unit.created_at, kind: "created", text: t("units.events.created"), tone: "neutral" }];
  for (const i of insp ?? []) {
    if (!i.inspections) continue;
    events.push({ at: i.inspections.completed_at ?? i.inspections.created_at, kind: "inspection", href: `/inspections/${i.inspections.id}`,
      tone: i.result === "rejected" ? "danger" : i.result === "approved" ? "success" : "info",
      text: t("units.events.inspection", { number: i.inspections.number,
        type: lookupLabel(types.find((x) => x.code === i.inspections!.type_code), locale),
        result: i.result ? t(`inspections.unitResult.${i.result as "approved"}`) : t(`inspections.statuses.${i.inspections.status as "in_progress"}`) }) });
  }
  for (const r of repairs ?? []) {
    events.push({ at: r.created_at, kind: "repair", tone: "warning", text: t("units.events.repair_open", { description: r.description }) });
    if (r.status === "completed" && r.completed_on) {
      events.push({ at: r.updated_at, kind: "repair", tone: "success", text: t("units.events.repair_done", { description: r.description }) });
    }
  }
  for (const w of waivers ?? []) {
    const used = (w.inspection_results as { serial_unit_id: string }[]).some((r) => r.serial_unit_id === id);
    if (!used && !w.serial_unit_ids.includes(id)) continue;
    events.push({ at: w.created_at, kind: "waiver", href: "/inspections/waivers", tone: "info",
      text: t("units.events.waiver", { number: w.number, status: t(`waivers.statuses.${w.status as "approved"}`) }) });
  }
  for (const n of ncItems ?? []) {
    if (!n.ncs) continue;
    events.push({ at: n.ncs.opened_at, kind: "nc", href: `/ncs/${n.ncs.id}`, tone: "danger", text: t("units.events.nc", { number: n.ncs.number, title: n.ncs.title }) });
  }
  events.sort((a, b) => b.at.localeCompare(a.at) || Number(a.kind === "created") - Number(b.kind === "created"));
  const openRepairRow = (repairs ?? []).find((r) => r.status === "open");
  const path = `/inspections/units/${id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="font-mono">{unit.identifier}</span>}
        description={<>{unit.suppliers?.legal_name} · <span className="font-mono">{unit.components?.gw_code}</span> {unit.components?.description}
          {unit.kind === "lot" && <> · {t("units.kinds.lot")} {unit.quantity}</>}</>}
        actions={
          <>
            {canWrite && !unit.scrapped && !openRepairRow && (
              <RecordDialog trigger={<Button variant="outline"><WrenchIcon />{t("repairs.open")}</Button>} title={t("repairs.open")}
                hidden={{ serial_unit_id: id }} action={openRepair} fields={[
                  { name: "description", label: t("repairs.description"), type: "textarea", required: true },
                  { name: "performed_by", label: t("repairs.performedBy"), span: 1 },
                  { name: "started_on", label: t("repairs.startedOn"), type: "date", span: 1, defaultValue: new Date().toISOString().slice(0, 10) },
                ]} />
            )}
            {canWrite && openRepairRow && (
              <RecordDialog trigger={<Button>{t("repairs.complete")}</Button>} title={t("repairs.complete")}
                hidden={{ id: openRepairRow.id, serial_unit_id: id }} action={completeRepair}
                fields={[{ name: "completion_notes", label: t("repairs.completionNotes"), type: "textarea" }]} />
            )}
            {canManage && unit.tag === "red" && !unit.scrapped && (
              <RecordDialog trigger={<Button variant="outline"><BanIcon />{t("units.scrap")}</Button>} title={t("units.scrap")}
                hidden={{ id }} action={scrapUnit} fields={[{ name: "reason", label: t("units.scrapReason"), type: "textarea", required: true }]} />
            )}
          </>
        }
      >
        <div className="pt-1"><UnitTag tag={unit.tag} scrapped={unit.scrapped} long /></div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-3">
          <h2 className="font-medium">{t("units.timeline")}</h2>
          <ol className="relative space-y-4 border-l pl-5">
            {events.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-muted-foreground" />
                <p className="text-xs text-muted-foreground">{format.dateTime(new Date(e.at), { dateStyle: "short" })}</p>
                <p className="text-sm">
                  {e.href ? <Link href={e.href} className="hover:underline">{e.text}</Link> : e.text}{" "}
                  {e.kind !== "created" && <span className={`ml-1 inline-block size-2 rounded-full align-middle ${DOT[e.tone] ?? "bg-muted-foreground"}`} />}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="font-medium">{t("repairs.title")}</h2>
          {(repairs ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{t("repairs.empty")}</p> : (repairs ?? []).map((r) => (
            <div key={r.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{r.description}</p>
                <ToneBadge tone={r.status === "open" ? "warning" : "success"}>{t(`repairs.statuses.${r.status as "open"}`)}</ToneBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                {r.performed_by && <>{t("repairs.performedBy")}: {r.performed_by} · </>}
                {format.dateTime(new Date(`${r.started_on}T12:00:00`), { dateStyle: "short" })}
                {r.completed_on && <> – {format.dateTime(new Date(`${r.completed_on}T12:00:00`), { dateStyle: "short" })}</>}
              </p>
              {r.completion_notes && <p className="text-sm">{r.completion_notes}</p>}
              {(["before", "after"] as const).map((cat) => (
                <div key={cat} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">{t(`repairs.${cat}`)}</p>
                  <AttachmentsPanel target={{ entityTable: "repairs", entityId: r.id, supplierId: unit.supplier_id, path, category: cat }}
                    canUpload={!!canWrite} canManage={!!canWrite} allowInternal={false} />
                </div>
              ))}
            </div>
          ))}

          <h2 className="pt-2 font-medium">{t("units.documents")}</h2>
          <AttachmentsPanel target={{ entityTable: "serial_units", entityId: id, supplierId: unit.supplier_id, path }}
            canUpload={!!canWrite} canManage={!!canWrite} allowInternal={profile.role !== "supplier"} />
        </section>
      </div>
    </div>
  );
}
