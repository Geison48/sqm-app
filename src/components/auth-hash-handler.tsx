"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Links dos e-mails PADRÃO do Supabase (sem modelo próprio, ex.: plano grátis sem
// SMTP) devolvem a sessão no fragmento da URL: #access_token=...&type=invite.
// O servidor não enxerga o fragmento; aqui a sessão vira cookie e o usuário
// segue para definir a senha (convite/redefinição) ou para o início.
export function AuthHashHandler() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error") || hash.get("error_code")) {
      window.location.replace("/login?error=link");
      return;
    }
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) return;
    const type = hash.get("type");
    createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) window.location.replace("/login?error=link");
      else window.location.replace(type === "invite" || type === "recovery" ? "/auth/set-password" : "/");
    });
  }, []);
  return null;
}
