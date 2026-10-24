import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { InboxIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("home");
  return { title: t("title") };
}

const GROUPS = ["review", "overdue", "due", "week", "expiring"] as const;
type Group = (typeof GROUPS)[number];
const GROUP_STYLE: Record<Group, string> = {
  review: "border-sky-200 dark:border-sky-900",
  overdue: "border-red-200 dark:border-red-900",
  due: "border-amber-200 dark:border-amber-900",
  week: "",
  expiring: "",
};

// "Minhas pendências" por perfil (os dados vêm de my_pending_items(), que já
// recorta: SQE = fornecedores sob sua responsabilidade; SQM = todos; fornecedor = o dele).
export default async function HomePage() {
  const profile = await requireProfile();
  const t = await getTranslations("home");
  const tp = await getTranslations("pending");
  const format = await getFormatter();
  const supabase = await createClient();
  const isSupplier = profile.role === "supplier";
  const isSqm = profile.role === "sqm";

  const [{ data }, { data: sqes }] = await Promise.all([
    supabase.rpc("my_pending_items"),
    isSqm ? supabase.from("users").select("id, full_name").eq("role", "sqe").is("cancelled_at", null).order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const items = (data ?? []).sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const date = (d: string) => format.dateTime(new Date(`${d}T12:00:00`), { dateStyle: "short" });

  function when(i: (typeof items)[number]) {
    if (!i.due_on) return null;
    if (i.grp === "review") return <span className="text-muted-foreground">{tp("since", { date: date(i.due_on) })}</span>;
    const late = i.days_left < 0 || (i.grp === "overdue");
    return (
      <span className={cn(late ? "font-medium text-red-600 dark:text-red-400" : i.days_left <= 2 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
        {tp("due", { date: date(i.due_on) })}
        {(i.grp === "overdue" || i.grp === "due") && i.days_left <= 0 && <> · {tp("overdueBy", { days: -i.days_left })}</>}
      </span>
    );
  }

  const groups = GROUPS.filter((g) => items.some((i) => i.grp === g));

  // Carga por SQE (SQM): pendências de análise e atrasos por responsável.
  const load = isSqm ? [...(sqes ?? []).map((s) => ({ id: s.id as string | null, name: s.full_name })), { id: null, name: tp("noSqe") }]
    .map((s) => {
      const mine = items.filter((i) => (i.responsible_sqe_id ?? null) === s.id);
      return { ...s, review: mine.filter((i) => i.grp === "review").length, overdue: mine.filter((i) => i.grp === "overdue").length,
        other: mine.filter((i) => i.grp !== "review" && i.grp !== "overdue").length, total: mine.length };
    }).filter((s) => s.id !== null || s.total > 0) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("greeting", { name: profile.fullName.split(" ")[0] })} · {tp("summary", { count: items.length })}</p>
      </div>

      {groups.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {groups.map((g) => (
            <a key={g} href={`#${g}`} className={cn("rounded-lg border p-3 hover:bg-muted/50", GROUP_STYLE[g])}>
              <p className="text-2xl font-semibold tabular-nums">{items.filter((i) => i.grp === g).length}</p>
              <p className="text-sm text-muted-foreground">{tp(`groups.${g}`)}</p>
            </a>
          ))}
        </div>
      )}

      {isSqm && load.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">{tp("loadTitle")}</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tp("sqe")}</TableHead>
                  <TableHead className="text-right">{tp("groups.review")}</TableHead>
                  <TableHead className="text-right">{tp("groups.overdue")}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{tp("groups.week")} / {tp("groups.expiring")}</TableHead>
                  <TableHead className="text-right">{tp("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {load.map((s) => (
                  <TableRow key={s.id ?? "none"}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.review}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", s.overdue > 0 && "font-medium text-red-600 dark:text-red-400")}>{s.overdue}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.other}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{s.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
          <InboxIcon className="mb-3 size-10 text-muted-foreground" />
          <h2 className="font-medium">{tp("allClear")}</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{t("emptyDescription")}</p>
        </div>
      ) : groups.map((g) => (
        <section key={g} id={g} className="scroll-mt-20 space-y-2">
          <div>
            <h2 className="font-medium">{tp(`groups.${g}`)}</h2>
            <p className="text-xs text-muted-foreground">{tp(`groupHints.${g}`)}</p>
          </div>
          <ul className="divide-y rounded-lg border">
            {items.filter((i) => i.grp === g).map((i) => (
              <li key={`${i.entity_table}:${i.entity_id}:${i.kind}`} className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{tp(`kinds.${i.kind as "audit"}`)}{!isSupplier && <> · {i.supplier_name}</>}</p>
                  <Link href={i.link} className="text-sm font-medium after:absolute after:inset-0 hover:underline">
                    <span className="font-mono">{i.ref}</span>{i.detail && <> · {i.detail}</>}
                  </Link>
                </div>
                <p className="text-sm">{when(i)}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
