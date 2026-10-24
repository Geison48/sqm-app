import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordDialog, type FieldDef } from "@/components/shared/record-dialog";
import { CancelRecordButton } from "@/components/shared/cancel-record-button";
import { AddButton, EditButton } from "@/components/shared/icon-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { createClient } from "@/lib/supabase/server";
import { getContactRoles, lookupLabel } from "@/lib/lookups";
import { saveContact } from "@/lib/actions/suppliers";
import type { Database } from "@/lib/database.types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

export async function ContactsTab({ supplierId, canEdit }: { supplierId: string; canEdit: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const [{ data }, roles, { data: plants }] = await Promise.all([
    supabase.from("contacts").select("*").eq("supplier_id", supplierId).is("cancelled_at", null)
      .order("role_code").order("is_primary", { ascending: false }),
    getContactRoles(true),
    supabase.from("plants").select("id, name").eq("supplier_id", supplierId).is("cancelled_at", null).order("name"),
  ]);
  const contacts = data ?? [];
  const roleByCode = new Map(roles.map((r) => [r.code, r]));
  const roleOrder = new Map(roles.map((r) => [r.code, r.sort_order]));
  contacts.sort((a, b) => (roleOrder.get(a.role_code) ?? 0) - (roleOrder.get(b.role_code) ?? 0));
  const path = `/suppliers/${supplierId}?tab=contacts`;

  const fields = (c?: Contact): FieldDef[] => [
    { name: "role_code", label: t("contacts.role"), type: "select", required: true, span: 1,
      options: roles.filter((r) => !r.cancelled_at).map((r) => ({ value: r.code, label: lookupLabel(r, locale) })),
      defaultValue: c?.role_code },
    { name: "full_name", label: t("contacts.fullName"), required: true, span: 1, defaultValue: c?.full_name },
    { name: "job_title", label: t("contacts.jobTitle"), span: 1, defaultValue: c?.job_title },
    { name: "plant_id", label: t("plants.name"), type: "select", span: 1,
      options: (plants ?? []).map((p) => ({ value: p.id, label: p.name })), defaultValue: c?.plant_id },
    { name: "email", label: t("contacts.email"), type: "email", span: 1, defaultValue: c?.email },
    { name: "phone", label: t("contacts.phone"), type: "tel", span: 1, defaultValue: c?.phone },
    { name: "is_primary", label: t("contacts.primary"), type: "checkbox", defaultValue: c?.is_primary },
  ];

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <RecordDialog trigger={<AddButton label={t("contacts.add")} />} title={t("contacts.add")} fields={fields()}
            hidden={{ supplier_id: supplierId }} action={saveContact} />
        </div>
      )}
      {contacts.length === 0 ? <EmptyState>{t("contacts.empty")}</EmptyState> : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("contacts.role")}</TableHead>
                <TableHead>{t("contacts.fullName")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("contacts.email")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("contacts.phone")}</TableHead>
                {canEdit && <TableHead className="w-0" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {lookupLabel(roleByCode.get(c.role_code), locale)}{" "}
                    {c.is_primary && <Badge variant="secondary">★</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{c.full_name}</div>
                    {c.job_title && <div className="text-xs text-muted-foreground">{c.job_title}</div>}
                    <div className="text-xs text-muted-foreground md:hidden">{c.email}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {c.email ? <a href={`mailto:${c.email}`} className="underline-offset-4 hover:underline">{c.email}</a> : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{c.phone ?? "—"}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex flex-wrap justify-end">
                        <RecordDialog trigger={<EditButton label={t("contacts.edit")} />} title={t("contacts.edit")}
                          fields={fields(c)} hidden={{ id: c.id, supplier_id: supplierId }} action={saveContact} />
                        <CancelRecordButton table="contacts" id={c.id} path={path} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
