import { getFormatter, getTranslations } from "next-intl/server";
import { PaperclipIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/badges";
import { DetailsDialog } from "@/components/shared/details-dialog";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { createClient } from "@/lib/supabase/server";
import { saveCertification } from "@/lib/actions/suppliers";
import { daysUntil } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Cert = Database["public"]["Tables"]["certifications"]["Row"];

export async function CertificationsTab({
  supplierId,
  canEdit,
  internal,
}: {
  supplierId: string;
  canEdit: boolean;
  internal: boolean;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const supabase = await createClient();
  const [{ data }, { data: subSuppliers }, { data: standards }] = await Promise.all([
    supabase.from("certifications").select("*").eq("supplier_id", supplierId).is("cancelled_at", null)
      .order("valid_until", { ascending: true, nullsFirst: false }),
    supabase.from("sub_suppliers").select("id, name").eq("supplier_id", supplierId).is("cancelled_at", null).order("name"),
    internal
      ? supabase.from("standards").select("id, code, revision").is("cancelled_at", null).order("code")
      : Promise.resolve({ data: [] as { id: string; code: string; revision: string | null }[] }),
  ]);
  const certs = data ?? [];
  const subById = new Map((subSuppliers ?? []).map((s) => [s.id, s.name]));
  const path = `/suppliers/${supplierId}?tab=certifications`;

  const fields = (c?: Cert): FieldDef[] => {
    const list: FieldDef[] = [
      { name: "standard_name", label: t("certifications.standardName"), required: true, span: 1,
        defaultValue: c?.standard_name, placeholder: "ISO 9001:2015" },
      { name: "certificate_number", label: t("certifications.number"), span: 1, defaultValue: c?.certificate_number },
      { name: "issuer", label: t("certifications.issuer"), span: 1, defaultValue: c?.issuer },
      { name: "sub_supplier_id", label: t("certifications.holder"), type: "select", span: 1,
        placeholder: t("certifications.holderSupplier"),
        options: (subSuppliers ?? []).map((s) => ({ value: s.id, label: s.name })), defaultValue: c?.sub_supplier_id },
      { name: "issued_on", label: t("certifications.issuedOn"), type: "date", span: 1, defaultValue: c?.issued_on },
      { name: "valid_until", label: t("certifications.validUntil"), type: "date", span: 1, defaultValue: c?.valid_until },
      { name: "scope", label: t("certifications.scope"), type: "textarea", defaultValue: c?.scope },
    ];
    if (internal) {
      list.splice(1, 0, {
        name: "standard_id", label: t("certifications.standard"), type: "select", span: 1,
        options: (standards ?? []).map((s) => ({ value: s.id, label: [s.code, s.revision].filter(Boolean).join(":") })),
        defaultValue: c?.standard_id,
      });
    }
    return list;
  };

  function validity(c: Cert) {
    if (!c.valid_until) return <ToneBadge tone="neutral">{t("certifications.noExpiry")}</ToneBadge>;
    const days = daysUntil(c.valid_until);
    if (days < 0) return <ToneBadge tone="danger">{t("certifications.expired")}</ToneBadge>;
    if (days <= 60) return <ToneBadge tone={days <= 30 ? "danger" : "warning"}>{t("certifications.expiresIn", { days })}</ToneBadge>;
    return <ToneBadge tone="success">{t("certifications.valid")}</ToneBadge>;
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <RecordDialog trigger={<AddButton label={t("certifications.add")} />} title={t("certifications.add")}
            fields={fields()} hidden={{ supplier_id: supplierId }} action={saveCertification} />
        </div>
      )}
      {certs.length === 0 ? <EmptyState>{t("certifications.empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("certifications.standardName")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("certifications.holder")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("certifications.validUntil")}</TableHead>
                <TableHead>{t("suppliers.status")}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {certs.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-48 whitespace-normal sm:max-w-none">
                    <div className="font-medium">{c.standard_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[c.certificate_number, c.issuer].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {c.sub_supplier_id ? subById.get(c.sub_supplier_id) : t("certifications.holderSupplier")}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {c.valid_until ? format.dateTime(new Date(`${c.valid_until}T12:00:00`), { dateStyle: "short" }) : "—"}
                  </TableCell>
                  <TableCell>
                    {validity(c)}
                    <div className="mt-1 text-xs text-muted-foreground sm:hidden">
                      {c.valid_until ? format.dateTime(new Date(`${c.valid_until}T12:00:00`), { dateStyle: "short" }) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end">
                      <DetailsDialog
                        title={`${t("certifications.files")} — ${c.standard_name}`}
                        trigger={
                          <Button variant="ghost" size="icon" className="size-8" title={t("certifications.files")} aria-label={t("certifications.files")}>
                            <PaperclipIcon />
                          </Button>
                        }
                      >
                        <AttachmentsPanel
                          target={{ entityTable: "certifications", entityId: c.id, supplierId, path }}
                          canUpload={canEdit}
                          canManage={canEdit}
                          allowInternal={internal}
                        />
                      </DetailsDialog>
                      {canEdit && (
                        <>
                          <RecordDialog trigger={<EditButton label={t("certifications.edit")} />} title={t("certifications.edit")}
                            fields={fields(c)} hidden={{ id: c.id, supplier_id: supplierId }} action={saveCertification} />
                          <CancelRecordButton table="certifications" id={c.id} path={path} />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
