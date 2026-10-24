import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export default async function UnauthorizedPage() {
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("unauthorizedTitle")} description={t("unauthorizedDescription")}>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          {t("backToLogin")}
        </Button>
      </form>
    </AuthShell>
  );
}
