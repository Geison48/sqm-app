import { InspectionsNav } from "./inspections-nav";

export default function InspectionsLayout({ children }: LayoutProps<"/inspections">) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <InspectionsNav />
      {children}
    </div>
  );
}
