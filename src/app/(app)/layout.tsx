import { getTranslations } from "next-intl/server";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/app/notification-bell";
import { SyncStatus } from "@/components/offline/sync-status";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { navigationFor } from "@/lib/navigation";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  // Entrou pelo link do convite e ainda não definiu senha: primeiro a senha.
  const { data: needsPassword } = await (await createClient()).rpc("needs_password");
  if (needsPassword) redirect("/auth/set-password");
  const t = await getTranslations("roles");

  return (
    <SidebarProvider>
      <AppSidebar
        sections={navigationFor(profile.role)}
        user={{
          fullName: profile.fullName,
          email: profile.email,
          roleLabel: t(profile.role),
          supplierName: profile.supplierName,
        }}
      />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <SyncStatus userId={profile.id} />
          <NotificationBell userId={profile.id} />
          <LanguageSwitcher />
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
