import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { DISCIPLINE_FIELDS, type Discipline, type StepContent } from "@/lib/eight-d";
import type { pdfTranslator } from "./translator";

type Tr = ReturnType<typeof pdfTranslator>;
type Lookup = { code: string; label_pt: string; label_en: string };

export type NcReportData = {
  nc: {
    number: string; title: string; description: string; type: string; status: string; detected_on: string;
    detected_location: string | null; quantity_affected: number | null; customer_affected: boolean; opened_at: string;
    origin_code: string; severity_code: string; failure_mode_code: string | null; disposition_code: string | null;
    disposition_notes: string | null; supplier_action: string | null; sqe_review_comment: string | null;
    effectiveness_method: string | null; effectiveness_target: string | null; effectiveness_result: string | null;
    effectiveness_verified: boolean; closed_at: string | null; cancelled_at: string | null;
  };
  supplier: string;
  component: string | null;
  items: { sn_or_lot: string; quantity: number | null }[];
  steps: { discipline: string; status: string; content: StepContent; review_comment: string | null; reviewed_at: string | null }[];
  containment: { location_code: string; sn_or_lot: string | null; qty_checked: number; qty_ok: number; qty_nok: number; action_taken: string | null }[];
  rca: Record<string, Record<string, unknown>>;
  costs: { description: string; amount: number; currency: string; status: string; chargeable: boolean }[];
  lesson: { failure: string; root_cause: string; action: string } | null;
  lookups: Record<"origins" | "severities" | "failureModes" | "dispositions" | "disciplines" | "locations", Lookup[]>;
};

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontSize: 9, fontFamily: "Helvetica", color: "#171717" },
  header: { borderBottomWidth: 1, borderBottomColor: "#d4d4d4", paddingBottom: 8, marginBottom: 12 },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  muted: { color: "#737373" },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6 },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "33.33%", marginBottom: 6, paddingRight: 6 },
  label: { fontSize: 7, color: "#737373", textTransform: "uppercase", marginBottom: 1 },
  block: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 3, padding: 8, marginBottom: 8 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5", paddingVertical: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: "#a3a3a3", flexDirection: "row", justifyContent: "space-between" },
});

const find = (list: Lookup[], code: string | null) => list.find((i) => i.code === code);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : typeof v === "boolean" ? null : "—");

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[s.cell, wide ? { width: "100%" } : {}]}>
      <Text style={s.label}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

function Table({ cols, rows }: { cols: { label: string; width: string; align?: "right" }[]; rows: string[][] }) {
  return (
    <View>
      <View style={s.row}>
        {cols.map((c) => <Text key={c.label} style={[s.th, { width: c.width, textAlign: c.align, paddingRight: 4 }]}>{c.label}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          {r.map((v, j) => <Text key={j} style={{ width: cols[j]!.width, textAlign: cols[j]!.align, paddingRight: 4 }}>{v}</Text>)}
        </View>
      ))}
    </View>
  );
}

function StepBody({ d, content, tr }: { d: Discipline; content: StepContent; tr: Tr }) {
  const { t } = tr;
  return (
    <View>
      {DISCIPLINE_FIELDS[d].map((f) => {
        const label = t(`eightD.fields.${f.key}`);
        if (f.type === "list") {
          const rows = Array.isArray(content[f.key]) ? (content[f.key] as Record<string, string>[]) : [];
          if (!rows.length) return <Field key={f.key} label={label} value="—" wide />;
          const width = `${100 / f.columns.length}%`;
          return (
            <View key={f.key} style={{ marginBottom: 6 }}>
              <Text style={s.label}>{label}</Text>
              <Table
                cols={f.columns.map((c) => ({ label: t(`eightD.fields.${c.key}`), width }))}
                rows={rows.map((r) => f.columns.map((c) =>
                  c.type === "select" && r[c.key] ? t(`eightD.${c.optionsNamespace}.${r[c.key]}`) : r[c.key] || "—"))}
              />
            </View>
          );
        }
        if (f.type === "checkbox") return <Field key={f.key} label={label} value={content[f.key] ? t("common.yes") : t("common.no")} wide />;
        return <Field key={f.key} label={label} value={str(content[f.key]) ?? "—"} wide />;
      })}
    </View>
  );
}

export function NcReport({ data, tr }: { data: NcReportData; tr: Tr }) {
  const { t, lookup, date, money } = tr;
  const { nc, lookups } = data;
  const ishikawa = data.rca.ishikawa ?? {};
  const whys = data.rca["5why_3legs"] ?? {};

  return (
    <Document title={`${nc.number} — ${nc.title}`} author="SQM App">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <Text style={s.h1}>{t("pdf.title")} · {nc.number}</Text>
          <Text style={s.muted}>{nc.title}</Text>
        </View>

        <View style={s.grid}>
          <Field label={t("ncs.supplier")} value={data.supplier} />
          <Field label={t("ncs.component")} value={data.component ?? "—"} />
          <Field label={t("ncs.type")} value={t(`ncs.types.${nc.type}`)} />
          <Field label={t("ncs.origin")} value={lookup(find(lookups.origins, nc.origin_code))} />
          <Field label={t("ncs.severity")} value={lookup(find(lookups.severities, nc.severity_code))} />
          <Field label={t("ncs.failureMode")} value={lookup(find(lookups.failureModes, nc.failure_mode_code))} />
          <Field label={t("ncs.status")} value={t(`ncs.statuses.${nc.cancelled_at ? "cancelled" : nc.status}`)} />
          <Field label={t("ncs.detectedOn")} value={date(nc.detected_on)} />
          <Field label={t("ncs.openedAt")} value={date(nc.opened_at, true)} />
          <Field label={t("ncs.detectedLocation")} value={nc.detected_location ?? "—"} />
          <Field label={t("ncs.quantityAffected")} value={nc.quantity_affected != null ? String(nc.quantity_affected) : "—"} />
          <Field label={t("ncs.customerAffected")} value={nc.customer_affected ? t("common.yes") : t("common.no")} />
          <Field label={t("ncs.description")} value={nc.description} wide />
          <Field label={t("ncs.items")} value={data.items.map((i) => `${i.sn_or_lot}${i.quantity != null ? ` (${i.quantity})` : ""}`).join(", ") || "—"} wide />
        </View>

        {nc.type === "simple" && (
          <View style={s.block}>
            <Field label={t("ncs.disposition")} value={lookup(find(lookups.dispositions, nc.disposition_code))} wide />
            <Field label={t("ncs.dispositionNotes")} value={nc.disposition_notes ?? "—"} wide />
            <Field label={t("ncs.supplierAction")} value={nc.supplier_action ?? "—"} wide />
            <Field label={t("ncs.sqeComment")} value={nc.sqe_review_comment ?? "—"} wide />
          </View>
        )}

        {data.steps.map((step) => {
          const d = step.discipline as Discipline;
          return (
            <View key={d} style={s.block} wrap>
              <Text style={s.h3}>
                {d} · {lookup(find(lookups.disciplines, d))} — {t(`eightD.stepStatus.${step.status}`)}
                {step.status === "approved" && step.reviewed_at ? ` (${date(step.reviewed_at)})` : ""}
              </Text>
              {d === "D3" && data.containment.length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={s.label}>{t("eightD.containment.title")}</Text>
                  <Table
                    cols={[
                      { label: t("eightD.containment.location"), width: "20%" },
                      { label: t("eightD.containment.snOrLot"), width: "20%" },
                      { label: t("eightD.containment.checked"), width: "10%", align: "right" },
                      { label: t("eightD.containment.ok"), width: "10%", align: "right" },
                      { label: t("eightD.containment.nok"), width: "10%", align: "right" },
                      { label: t("eightD.containment.action"), width: "30%" },
                    ]}
                    rows={data.containment.map((c) => [
                      lookup(find(lookups.locations, c.location_code)), c.sn_or_lot ?? "—", String(c.qty_checked),
                      String(c.qty_ok), String(c.qty_nok), c.action_taken ?? "—",
                    ])}
                  />
                </View>
              )}
              {d === "D4" && Object.keys(ishikawa).length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={s.label}>{t("rca.tools.ishikawa")}</Text>
                  <View style={s.grid}>
                    {(["method", "machine", "material", "manpower", "measurement", "environment"] as const).map((m) => (
                      <Field key={m} label={t(`rca.ishikawa.${m}`)}
                        value={(Array.isArray(ishikawa[m]) ? (ishikawa[m] as string[]) : []).filter(Boolean).join("; ") || "—"} />
                    ))}
                  </View>
                </View>
              )}
              {d === "D4" && Object.keys(whys).length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={s.label}>{t("rca.tools.5why_3legs")}</Text>
                  {(["occurrence", "non_detection", "systemic"] as const).map((leg) => {
                    const l = (whys[leg] ?? {}) as { whys?: string[]; root_cause?: string };
                    const chain = (l.whys ?? []).filter(Boolean);
                    if (!chain.length && !l.root_cause) return null;
                    return <Field key={leg} label={t(`rca.legs.${leg}`)} value={`${chain.join(" > ")}${l.root_cause ? ` => ${l.root_cause}` : ""}`} wide />;
                  })}
                </View>
              )}
              {step.status === "not_started" ? <Text style={s.muted}>{t("pdf.notSubmitted")}</Text>
                : <StepBody d={d} content={step.content} tr={tr} />}
              {step.review_comment && <Field label={t("eightD.sqeFeedback")} value={step.review_comment} wide />}
            </View>
          );
        })}

        {data.costs.length > 0 && (
          <View wrap={false}>
            <Text style={s.h2}>{t("costs.title")}</Text>
            <Table
              cols={[
                { label: t("costs.description"), width: "50%" },
                { label: t("costs.status"), width: "25%" },
                { label: t("costs.amount"), width: "25%", align: "right" },
              ]}
              rows={data.costs.map((c) => [
                c.chargeable ? c.description : `${c.description} (${t("costs.internalBadge")})`,
                c.chargeable ? t(`costs.statuses.${c.status}`) : "—",
                money(c.amount, c.currency),
              ])}
            />
          </View>
        )}

        {nc.type === "8d" && (nc.effectiveness_method || data.lesson) && (
          <View wrap={false}>
            <Text style={s.h2}>{t("closure.title")}</Text>
            <View style={s.grid}>
              <Field label={t("closure.method")} value={nc.effectiveness_method ? t(`closure.methods.${nc.effectiveness_method}`) : "—"} />
              <Field label={t("closure.target")} value={nc.effectiveness_target ?? "—"} />
              <Field label={t("closure.verified")} value={nc.effectiveness_verified ? t("common.yes") : t("common.no")} />
              <Field label={t("closure.result")} value={nc.effectiveness_result ?? "—"} wide />
              {data.lesson && <Field label={t("closure.lesson")} value={`${data.lesson.failure} | ${data.lesson.root_cause} | ${data.lesson.action}`} wide />}
              {nc.closed_at && <Field label={t("ncs.statuses.closed")} value={date(nc.closed_at, true)} />}
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>SQM App · {nc.number} · {t("pdf.generatedAt")} {date(new Date().toISOString(), true)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${t("pdf.page")} ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
