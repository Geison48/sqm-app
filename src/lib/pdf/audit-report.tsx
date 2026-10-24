import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { pdfTranslator } from "./translator";

type Tr = ReturnType<typeof pdfTranslator>;
type Lookup = { code: string; label_pt: string; label_en: string };

export type AuditReportData = {
  audit: {
    number: string; title: string | null; type_code: string; planned_start: string; planned_end: string; actual_start: string | null;
    actual_end: string | null; score_percent: number | null; classification: string | null; element_scores: Record<string, number>;
    downgrade_reasons: string[]; summary: string | null; scope_codes: string[]; report_issued_at: string | null; method: string | null;
  };
  supplier: string;
  template: string;
  auditors: string;
  answers: {
    id: string; element_code: string; element_title_pt: string | null; element_title_en: string | null; item_code: string;
    question_pt: string; question_en: string; is_star: boolean; score: number | null; result: string | null; not_applicable: boolean;
    comment: string | null;
  }[];
  findings: {
    classification: string; description: string; requirement: string | null; status: string; action_plan: string | null;
    action_responsible: string | null; action_due_date: string | null; nc_number: string | null;
  }[];
  photos: { caption: string; data: Buffer; format: "jpg" | "png" }[];
  lookups: { types: Lookup[]; scopes: Lookup[] };
};

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontSize: 9, fontFamily: "Helvetica", color: "#171717" },
  header: { borderBottomWidth: 1, borderBottomColor: "#d4d4d4", paddingBottom: 8, marginBottom: 12 },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6 },
  muted: { color: "#737373" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "33.33%", marginBottom: 6, paddingRight: 6 },
  label: { fontSize: 7, color: "#737373", textTransform: "uppercase", marginBottom: 1 },
  scoreBox: { flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 4, padding: 10, marginBottom: 8 },
  big: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5", paddingVertical: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  block: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 3, padding: 8, marginBottom: 6 },
  photo: { width: "31%", marginRight: "2%", marginBottom: 8 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: "#a3a3a3", flexDirection: "row", justifyContent: "space-between" },
});

const CLASS_COLOR: Record<string, string> = { A: "#059669", B: "#d97706", C: "#dc2626" };

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[s.cell, wide ? { width: "100%" } : {}]}>
      <Text style={s.label}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

export function AuditReport({ data, tr }: { data: AuditReportData; tr: Tr }) {
  const { t, lookup, date } = tr;
  const { audit } = data;
  const find = (list: Lookup[], code: string) => list.find((i) => i.code === code);
  const question = (a: AuditReportData["answers"][number]) => (tr.lang === "en" ? a.question_en : a.question_pt);
  const reason = (r: string) => {
    const [key, el] = r.split(":");
    return t(`audits.reasonLabels.${key}`, { el: el ?? "" });
  };
  const answerValue = (a: AuditReportData["answers"][number]) =>
    a.not_applicable ? t("audits.notApplicable") : a.score != null ? String(a.score) : a.result ? t(`audits.results.${a.result}`) : "—";
  const groups = new Map<string, AuditReportData["answers"]>();
  for (const a of data.answers) groups.set(a.element_code, [...(groups.get(a.element_code) ?? []), a]);

  return (
    <Document title={`${audit.number} — ${data.supplier}`} author="SQM App">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <Text style={s.h1}>{t("pdf.auditTitle")} · {audit.number}</Text>
          <Text style={s.muted}>{data.supplier}{audit.title ? ` · ${audit.title}` : ""}</Text>
        </View>

        <View style={s.grid}>
          <Field label={t("audits.supplier")} value={data.supplier} />
          <Field label={t("audits.type")} value={lookup(find(data.lookups.types, audit.type_code))} />
          <Field label={t("audits.template")} value={data.template} />
          <Field label={t("audits.actualDates")} value={audit.actual_start ? `${date(audit.actual_start)} – ${date(audit.actual_end)}` : "—"} />
          <Field label={t("audits.auditors")} value={data.auditors || "—"} />
          <Field label={t("audits.scopes")} value={audit.scope_codes.map((c) => lookup(find(data.lookups.scopes, c))).join(", ") || "—"} />
        </View>

        <View style={s.scoreBox} wrap={false}>
          <View>
            <Text style={s.label}>{t("audits.score")}</Text>
            <Text style={s.big}>{audit.score_percent != null ? `${audit.score_percent}%` : "—"}</Text>
          </View>
          <View>
            <Text style={s.label}>{t("audits.classification")}</Text>
            <Text style={[s.big, { color: CLASS_COLOR[audit.classification ?? ""] ?? "#171717" }]}>{audit.classification ?? "—"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {audit.downgrade_reasons.length > 0 && (
              <>
                <Text style={s.label}>{t("audits.reasons")}</Text>
                {audit.downgrade_reasons.map((r) => <Text key={r}>• {reason(r)}</Text>)}
              </>
            )}
          </View>
        </View>

        {Object.keys(audit.element_scores).length > 0 && (
          <View wrap={false}>
            <Text style={s.h2}>{t("audits.elements")}</Text>
            <View style={s.grid}>
              {Object.entries(audit.element_scores).map(([el, pct]) => <Field key={el} label={el} value={`${pct}%`} />)}
            </View>
          </View>
        )}

        {audit.summary && <Field label={t("audits.summary")} value={audit.summary} wide />}

        <Text style={s.h2}>{t("findings.title")}</Text>
        {data.findings.length === 0 && <Text style={s.muted}>{t("findings.empty")}</Text>}
        {data.findings.map((f, i) => (
          <View key={i} style={s.block} wrap={false}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>
              {t(`findings.classifications.${f.classification}`)} — {t(`findings.statuses.${f.status}`)}
              {f.nc_number ? ` · ${f.nc_number}` : ""}
            </Text>
            <Text>{f.description}</Text>
            {f.requirement && <Text style={s.muted}>{t("findings.requirement")}: {f.requirement}</Text>}
            {f.action_plan && (
              <Text style={{ marginTop: 3 }}>
                {t("findings.actionPlan")}: {f.action_plan} ({f.action_responsible}, {date(f.action_due_date)})
              </Text>
            )}
          </View>
        ))}

        <Text style={s.h2} break>{t("audits.tabs.checklist")}</Text>
        {[...groups.entries()].map(([el, items]) => (
          <View key={el} style={{ marginBottom: 8 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
              {el} {lookup({ label_pt: items[0]!.element_title_pt ?? "", label_en: items[0]!.element_title_en ?? "" })}
            </Text>
            {items.map((a) => (
              <View key={a.id} style={s.row} wrap={false}>
                <Text style={{ width: "10%" }}>{a.item_code}{a.is_star ? " *" : ""}</Text>
                <View style={{ width: "72%", paddingRight: 4 }}>
                  <Text>{question(a)}</Text>
                  {tr.lang === "both" && <Text style={s.muted}>{a.question_en}</Text>}
                  {a.comment && <Text style={s.muted}>{a.comment}</Text>}
                </View>
                <Text style={{ width: "18%", textAlign: "right" }}>{answerValue(a)}</Text>
              </View>
            ))}
          </View>
        ))}

        {data.photos.length > 0 && (
          <View>
            <Text style={s.h2} break>{t("pdf.photos")}</Text>
            <View style={s.grid}>
              {data.photos.map((p, i) => (
                <View key={i} style={s.photo} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf (PDF), sem alt */}
                  <Image src={{ data: p.data, format: p.format }} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                  <Text style={[s.muted, { marginTop: 2 }]}>{p.caption}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>SQM App · {audit.number} · {t("pdf.generatedAt")} {date(new Date().toISOString(), true)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${t("pdf.page")} ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
