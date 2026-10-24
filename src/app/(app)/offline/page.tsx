import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { OfflineApp } from "./offline-app";

export async function generateMetadata() {
  const t = await getTranslations("offline");
  return { title: t("title") };
}

// Tela da execução sem sinal. Fica no cache do service worker; todo o
// conteúdo vem do IndexedDB do aparelho (nada é lido do servidor aqui).
export default async function OfflinePage() {
  const profile = await requireProfile();
  return <OfflineApp userId={profile.id} />;
}
