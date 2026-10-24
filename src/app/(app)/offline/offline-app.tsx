"use client";

import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangleIcon, ArrowLeftIcon, CloudUploadIcon, ExternalLinkIcon, Loader2Icon, Trash2Icon, WifiOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { offlineDb, packKey, type Pack } from "@/lib/offline/db";
import { removePack } from "@/lib/offline/download";
import { useAutoSync } from "@/components/offline/sync-status";
import { OfflineAudit } from "./offline-audit";
import { OfflineInspection } from "./offline-inspection";

// A seleção fica na própria página (?audit= / ?inspection=) sem navegação do
// Next: sem sinal, outra rota não carregaria.
const NAV_EVENT = "sqm-offline-nav";
function subscribeLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(NAV_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(NAV_EVENT, callback);
  };
}
function selectionFrom(search: string): string | null {
  const sp = new URLSearchParams(search);
  if (sp.get("audit")) return packKey("audit", sp.get("audit")!);
  if (sp.get("inspection")) return packKey("inspection", sp.get("inspection")!);
  return null;
}

export function OfflineApp({ userId }: { userId: string }) {
  const t = useTranslations("offline");
  const format = useFormatter();
  const search = useSyncExternalStore(subscribeLocation, () => window.location.search, () => "");
  const selected = selectionFrom(search);
  const { pending, syncing, online, sync } = useAutoSync(userId);
  const packs = useLiveQuery(() => offlineDb().packs.where("userId").equals(userId).toArray(), [userId]);
  const counts = useLiveQuery(async () => {
    const db = offlineDb();
    const out: Record<string, number> = {};
    for (const c of await db.changes.toArray()) out[c.pack] = (out[c.pack] ?? 0) + 1;
    for (const p of await db.photos.where("status").anyOf("pending", "error").toArray()) out[p.pack] = (out[p.pack] ?? 0) + 1;
    return out;
  }, [], {} as Record<string, number>);
  const unseen = useLiveQuery(() => offlineDb().conflicts.filter((c) => !c.seen).toArray(), [], []);

  function open(pack: Pack | null) {
    const url = pack ? `/offline?${pack.kind}=${pack.id}` : "/offline";
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event(NAV_EVENT));
    window.scrollTo(0, 0);
  }

  async function remove(pack: Pack) {
    const r = await removePack(offlineDb(), pack.key);
    if ("error" in r) toast.error(t(r.error as "removeBlocked"));
    else toast.success(t("removed"));
  }

  async function dismissConflicts() {
    await offlineDb().conflicts.toCollection().modify({ seen: true });
  }

  if (packs === undefined) return null;
  const pack = selected ? packs.find((p) => p.key === selected) : undefined;

  const statusBar = (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {!online && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground"><WifiOffIcon className="size-4" />{t("offlineNow")}</span>}
      {pending > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <CloudUploadIcon className="size-4" />{t("pending", { count: pending })}
        </span>
      )}
      {online && pending > 0 && (
        <Button size="sm" variant="outline" disabled={syncing} onClick={() => sync(true)}>
          {syncing ? <Loader2Icon className="animate-spin" /> : <CloudUploadIcon />}{syncing ? t("syncing") : t("syncNow")}
        </Button>
      )}
    </div>
  );

  const conflictBox = unseen.length > 0 && (
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <p className="flex items-center gap-2 font-medium"><AlertTriangleIcon className="size-4" />{t("conflictsTitle")}</p>
      <ul className="list-disc space-y-1 pl-5">
        {unseen.map((c) => (
          <li key={c.id}>{t("conflictLine", { number: c.number, item: c.item, by: c.by, at: format.dateTime(new Date(c.at), { dateStyle: "short", timeStyle: "short" }) })}</li>
        ))}
      </ul>
      <Button size="sm" variant="outline" onClick={dismissConflicts}>{t("dismiss")}</Button>
    </div>
  );

  if (selected) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => open(null)}><ArrowLeftIcon />{t("backToList")}</Button>
          {statusBar}
        </div>
        {conflictBox}
        {!pack ? <p className="text-sm text-muted-foreground">{t("notFound")}</p>
          : pack.kind === "audit" ? <OfflineAudit pack={pack} /> : <OfflineInspection pack={pack} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")} {t("hint")}</p>
      </div>
      {statusBar}
      {conflictBox}
      {packs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {packs.map((p) => (
            <li key={p.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <button type="button" className="min-w-0 text-left" onClick={() => open(p)}>
                <p className="text-xs text-muted-foreground">{t(`kinds.${p.kind}`)} · {format.dateTime(new Date(p.downloadedAt), { dateStyle: "short", timeStyle: "short" })}</p>
                <p className="font-medium hover:underline"><span className="font-mono">{p.number}</span> · {p.title}</p>
                {(counts[p.key] ?? 0) > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{t("pending", { count: counts[p.key]! })}</p>}
              </button>
              <div className="flex gap-1">
                {online && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={p.kind === "audit" ? `/audits/${p.id}` : `/inspections/${p.id}`}><ExternalLinkIcon />{t("openOnline")}</a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" title={t("remove")} aria-label={t("remove")} onClick={() => remove(p)}><Trash2Icon /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
