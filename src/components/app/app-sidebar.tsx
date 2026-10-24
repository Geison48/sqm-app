"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangleIcon, BellIcon, BookOpenIcon, BoxIcon, Building2Icon, ClipboardCheckIcon,
  DownloadIcon, HomeIcon, ScanSearchIcon, SettingsIcon, ShieldCheckIcon, SmartphoneIcon, UsersIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";
import type { NavIcon, NavSection } from "@/lib/navigation";
import { UserMenu } from "./user-menu";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: HomeIcon, building: Building2Icon, box: BoxIcon, book: BookOpenIcon,
  clipboard: ClipboardCheckIcon, search: ScanSearchIcon, alert: AlertTriangleIcon,
  bell: BellIcon, download: DownloadIcon, users: UsersIcon, settings: SettingsIcon, device: SmartphoneIcon,
};

export function AppSidebar({
  sections,
  user,
}: {
  sections: NavSection[];
  user: { fullName: string; email: string; roleLabel: string; supplierName: string | null };
}) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <ShieldCheckIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{t("common.appName")}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.supplierName ?? t("common.appTagline")}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.key}>
            <SidebarGroupLabel>{t(`nav.${section.key}`)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const label = t(`nav.${item.key}`);
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.key}>
                      {item.ready ? (
                        <SidebarMenuButton asChild isActive={active} tooltip={label}>
                          <Link href={item.href}>
                            <Icon />
                            <span>{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton aria-disabled tooltip={label} className="cursor-default opacity-60">
                          <Icon />
                          <span className="truncate">{label}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {t("common.comingSoon")}
                          </span>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
