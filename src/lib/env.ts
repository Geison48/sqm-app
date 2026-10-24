// Variáveis públicas (disponíveis no navegador).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const AZURE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_AUTH_AZURE_ENABLED === "true";
