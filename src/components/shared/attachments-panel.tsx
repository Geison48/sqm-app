import { getFormatter, getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatBytes } from "@/lib/format";
import { EmptyState } from "./empty-state";
import { CancelRecordButton } from "./cancel-record-button";
import { AttachmentDownloadButton, AttachmentUploadButton, type UploadTarget } from "./attachment-buttons";

// Lista de anexos de qualquer registro, com versões. A RLS esconde do
// fornecedor os anexos internos e os de outros fornecedores.
export async function AttachmentsPanel({
  target,
  canUpload,
  canManage,
  allowInternal,
  forceInternal = false,
}: {
  target: UploadTarget;
  canUpload: boolean;
  canManage: boolean;
  allowInternal: boolean;
  /** Registro interno (ex.: qualificação): todo anexo é gravado como interno. */
  forceInternal?: boolean;
}) {
  const t = await getTranslations("attachments");
  const format = await getFormatter();
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("id, file_name, version, internal_only, size_bytes, created_at, supersedes_id, description")
    .eq("entity_table", target.entityTable)
    .eq("entity_id", target.entityId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const superseded = new Set(rows.map((r) => r.supersedes_id).filter(Boolean));
  const current = rows.filter((r) => !superseded.has(r.id));
  const older = rows.filter((r) => superseded.has(r.id));

  return (
    <div className="space-y-3">
      {canUpload && (
        <div className="flex justify-end">
          <AttachmentUploadButton target={target} allowInternal={allowInternal} forceInternal={forceInternal} />
        </div>
      )}
      {current.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("file")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("size")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("uploadedAt")}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {current.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="max-w-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{a.file_name}</span>
                      <Badge variant="outline">{t("version", { version: a.version })}</Badge>
                      {a.internal_only && <Badge variant="secondary">{t("internalBadge")}</Badge>}
                    </div>
                    {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatBytes(a.size_bytes)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {format.dateTime(new Date(a.created_at), { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <AttachmentDownloadButton id={a.id} />
                      {canUpload && (
                        <AttachmentUploadButton
                          target={target}
                          allowInternal={allowInternal}
                          forceInternal={forceInternal}
                          supersedes={{ id: a.id, internalOnly: a.internal_only }}
                        />
                      )}
                      {canManage && <CancelRecordButton table="attachments" id={a.id} path={target.path} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {older.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("history")}</summary>
          <ul className="mt-2 space-y-1">
            {older.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <AttachmentDownloadButton id={a.id} />
                <span>{a.file_name}</span>
                <Badge variant="outline">{t("version", { version: a.version })}</Badge>
                <span className="text-muted-foreground">
                  {format.dateTime(new Date(a.created_at), { dateStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
