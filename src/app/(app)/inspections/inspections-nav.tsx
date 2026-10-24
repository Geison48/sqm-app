"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "inspections", href: "/inspections" },
  { key: "units", href: "/inspections/units" },
  { key: "waivers", href: "/inspections/waivers" },
  { key: "plans", href: "/inspections/plans" },
  { key: "controlled", href: "/inspections/controlled-shipment" },
] as const;

export function InspectionsNav() {
  const t = useTranslations("inspections.tabs");
  const pathname = usePathname();
  const active = [...TABS].reverse().find((tab) => pathname.startsWith(tab.href))?.key ?? "inspections";
  return (
    <nav className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => (
          <li key={tab.key}>
            <Link href={tab.href} aria-current={tab.key === active ? "page" : undefined}
              className={cn("inline-flex h-10 items-center border-b-2 px-3 text-sm whitespace-nowrap",
                tab.key === active ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t(tab.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
