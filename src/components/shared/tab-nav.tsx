import Link from "next/link";
import { cn } from "@/lib/utils";

// Abas como links (?tab=), para cada aba carregar só os próprios dados no servidor.
export function TabNav({ tabs, active }: { tabs: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.key === active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors",
                tab.key === active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
