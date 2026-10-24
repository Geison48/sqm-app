export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">{children}</div>
  );
}
