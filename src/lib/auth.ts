import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  language: Database["public"]["Enums"]["app_language"];
  supplierId: string | null;
  supplierName: string | null;
};

// Lê o perfil do usuário logado (uma vez por requisição). null = sem sessão
// ou sem perfil ativo.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("users")
    .select("id, full_name, email, role, language, supplier_id, cancelled_at, suppliers!users_supplier_id_fkey(legal_name)")
    .eq("id", userId)
    .maybeSingle();

  if (!data || data.cancelled_at) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    language: data.language,
    supplierId: data.supplier_id,
    supplierName: data.suppliers?.legal_name ?? null,
  };
});

// Para páginas protegidas: exige sessão com perfil ativo e, opcionalmente, um
// dos perfis informados. A RLS continua sendo a barreira real no banco.
export async function requireProfile(roles?: AppRole[]): Promise<Profile> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const profile = await getProfile();
  if (!profile) redirect("/auth/unauthorized");
  if (roles && !roles.includes(profile.role)) redirect("/");
  return profile;
}

export const isInternal = (role: AppRole) => role === "sqe" || role === "sqm";
