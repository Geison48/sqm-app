import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { pdfTranslator } from "./translator";

type Tr = ReturnType<typeof pdfTranslator>;

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontSize: 9, fontFamily: "Helvetica", color: "#171717" },
  header: { borderBottomWidth: 1, borderBottomColor: "#d4d4d4", paddingBottom: 8, marginBottom: 12 },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6 },
  muted: { color: "#737373" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "33.33%", marginBottom: 6, paddingRight: 6 },
  label: { fontSize: 7, color: "#737373", textTransform: "uppercase", marginBottom: 1 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5", paddingVertical: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  nok: { color: "#b91c1c", fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: "#a3a3a3", flexDirection: "row", justifyContent: "space-between" },
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.cell}>
      <Text style={s.label}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

function Footer({ left }: { left: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{left}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Relatório de inspeção
// ---------------------------------------------------------------------------
export type InspectionReportData = {
  number: string; type: string; supplier: string; component: string; date: string; location: string | null;
  result: string | null; status: string; plan: string | null; notes: string | null;
  units: {
    identifier: string; result: string | null;
    rows: { characteristic: string; spec: string; measured: string; ok: boolean | null; waiver: string | null; comment: string | null }[];
  }[];
};

export function InspectionReport({ data, tr }: { data: InspectionReportData; tr: Tr }) {
  const { t, date } = tr;
  const okText = (ok: boolean | null) => (ok === null ? "—" : ok ? t("inspections.ok") : t("inspections.nok"));
  return (
    <Document title={data.number}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.h1}>{data.number} · {data.type}</Text>
          <Text style={s.muted}>{data.supplier} · {data.component}</Text>
        </View>
        <View style={s.grid}>
          <Field label={t("inspections.date")} value={date(data.date)} />
          <Field label={t("inspections.location")} value={data.location ?? "—"} />
          <Field label={t("inspections.result")} value={data.result ? t(`inspections.results.${data.result}`) : t(`inspections.statuses.${data.status}`)} />
          <Field label={t("inspPlans.revision")} value={data.plan ?? "—"} />
        </View>
        {data.notes && <Text style={{ marginBottom: 6 }}>{data.notes}</Text>}
        {data.units.map((u) => (
          <View key={u.identifier} wrap>
            <Text style={s.h2}>{u.identifier}{u.result ? ` — ${t(`inspections.unitResult.${u.result}`)}` : ""}</Text>
            <View style={s.row}>
              <Text style={[s.th, { width: "30%" }]}>{t("inspections.characteristic")}</Text>
              <Text style={[s.th, { width: "20%" }]}>{t("inspections.spec")}</Text>
              <Text style={[s.th, { width: "18%" }]}>{t("inspections.measured")}</Text>
              <Text style={[s.th, { width: "10%" }]}>{t("inspections.result")}</Text>
              <Text style={[s.th, { width: "22%" }]}>{t("inspections.comment")}</Text>
            </View>
            {u.rows.map((r, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={{ width: "30%", paddingRight: 4 }}>{r.characteristic}</Text>
                <Text style={{ width: "20%", paddingRight: 4 }}>{r.spec || "—"}</Text>
                <Text style={{ width: "18%", paddingRight: 4 }}>{r.measured || "—"}</Text>
                <Text style={[{ width: "10%" }, r.ok === false && !r.waiver ? s.nok : {}]}>{okText(r.ok)}</Text>
                <Text style={{ width: "22%" }}>
                  {[r.waiver ? t("inspections.underWaiver", { number: r.waiver }) : null, r.comment].filter(Boolean).join(" · ") || "—"}
                </Text>
              </View>
            ))}
          </View>
        ))}
        <Footer left={`SQM App · ${data.number}`} />
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Índice da exportação ZIP
// ---------------------------------------------------------------------------
export type ExportIndexData = {
  scope: string; generatedAt: string; generatedBy: string;
  entries: { path: string; type: string; record: string; date: string | null }[];
};

export function ExportIndex({ data, tr }: { data: ExportIndexData; tr: Tr }) {
  const { t, date } = tr;
  return (
    <Document title={t("exports.indexTitle")}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <Text style={s.h1}>{t("exports.indexTitle")}</Text>
          <Text style={s.muted}>{data.scope}</Text>
        </View>
        <View style={s.grid}>
          <Field label={t("exports.generatedAt")} value={date(data.generatedAt, true)} />
          <Field label={t("exports.generatedBy")} value={data.generatedBy} />
          <Field label={t("exports.fileCount")} value={String(data.entries.length)} />
        </View>
        <View style={s.row} fixed>
          <Text style={[s.th, { width: "58%" }]}>{t("exports.path")}</Text>
          <Text style={[s.th, { width: "16%" }]}>{t("exports.type")}</Text>
          <Text style={[s.th, { width: "16%" }]}>{t("exports.record")}</Text>
          <Text style={[s.th, { width: "10%" }]}>{t("exports.date")}</Text>
        </View>
        {data.entries.map((e, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={{ width: "58%", paddingRight: 6, fontSize: 8 }}>{e.path}</Text>
            <Text style={{ width: "16%", paddingRight: 4 }}>{e.type}</Text>
            <Text style={{ width: "16%", paddingRight: 4 }}>{e.record}</Text>
            <Text style={{ width: "10%" }}>{date(e.date)}</Text>
          </View>
        ))}
        <Footer left={`SQM App · ${t("exports.indexTitle")}`} />
      </Page>
    </Document>
  );
}
