import { getTranslations } from "next-intl/server";
import { InboxIcon } from "lucide-react";
import { requireProfile } from "@/lib/auth";

export async function generateMetadata() {
  const t = await getTranslations("home");
  return { title: t("title") };
}

// "Minhas pendências": vazia na etapa 1; recebe os itens por perfil na etapa 6.
export default async function HomePage() {
  const profile = await requireProfile();
  const t = await getTranslations("home");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("greeting", { name: profile.fullName.split(" ")[0] })}</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
        <InboxIcon className="mb-3 size-10 text-muted-foreground" />
        <h2 className="font-medium">{t("emptyTitle")}</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("emptyDescription")}</p>
      </div>
    </div>
  );
}
