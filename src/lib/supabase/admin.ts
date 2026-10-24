import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_URL } from "@/lib/env";

// Cliente com a chave secreta: IGNORA a RLS. Usar só no servidor, para ações
// administrativas (convites) e sempre depois de checar a permissão do usuário
// com o cliente normal.
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY não configurada");
  return createClient<Database>(SUPABASE_URL, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
