"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { locales } from "@/i18n/config";

export type InviteState = { error?: string; success?: string; email?: string } | undefined;

const inviteSchema = z
  .object({
    fullName: z.string().trim().min(1),
    email: z.email().trim().toLowerCase(),
    role: z.enum(["sqe", "sqm", "supplier"]),
    supplierId: z.uuid().optional(),
    language: z.enum(locales),
  })
  .refine((v) => v.role !== "supplier" || !!v.supplierId, { path: ["supplierId"] });

export async function inviteUser(_: InviteState, formData: FormData): Promise<InviteState> {
  const profile = await requireProfile(["sqe", "sqm"]);

  const raw = Object.fromEntries(formData);
  const parsed = inviteSchema.safeParse({ ...raw, supplierId: raw.supplierId || undefined });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "email") return { error: "users.errorInvalidEmail" };
    if (field === "supplierId") return { error: "users.errorSupplierRequired" };
    return { error: "common.genericError" };
  }
  const input = parsed.data;
  const supplierId = input.role === "supplier" ? input.supplierId! : null;

  // Permissão decidida no banco, com a sessão do usuário (não só na tela).
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_invite", { p_role: input.role, ...(supplierId ? { p_supplier_id: supplierId } : {}) });
  if (!allowed) return { error: "users.errorForbidden" };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("users").select("id").ilike("email", input.email).maybeSingle();
  if (existing) return { error: "users.errorEmailExists" };

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.fullName, language: input.language },
    redirectTo: `${SITE_URL}/auth/set-password`,
  });
  if (inviteError || !invited.user) {
    return { error: inviteError?.code === "email_exists" ? "users.errorEmailExists" : "common.genericError" };
  }

  const { error: insertError } = await admin.from("users").insert({
    id: invited.user.id,
    full_name: input.fullName,
    email: input.email,
    role: input.role,
    language: input.language,
    supplier_id: supplierId,
    invited_by: profile.id,
    invited_at: new Date().toISOString(),
    created_by: profile.id,
  });
  if (insertError) {
    // Sem perfil, o login não daria acesso; desfaz a conta de autenticação.
    await admin.auth.admin.deleteUser(invited.user.id);
    return { error: "common.genericError" };
  }

  revalidatePath("/users");
  return { success: "users.inviteSent", email: input.email };
}
