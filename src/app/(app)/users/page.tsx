import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteUserDialog } from "./invite-user-dialog";

export async function generateMetadata() {
  const t = await getTranslations("users");
  return { title: t("title") };
}

export default async function UsersPage() {
  const profile = await requireProfile(["sqe", "sqm"]);
  const t = await getTranslations();
  const format = await getFormatter();
  const supabase = await createClient();

  const [{ data: users }, { data: suppliers }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, role, language, invited_at, cancelled_at, suppliers!users_supplier_id_fkey(legal_name)")
      .order("full_name"),
    supabase.from("suppliers").select("id, legal_name, responsible_sqe_id").is("cancelled_at", null).order("legal_name"),
  ]);
  // SQE convida só para os fornecedores sob sua responsabilidade (can_invite confere no banco).
  const invitable = (suppliers ?? []).filter((s) => profile.role === "sqm" || s.responsible_sqe_id === profile.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("users.title")}</h1>
          <p className="text-muted-foreground">
            {profile.role === "sqm" ? t("users.subtitle") : t("users.subtitleSqe")}
          </p>
        </div>
        <InviteUserDialog
          allowedRoles={profile.role === "sqm" ? ["sqe", "sqm", "supplier"] : ["supplier"]}
          suppliers={invitable.map((s) => ({ id: s.id, name: s.legal_name }))}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.fullName")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("users.email")}</TableHead>
              <TableHead>{t("users.role")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("users.supplier")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("users.invitedAt")}</TableHead>
              <TableHead>{t("users.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {t("users.empty")}
                </TableCell>
              </TableRow>
            )}
            {(users ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground md:hidden">{u.email}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "supplier" ? "outline" : "secondary"}>{t(`roles.${u.role}`)}</Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{u.suppliers?.legal_name ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {u.invited_at ? format.dateTime(new Date(u.invited_at), { dateStyle: "short" }) : "—"}
                </TableCell>
                <TableCell>
                  {u.cancelled_at ? (
                    <Badge variant="destructive">{t("users.inactive")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("users.active")}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
