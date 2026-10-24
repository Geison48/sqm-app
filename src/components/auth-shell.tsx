import { getTranslations } from "next-intl/server";
import { ShieldCheckIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";

// Moldura das telas públicas (login, convite, senha).
export async function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");
  return (
    <main className="flex min-h-svh flex-col bg-muted/40">
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center justify-center gap-2 text-lg font-semibold">
            <ShieldCheckIcon className="size-6" />
            <span>{t("appName")}</span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
