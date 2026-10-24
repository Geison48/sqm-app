import type { AppRole } from "@/lib/auth";

// Menu lateral por perfil. Itens com ready=false aparecem como "Em breve" até a
// etapa correspondente do SPEC ser entregue.
export type NavIcon =
  | "home" | "building" | "box" | "book" | "clipboard" | "search" | "alert"
  | "bell" | "download" | "users" | "settings";

export type NavItem = {
  key: "myTasks" | "suppliers" | "mySupplier" | "components" | "standards" | "audits"
     | "inspections" | "ncs" | "notifications" | "exports" | "users" | "settings";
  href: string;
  icon: NavIcon;
  roles: AppRole[];
  ready: boolean;
};

export type NavSection = {
  key: "sectionMain" | "sectionRecords" | "sectionQuality" | "sectionAdmin";
  items: NavItem[];
};

const INTERNAL: AppRole[] = ["sqe", "sqm"];
const ALL: AppRole[] = ["sqe", "sqm", "supplier"];

const SECTIONS: NavSection[] = [
  {
    key: "sectionMain",
    items: [
      { key: "myTasks", href: "/", icon: "home", roles: ALL, ready: true },
      { key: "notifications", href: "/notifications", icon: "bell", roles: ALL, ready: true },
    ],
  },
  {
    key: "sectionRecords",
    items: [
      { key: "suppliers", href: "/suppliers", icon: "building", roles: INTERNAL, ready: true },
      { key: "mySupplier", href: "/my-supplier", icon: "building", roles: ["supplier"], ready: true },
      { key: "components", href: "/components", icon: "box", roles: INTERNAL, ready: true },
      { key: "standards", href: "/standards", icon: "book", roles: INTERNAL, ready: true },
    ],
  },
  {
    key: "sectionQuality",
    items: [
      { key: "ncs", href: "/ncs", icon: "alert", roles: ALL, ready: true },
      { key: "audits", href: "/audits", icon: "clipboard", roles: ALL, ready: false },
      { key: "inspections", href: "/inspections", icon: "search", roles: ALL, ready: false },
    ],
  },
  {
    key: "sectionAdmin",
    items: [
      { key: "users", href: "/users", icon: "users", roles: INTERNAL, ready: true },
      { key: "exports", href: "/exports", icon: "download", roles: INTERNAL, ready: false },
      { key: "settings", href: "/settings", icon: "settings", roles: INTERNAL, ready: true },
    ],
  },
];

export function navigationFor(role: AppRole): NavSection[] {
  return SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) })).filter(
    (s) => s.items.length > 0,
  );
}
