"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CloudOffIcon, CloudUploadIcon, Loader2Icon } from "lucide-react";
import { offlineDb } from "@/lib/offline/db";
import { syncPending } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";
import { browserSyncApi } from "./sync-api";

/** Quantos itens/fotos deste usuário aguardam envio. */
export function usePendingCount(userId: string) {
  return useLiveQuery(async () => {
    const db = offlineDb();
    const packs = await db.packs.where("userId").equals(userId).primaryKeys();
    if (!packs.length) return 0;
    const changes = await db.changes.where("pack").anyOf(packs).count();
    const photos = await db.photos.where("pack").anyOf(packs).and((p) => p.status !== "server").count();
    return changes + photos;
  }, [userId], 0);
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Estado da conexão do navegador. */
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/** Dispara a sincronização: ao abrir, ao voltar a conexão e a cada minuto enquanto houver pendências. */
export function useAutoSync(userId: string) {
  const t = useTranslations("offline");
  const pending = usePendingCount(userId);
  const [syncing, setSyncing] = useState(false);
  const online = useOnline();
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const sync = useCallback(async (manual = false) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!manual && pendingRef.current === 0) return;
    setSyncing(true);
    try {
      const report = await syncPending(offlineDb(), browserSyncApi(userId));
      if (report.conflicts > 0) toast.warning(t("conflictToast", { count: report.conflicts }), { duration: 10000 });
      if (manual && report.failed === 0 && pendingRef.current === 0) toast.success(t("synced"));
    } finally {
      setSyncing(false);
    }
  }, [userId, t]);

  useEffect(() => {
    const goOnline = () => void sync();
    window.addEventListener("online", goOnline);
    const timer = window.setInterval(() => void sync(), 60_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.clearInterval(timer);
    };
  }, [sync]);

  // Assim que aparecer algo pendente com conexão, envia.
  useEffect(() => {
    if (pending > 0 && navigator.onLine) void sync();
  }, [pending, sync]);

  return { pending, syncing, online, sync };
}

// Indicador no cabeçalho: "N pendentes de envio" / sem conexão.
export function SyncStatus({ userId }: { userId: string }) {
  const t = useTranslations("offline");
  const { pending, syncing, online } = useAutoSync(userId);
  if (online && pending === 0 && !syncing) return null;
  return (
    <a href="/offline" title={online ? t("pending", { count: pending }) : t("offlineNow")}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium",
        online ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          : "border-neutral-300 bg-muted text-muted-foreground")}>
      {syncing ? <Loader2Icon className="size-3.5 animate-spin" /> : online ? <CloudUploadIcon className="size-3.5" /> : <CloudOffIcon className="size-3.5" />}
      <span className="hidden sm:inline">{syncing ? t("syncing") : pending > 0 ? t("pending", { count: pending }) : t("offlineNow")}</span>
      <span className="sm:hidden tabular-nums">{pending > 0 ? pending : ""}</span>
    </a>
  );
}
