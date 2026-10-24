import ExcelJS from "exceljs";
import { requireProfile } from "@/lib/auth";

// Planilha modelo para importar perguntas de checklist.
export async function GET() {
  await requireProfile(["sqe", "sqm"]);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("checklist");
  ws.columns = [
    { header: "elemento", key: "e", width: 10 },
    { header: "titulo_elemento_pt", key: "tp", width: 30 },
    { header: "titulo_elemento_en", key: "te", width: 30 },
    { header: "item", key: "i", width: 8 },
    { header: "pergunta_pt", key: "qp", width: 60 },
    { header: "pergunta_en", key: "qe", width: 60 },
    { header: "estrela", key: "s", width: 8 },
    { header: "escopo", key: "sc", width: 16 },
    { header: "ordem", key: "o", width: 8 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.addRow({ e: "P6", tp: "Análise do processo", te: "Process analysis", i: "6.1.1", qp: "Pergunta em português", qe: "Question in English", s: "S", sc: "infusion", o: 10 });
  ws.addRow({ e: "P6", tp: "Análise do processo", te: "Process analysis", i: "6.1.2", qp: "Outra pergunta", qe: "Another question", s: "", sc: "", o: 20 });
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="sqm-checklist-modelo.xlsx"',
    },
  });
}
