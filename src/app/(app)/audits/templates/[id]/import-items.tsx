"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileSpreadsheetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { importTemplateItems, parseTemplateFile, type TemplateItemInput } from "@/lib/actions/audits";

// Importação em duas etapas: lê a planilha, mostra para conferência e só então grava.
export function ImportItems({ templateId }: { templateId: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TemplateItemInput[] | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function read(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const r = await parseTemplateFile(fd);
      if (r.error) {
        setRows(null);
        return setError(t(r.error as never, { detail: r.detail ?? "" } as never));
      }
      setError(undefined);
      setRows(r.rows ?? []);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRows(null); setError(undefined); } }}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><FileSpreadsheetIcon />{t("templates.import")}</Button></DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("templates.import")}</DialogTitle>
          <DialogDescription>{t("templates.importHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Input type="file" accept=".xlsx,.csv" className="max-w-sm" aria-label={t("templates.import")}
            onChange={(e) => read(e.target.files?.[0])} />
          {/* Download de arquivo (route handler), não navegação: <a download>. */}
          <a href="/audits/templates/sample" download className="text-sm underline">{t("templates.downloadSample")}</a>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {rows && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("templates.preview")} — {t("templates.rows", { count: rows.length })}</p>
            <div className="max-h-72 overflow-auto rounded-md border text-xs">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="p-1.5">{t("templates.element")}</th><th className="p-1.5">{t("templates.itemCode")}</th>
                    <th className="p-1.5">{t("templates.questionPt")}</th><th className="p-1.5">*</th><th className="p-1.5">{t("templates.scope")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="p-1.5 font-mono">{r.element_code}</td><td className="p-1.5 font-mono">{r.item_code}</td>
                      <td className="p-1.5">{r.question_pt}</td><td className="p-1.5">{r.is_star ? "*" : ""}</td><td className="p-1.5">{r.scope_code ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button disabled={!rows?.length || pending} onClick={() => start(async () => {
            const r = await importTemplateItems(templateId, rows!);
            if (r?.error) return setError(t(r.error as never, { detail: "" } as never));
            toast.success(t("templates.imported"));
            setOpen(false);
            setRows(null);
          })}>{t("templates.confirmImport")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
